-- Re-applies migration 0021 in full, after a direct read-only check on production confirmed
-- trips_status_check still exactly matches 0016's original list -- 'At Gate' was never added.
--
-- ROOT CAUSE: 0021 was written as a single begin;/commit; transaction containing the
-- constraint widen, all three function replacements (gate_check_in/mark_trip_loaded/
-- reject_trip_load), and a backfill UPDATE that sets status = 'At Gate' for any trip already
-- gate-checked-in. Postgres transactions are atomic: if any one statement inside failed for
-- any reason, the ENTIRE transaction rolls back together, including the constraint change,
-- even though the earlier statements in the same block would have appeared to succeed up to
-- that point. The live constraint being byte-for-byte the pre-0021 list is consistent with
-- that transaction never having committed at all -- which would also mean gate_check_in is
-- still running its 0020 body on production today (records the gate timestamps, never touches
-- status), exactly matching every symptom reported (TEST-001 stuck on "Confirmed").
--
-- This migration is safe to run even if some of 0021 already silently succeeded somewhere,
-- because every statement here is independently idempotent:
--   - drop constraint if exists / add constraint -- always converges to the same end state.
--   - create or replace function -- always converges to the same end state.
--   - the backfill UPDATE's own WHERE clause (status = 'Waiting for Loading') makes it a
--     guaranteed no-op for any row already moved to 'At Gate'.
-- Nothing here removes or narrows any existing status value, touches any function/table
-- outside the four named above, or changes gate_check_out (still never touches status).

begin;

alter table public.trips
  drop constraint if exists trips_status_check;

alter table public.trips
  add constraint trips_status_check
  check (status in (
    'Planned', 'Ready for Transporter', 'Waiting for Loading', 'At Gate', 'Waiting Driver',
    'Loaded', 'In Transit', 'Delivered', 'Cancelled', 'Rejected'
  ));

create or replace function public.gate_check_in(p_trip_id uuid)
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

  select status into v_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_status <> 'Waiting for Loading' then
    raise exception 'This trip must be Confirmed before it can be checked in at the gate (current status: %).', v_status;
  end if;

  perform set_config('app.skip_status_audit', 'true', true);

  update public.trips
  set status = 'At Gate',
      gate_check_in_at = now(),
      gate_check_in_by = auth.uid(),
      gate_check_in_by_name = v_actor_name,
      gate_check_out_at = null,
      gate_check_out_by = null,
      gate_check_out_by_name = null,
      gate_delay_reason = null
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
  values (
    p_trip_id, 'gate_check_in', auth.uid(), v_actor_name,
    jsonb_build_object('previous_status', v_status, 'new_status', 'At Gate', 'checked_in_at', v_row.gate_check_in_at)
  );

  return v_row;
end;
$$;

create or replace function public.mark_trip_loaded(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_actor_name text;
  v_previous_trip_status text;
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

  if v_role not in ('admin', 'dispatcher', 'warehouse') then
    raise exception 'Not authorized to confirm loading.';
  end if;

  select status into v_previous_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_previous_trip_status not in ('Waiting for Loading', 'At Gate') then
    raise exception 'Trip is not eligible for loading confirmation (current status: %).', v_previous_trip_status;
  end if;

  perform set_config('app.skip_status_audit', 'true', true);

  update public.trips
  set status = 'Loaded', loaded_at = now(), loaded_by = auth.uid()
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
  values (
    p_trip_id,
    'loading_confirmed',
    auth.uid(),
    v_actor_name,
    jsonb_build_object('previous_status', v_previous_trip_status, 'new_status', 'Loaded')
  );

  return v_row;
end;
$$;

create or replace function public.reject_trip_load(p_trip_id uuid, p_reason text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_actor_name text;
  v_previous_trip_status text;
  v_row public.trips;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A rejection reason is required.';
  end if;

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

  if v_role not in ('admin', 'dispatcher', 'warehouse') then
    raise exception 'Not authorized to reject loading.';
  end if;

  select status into v_previous_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_previous_trip_status not in ('Waiting for Loading', 'At Gate') then
    raise exception 'Trip is not eligible for rejection (current status: %).', v_previous_trip_status;
  end if;

  perform set_config('app.skip_status_audit', 'true', true);

  update public.trips
  set status = 'Rejected'
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, reason, metadata)
  values (
    p_trip_id,
    'loading_rejected',
    auth.uid(),
    v_actor_name,
    trim(p_reason),
    jsonb_build_object('previous_status', v_previous_trip_status, 'new_status', 'Rejected')
  );

  return v_row;
end;
$$;

update public.trips
set status = 'At Gate'
where status = 'Waiting for Loading'
  and gate_check_in_at is not null
  and gate_check_out_at is null;

commit;

-- ---------------------------------------------------------------------------
-- Verification (run these read-only queries right after -- see chat for expected results):
-- ---------------------------------------------------------------------------
-- select conname, pg_get_constraintdef(oid) as definition
-- from pg_constraint
-- where conrelid = 'public.trips'::regclass and conname = 'trips_status_check';
--
-- select id, sales_no, status, gate_check_in_at, gate_check_out_at
-- from public.trips where sales_no = 'TEST-001';
--
-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed): identical to 0021's own rollback block -- see that
-- file for the full statements (restores the pre-'At Gate' constraint and function bodies).
-- ---------------------------------------------------------------------------
