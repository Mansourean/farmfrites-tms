-- Gate User workflow: a dedicated kiosk-style operational page (not a dashboard) for the
-- factory's security gate to record when a truck physically checks in and checks out, measure
-- the actual time it spent at the gate, and flag/record a reason when that exceeds 2 hours.
--
-- WHAT CHANGES AND WHY:
--   1. New role 'gate', added to profiles.role's existing CHECK constraint (was 'admin',
--      'dispatcher', 'warehouse', 'viewer' -- see 0002). Same dynamic drop/re-add pattern
--      already used repeatedly for trips_status_check (0008/0013/0016) since a column CHECK
--      can't be widened with ALTER ... ADD directly.
--   2. Six new nullable columns on public.trips -- purely additive, every existing row is
--      unaffected:
--        gate_check_in_at / gate_check_in_by / gate_check_in_by_name
--        gate_check_out_at / gate_check_out_by / gate_check_out_by_name
--        gate_delay_reason
--      Actor *name* is denormalized onto trips (not just the uuid FK) the same way
--      trip_events.actor_name already is (0004) -- the Gate page needs to show "who checked
--      this truck in/out" without an extra join back to profiles.
--   3. Gate check-in/out is deliberately NOT another value in trips_status_check and never
--      touches the `status` column at all -- it's a parallel, independent record of gate
--      activity, not a replacement for or addition to the existing New Order -> ... ->
--      Delivered pipeline. This is intentional: the existing workflow must stay exactly as it
--      is. Because gate_check_in/gate_check_out never update `status`, they never fire
--      log_trip_status_change (0013) either -- no skip-audit dance needed; each RPC inserts
--      its own trip_events row directly instead ('gate_check_in' / 'gate_check_out'), same
--      free-text event_type convention every other RPC already uses.
--   4. One gate visit is tracked per trip via the four gate_* timestamp/actor columns "in
--      place" (mirrors the existing loaded_at/loaded_by single-latest-value convention on
--      trips, with the full history durably preserved in trip_events regardless). A trip may
--      be checked in again after a completed cycle (gate_check_in_at/out_at both set) --
--      re-checking in simply overwrites these columns with the new cycle's values and clears
--      gate_delay_reason; the prior cycle's data still exists permanently in trip_events.
--      Duplicate check-in/out on the *same* open visit is blocked server-side (guard below),
--      not just hidden in the UI.
--   5. Server-side (not just client-side) delay-reason enforcement: gate_check_out raises an
--      exception if the gate visit exceeded 2 hours and no non-blank p_delay_reason was
--      supplied, so this can't be bypassed by calling the RPC directly.
--   6. public.trips is added to the supabase_realtime publication so the Gate page's "who's
--      currently at the gate" list can update live across multiple gate terminals/sessions
--      without a manual refresh -- see the frontend GateCheck.jsx subscription. This exposes
--      nothing beyond what trips_select already allows those same roles to read via a normal
--      SELECT (Realtime's postgres_changes payloads are filtered by the same RLS policies), so
--      it does not widen access.
--
-- Role choice for the two RPCs below: 'admin' and 'gate' only (not dispatcher/warehouse) --
-- this is a distinct physical checkpoint performed by gate security staff, not general trip
-- editing (which dispatcher/warehouse already have through canEdit() elsewhere) and not
-- warehouse's own loading responsibility (mark_trip_loaded etc., unchanged, still
-- admin/dispatcher/warehouse only).

begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'dispatcher', 'warehouse', 'viewer', 'gate'));

alter table public.trips
  add column if not exists gate_check_in_at timestamptz,
  add column if not exists gate_check_in_by uuid references auth.users(id) on delete set null,
  add column if not exists gate_check_in_by_name text,
  add column if not exists gate_check_out_at timestamptz,
  add column if not exists gate_check_out_by uuid references auth.users(id) on delete set null,
  add column if not exists gate_check_out_by_name text,
  add column if not exists gate_delay_reason text;

-- Lets the four active roles that could already see every trip also see gate users' accounts
-- (same shape as the existing four -- see 0002/0004), and lets a 'gate' account itself pass
-- trips_select (0004) to search by Plate No / Sales No on the Gate page.
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher', 'warehouse', 'viewer', 'gate')
    )
  );

