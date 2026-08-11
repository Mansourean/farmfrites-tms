-- Wires Gate Check-In into the actual trip status pipeline, per direct correction after
-- production testing: 0020 deliberately kept gate check-in/out fully independent of `status`
-- (a parallel timestamp log), but the approved workflow is now:
--
--   New Order -> Transportation Assignment -> Confirmed -> At Gate -> Loaded -> In Transit
--   -> Delivered
--
-- WHAT CHANGES AND WHY:
--   1. New status value 'At Gate' added to trips_status_check (same dynamic drop/re-add
--      pattern as every prior status addition -- 0008/0013/0016). 'Waiting for Loading' is
--      untouched and still exists as a value -- it's the DB string behind the "Confirmed" UI
--      label (see 0016's own comment on why the DB string was never renamed), which At Gate
--      now sits directly after in the pipeline.
--   2. gate_check_in (0020) now REQUIRES the trip to currently be 'Waiting for Loading'
--      (Confirmed) and, on success, moves status to 'At Gate' as part of the same update --
--      this is what "Prevent invalid status transitions" means here: checking in is now a
--      real pipeline transition, not a side effect that could happen from any status. This
--      single check also subsumes 0020's old separate "already checked in" guard: once status
--      is 'At Gate' (or anything else), it's no longer 'Waiting for Loading', so a second
--      check-in attempt is rejected by the same condition. Uses set_config('app.skip_status_
--      audit', ...) before the update, same as every other status-changing RPC, so this
--      doesn't ALSO fire the generic log_trip_status_change trigger (0013) alongside its own
--      richer 'gate_check_in' trip_events row.
--   3. gate_check_out (0020) is UNCHANGED here on purpose -- per explicit instruction, checking
--      out must NOT automatically advance status (not to Delivered, not to anything else). It
--      keeps recording gate_check_out_at/by/by_name/gate_delay_reason exactly as before; the
--      trip's status stays whatever it already was (typically still 'At Gate', or further
--      along if the warehouse has already loaded it by the time the truck leaves).
--   4. mark_trip_loaded and reject_trip_load (0016) now accept EITHER 'Waiting for Loading' OR
--      'At Gate' as the eligible source status (was 'Waiting for Loading' only). This is the
--      necessary consequence of #2: once a trip reaches 'At Gate', the OLD guard would make it
--      permanently ineligible for loading, stranding every gated trip. Backward compatible on
--      purpose -- a trip that has NOT been gated yet (still sitting at 'Waiting for Loading')
--      can still be loaded directly, so this does not break any trip already in flight before
--      this migration runs.
--   5. One-time backfill: any trip that already has a gate_check_in_at (checked in) but no
--      gate_check_out_at, and is still sitting at 'Waiting for Loading' because it was checked
--      in under 0020's old (pre-status-integration) behavior, is moved to 'At Gate' now. This
--      is exactly the TEST-001 case reported -- checked in successfully, but the Transportation
--      Log still showed "Confirmed". Scoped tightly (both conditions must hold) so it cannot
--      touch any trip that was never gate-checked-in.
--
-- Not changed: 'Waiting for Loading'/'At Gate' UI colors for every OTHER existing status,
-- WarehouseScan.jsx's own filtering (updated in the same frontend commit, not here), the New
-- Order -> Confirmed automatic promotion (autoReadyStatus, untouched), and no Dashboard.

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

-- One-time backfill for trips already checked in under 0020's pre-status-integration behavior
-- (exactly the reported TEST-001 case) -- tightly scoped, cannot affect any trip that was
-- never gate-checked-in.
update public.trips
set status = 'At Gate'
where status = 'Waiting for Loading'
  and gate_check_in_at is not null
  and gate_check_out_at is null;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- Note: rolling back trips_status_check while any trip is still 'At Gate' will fail until
-- those rows are moved to another status first -- same reasoning every other status CHECK
-- rollback in this project already calls out.
--
-- begin;
-- update public.trips set status = 'Waiting for Loading' where status = 'At Gate';
--
-- create or replace function public.gate_check_in(p_trip_id uuid)
-- returns public.trips language plpgsql security definer set search_path = public as $$
-- declare
--   v_role text; v_profile_status text; v_actor_name text; v_status text;
--   v_gate_check_in_at timestamptz; v_gate_check_out_at timestamptz; v_row public.trips;
-- begin
--   if auth.uid() is null then raise exception 'Authentication required.'; end if;
--   select role, status, full_name into v_role, v_profile_status, v_actor_name
--   from public.profiles where id = auth.uid();
--   if v_role is null then raise exception 'No profile found for the current user.'; end if;
--   if v_profile_status <> 'active' then raise exception 'Account is not active.'; end if;
--   if v_role not in ('admin', 'gate') then raise exception 'Not authorized to check in trips at the gate.'; end if;
--   select status, gate_check_in_at, gate_check_out_at into v_status, v_gate_check_in_at, v_gate_check_out_at
--   from public.trips where id = p_trip_id for update;
--   if not found then raise exception 'Trip not found.'; end if;
--   if v_status in ('Delivered', 'Cancelled', 'Rejected') then
--     raise exception 'This trip has already been completed and cannot be checked in at the gate.';
--   end if;
--   if v_gate_check_in_at is not null and v_gate_check_out_at is null then
--     raise exception 'This trip is already checked in at the gate.';
--   end if;
--   update public.trips set gate_check_in_at = now(), gate_check_in_by = auth.uid(),
--     gate_check_in_by_name = v_actor_name, gate_check_out_at = null, gate_check_out_by = null,
--     gate_check_out_by_name = null, gate_delay_reason = null
--   where id = p_trip_id returning * into v_row;
--   insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
--   values (p_trip_id, 'gate_check_in', auth.uid(), v_actor_name, jsonb_build_object('checked_in_at', v_row.gate_check_in_at));
--   return v_row;
-- end;
-- $$;
--
-- -- Restores mark_trip_loaded/reject_trip_load to 0016's versions (guard back to
-- -- 'Waiting for Loading' only) -- re-run 0016's CREATE OR REPLACE statements verbatim.
--
-- alter table public.trips drop constraint if exists trips_status_check;
-- alter table public.trips add constraint trips_status_check
--   check (status in (
--     'Planned', 'Ready for Transporter', 'Waiting for Loading', 'Waiting Driver', 'Loaded',
--     'In Transit', 'Delivered', 'Cancelled', 'Rejected'
--   ));
-- commit;
