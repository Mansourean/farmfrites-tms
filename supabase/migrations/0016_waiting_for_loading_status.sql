-- Phase 1 of the approved TMS spec's workflow update: splits the single "Ready for
-- Transporter" stage into two real, distinct operational stages --
--   Ready for Transporter (renamed "Transportation Assignment" in the UI): trip sent to the
--     transporter, waiting for them to submit driver/vehicle.
--   NEW: Waiting for Loading: the transporter has submitted driver/vehicle, truck is now
--     waiting at the factory to be loaded.
-- Loading (mark_trip_loaded/reject_trip_load) should only become possible once a driver/truck
-- actually exist on the trip -- i.e. from Waiting for Loading, not from the moment the trip is
-- merely sent to the transporter.
--
-- WHAT CHANGES AND WHY:
--   1. trips_status_check widened to add 'Waiting for Loading' (additive only, same
--      dynamic-safe pattern as 0008/0013 -- drops and re-adds by the known, confirmed
--      constraint name). Nothing existing removed or renamed at the DB level -- 'Ready for
--      Transporter' itself is NOT renamed in the database; only its UI label changes to
--      "Transportation Assignment" (see frontend tripsMapping.js), so no data migration is
--      needed and every existing row stays valid exactly as stored.
--   2. submit_driver_assignment (0011): after writing driver_name/driver_phone/plate_no, now
--      also transitions the trip from 'Ready for Transporter' to 'Waiting for Loading' --
--      but ONLY when the trip is currently at 'Ready for Transporter'. A re-submission while
--      already at 'Waiting for Loading' (the transporter correcting a typo, say) just updates
--      the fields again, no re-transition, no error. Signature is unchanged (same 4 params,
--      returns void), so this is a plain CREATE OR REPLACE -- no DROP, no grant changes
--      (anon/authenticated keep the same execute grant 0011 already set). The existing
--      terminal-status guard (Loaded/Delivered/Cancelled) is untouched. No dedicated
--      trip_events row is added here for this specific transition -- the generic
--      log_trip_status_change trigger (0013) already logs every status change automatically,
--      and submit_driver_assignment has no richer event of its own to risk duplicating.
--   3. mark_trip_loaded (0013): guard changes from 'Ready for Transporter' to
--      'Waiting for Loading' -- a trip can only be marked Loaded once a driver/truck actually
--      exist on it. Signature/return type unchanged -- plain CREATE OR REPLACE, no grant
--      changes.
--   4. reject_trip_load (0013): same guard change, for the same reason -- rejection at the
--      warehouse only makes sense once a driver/truck were actually assigned. Signature/return
--      type unchanged -- plain CREATE OR REPLACE, no grant changes.
--
-- Backward compatible by construction: no existing row is modified, no column added/removed,
-- no data migrated. A trip currently sitting at 'Ready for Transporter' before this migration
-- runs simply is not loadable/rejectable at the warehouse until its transporter (re-)submits
-- driver/vehicle info (or it's manually advanced via the Status dropdown) -- an operational
-- note for existing in-flight trips, not data loss, exactly the same kind of note 0013's own
-- migration called out for its own guard change.

begin;

alter table public.trips
  drop constraint if exists trips_status_check;

alter table public.trips
  add constraint trips_status_check
  check (status in (
    'Planned', 'Ready for Transporter', 'Waiting for Loading', 'Waiting Driver', 'Loaded',
    'In Transit', 'Delivered', 'Cancelled', 'Rejected'
  ));

create or replace function public.submit_driver_assignment(
  p_token uuid,
  p_driver_name text,
  p_driver_mobile text,
  p_plate_no text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_status text;
  v_name text;
  v_mobile text;
  v_plate text;
begin
  select tal.trip_id into v_trip_id
  from public.trip_assignment_links tal
  where tal.token = p_token;

  if v_trip_id is null then
    raise exception 'Link not found.';
  end if;

  select status into v_status
  from public.trips
  where id = v_trip_id
  for update;

  if v_status in ('Loaded', 'Delivered', 'Cancelled') then
    raise exception 'This trip has already been completed. Assignment is closed.';
  end if;

  v_name := trim(p_driver_name);
  v_mobile := trim(p_driver_mobile);
  v_plate := trim(p_plate_no);

  if v_name = '' or v_mobile = '' or v_plate = '' then
    raise exception 'Driver Name, Driver Mobile, and Truck Plate Number are all required.';
  end if;

  if v_status = 'Ready for Transporter' then
    update public.trips
    set driver_name = v_name, driver_phone = v_mobile, plate_no = v_plate, status = 'Waiting for Loading'
    where id = v_trip_id;
  else
    update public.trips
    set driver_name = v_name, driver_phone = v_mobile, plate_no = v_plate
    where id = v_trip_id;
  end if;
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

  if v_previous_trip_status <> 'Waiting for Loading' then
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

  if v_previous_trip_status <> 'Waiting for Loading' then
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

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- Note: if any trip has already reached 'Waiting for Loading' by the time this rollback runs,
-- restoring the narrower CHECK constraint below will fail until those rows are updated to a
-- value the narrower constraint allows -- expected, same reasoning as 0008/0013's rollbacks.
--
-- begin;
-- create or replace function public.submit_driver_assignment(
--   p_token uuid, p_driver_name text, p_driver_mobile text, p_plate_no text
-- )
-- returns void
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_trip_id uuid;
--   v_status text;
--   v_name text;
--   v_mobile text;
--   v_plate text;
-- begin
--   select tal.trip_id into v_trip_id from public.trip_assignment_links tal where tal.token = p_token;
--   if v_trip_id is null then raise exception 'Link not found.'; end if;
--   select status into v_status from public.trips where id = v_trip_id for update;
--   if v_status in ('Loaded', 'Delivered', 'Cancelled') then
--     raise exception 'This trip has already been completed. Assignment is closed.';
--   end if;
--   v_name := trim(p_driver_name);
--   v_mobile := trim(p_driver_mobile);
--   v_plate := trim(p_plate_no);
--   if v_name = '' or v_mobile = '' or v_plate = '' then
--     raise exception 'Driver Name, Driver Mobile, and Truck Plate Number are all required.';
--   end if;
--   update public.trips set driver_name = v_name, driver_phone = v_mobile, plate_no = v_plate
--   where id = v_trip_id;
-- end;
-- $$;
--
-- -- Restores mark_trip_loaded/reject_trip_load guards to 'Ready for Transporter' (0013's
-- -- version) -- bodies otherwise identical to 0013, omitted here for brevity; re-run 0013's
-- -- CREATE OR REPLACE statements for both functions verbatim.
--
-- alter table public.trips drop constraint if exists trips_status_check;
-- alter table public.trips add constraint trips_status_check
--   check (status in (
--     'Planned', 'Ready for Transporter', 'Waiting Driver', 'Loaded', 'In Transit',
--     'Delivered', 'Cancelled', 'Rejected'
--   ));
-- commit;