create function public.gate_check_in(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_actor_name text;
  v_status text;
  v_gate_check_in_at timestamptz;
  v_gate_check_out_at timestamptz;
  v_row public.trips;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select role, status, full_name into v_role, v_profile_status, v_actor_name
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'No profile found for the current user.';
  end if;

  if v_profile_status <> 'active' then
    raise exception 'Account is not active.';
  end if;

  if v_role not in ('admin', 'gate') then
    raise exception 'Not authorized to check in trips at the gate.';
  end if;

  select status, gate_check_in_at, gate_check_out_at
  into v_status, v_gate_check_in_at, v_gate_check_out_at
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_status in ('Delivered', 'Cancelled', 'Rejected') then
    raise exception 'This trip has already been completed and cannot be checked in at the gate.';
  end if;

  if v_gate_check_in_at is not null and v_gate_check_out_at is null then
    raise exception 'This trip is already checked in at the gate.';
  end if;

  update public.trips
  set gate_check_in_at = now(),
      gate_check_in_by = auth.uid(),
      gate_check_in_by_name = v_actor_name,
      gate_check_out_at = null,
      gate_check_out_by = null,
      gate_check_out_by_name = null,
      gate_delay_reason = null
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
  values (p_trip_id, 'gate_check_in', auth.uid(), v_actor_name, jsonb_build_object('checked_in_at', v_row.gate_check_in_at));

  return v_row;
end;
$$;

create function public.gate_check_out(p_trip_id uuid, p_delay_reason text default null)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_actor_name text;
  v_gate_check_in_at timestamptz;
  v_gate_check_out_at timestamptz;
  v_duration_seconds numeric;
  v_reason text;
  v_row public.trips;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select role, status, full_name into v_role, v_profile_status, v_actor_name
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'No profile found for the current user.';
  end if;

  if v_profile_status <> 'active' then
    raise exception 'Account is not active.';
  end if;

  if v_role not in ('admin', 'gate') then
    raise exception 'Not authorized to check out trips at the gate.';
  end if;

  select gate_check_in_at, gate_check_out_at into v_gate_check_in_at, v_gate_check_out_at
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_gate_check_in_at is null then
    raise exception 'This trip has not been checked in at the gate yet.';
  end if;

  if v_gate_check_out_at is not null then
    raise exception 'This trip has already been checked out at the gate.';
  end if;

  v_duration_seconds := extract(epoch from (now() - v_gate_check_in_at));
  v_reason := nullif(trim(coalesce(p_delay_reason, '')), '');

  -- Enforced here, not just in the UI: a checkout that took longer than 2 hours must record
  -- why, whether the RPC is called from the Gate page or directly.
  if v_duration_seconds > 7200 and v_reason is null then
    raise exception 'Gate duration exceeded 2 hours -- a delay reason is required to check out.';
  end if;

  update public.trips
  set gate_check_out_at = now(),
      gate_check_out_by = auth.uid(),
      gate_check_out_by_name = v_actor_name,
      gate_delay_reason = v_reason
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
  values (
    p_trip_id, 'gate_check_out', auth.uid(), v_actor_name,
    jsonb_build_object('checked_out_at', v_row.gate_check_out_at, 'duration_seconds', v_duration_seconds, 'delay_reason', v_reason)
  );

  return v_row;
end;
$$;

revoke all on function public.gate_check_in(uuid) from public;
revoke all on function public.gate_check_in(uuid) from anon;
grant execute on function public.gate_check_in(uuid) to authenticated;

revoke all on function public.gate_check_out(uuid, text) from public;
revoke all on function public.gate_check_out(uuid, text) from anon;
grant execute on function public.gate_check_out(uuid, text) to authenticated;

-- Idempotent guard: fails if trips is already in the publication (e.g. a retry of this
-- migration) without this check.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- Note: rolling back profiles_role_check while any profile already has role = 'gate' will
-- fail until those rows are reassigned to another role first -- same reasoning every other
-- status/role CHECK rollback in this project already calls out.
--
-- begin;
-- alter publication supabase_realtime drop table public.trips;
-- revoke execute on function public.gate_check_in(uuid) from authenticated;
-- revoke execute on function public.gate_check_out(uuid, text) from authenticated;
-- drop function if exists public.gate_check_in(uuid);
-- drop function if exists public.gate_check_out(uuid, text);
--
-- drop policy if exists trips_select on public.trips;
-- create policy trips_select on public.trips
--   for select to authenticated
--   using (
--     exists (
--       select 1 from public.profiles p
--       where p.id = auth.uid() and p.status = 'active'
--         and p.role in ('admin', 'dispatcher', 'warehouse', 'viewer')
--     )
--   );
--
-- alter table public.trips
--   drop column if exists gate_check_in_at,
--   drop column if exists gate_check_in_by,
--   drop column if exists gate_check_in_by_name,
--   drop column if exists gate_check_out_at,
--   drop column if exists gate_check_out_by,
--   drop column if exists gate_check_out_by_name,
--   drop column if exists gate_delay_reason;
--
-- alter table public.profiles drop constraint if exists profiles_role_check;
-- alter table public.profiles add constraint profiles_role_check
--   check (role in ('admin', 'dispatcher', 'warehouse', 'viewer'));
-- commit;
