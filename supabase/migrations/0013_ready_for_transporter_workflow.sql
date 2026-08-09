-- New operational workflow: Planned -> Ready for Transporter -> Loaded -> In Transit ->
-- Delivered (Cancelled/Rejected remain available from earlier stages). No 'Closed' status --
-- Delivered is the final operational status, per the approved design.
--
-- WHY 'Waiting Driver' IS KEPT even though the approved status list doesn't mention it: it
-- already exists in production's CHECK constraint and is a real, if rarely used, manually-
-- selectable value. Removing it from the constraint would be a narrowing change that could
-- reject any existing row currently sitting at that status -- a real risk this migration has
-- no way to rule out without a production data check, and "do not silently destroy or reset
-- existing... data" was explicit. Kept as a strict superset addition (same pattern 0004/0008
-- already used), simply no longer part of the new automated flow going forward.
--
-- WHAT CHANGES AND WHY:
--   1. New columns on trips: date_time_confirmed, customer_notified (both booleans, default
--      false -- the two Delivery Confirmation checkboxes) and actual_delivery_date (timestamptz,
--      nullable -- the real arrival time, deliberately separate from delivery_date so recording
--      it never overwrites the originally confirmed date/time).
--   2. trips_status_check widened to add 'Ready for Transporter' (additive only, same dynamic-
--      safe pattern as 0008 -- drops and re-adds by the known, confirmed constraint name).
--   3. mark_trip_loaded: guard changes from 'Planned' to 'Ready for Transporter'; target status
--      changes from 'In Transit' to 'Loaded' (reversing the Phase 3 Pilot simplification that
--      explicitly anticipated this: "If after the Pilot we decide loading confirmation and
--      truck departure need to be separate events, we will change the workflow later.").
--      Signature and return type are unchanged, so this is a plain `create or replace` -- no
--      drop, no grant changes needed (grants survive a replace, only a drop clears them).
--   4. reject_trip_load: guard changes from 'Planned' to 'Ready for Transporter' (rejection now
--      happens at the same stage as loading, matching where a truck actually gets inspected).
--      Status target ('Rejected') and its own rich audit event are unchanged. Signature/return
--      type unchanged -- plain `create or replace`, no grant changes needed.
--   5. New function mark_trip_in_transit: the new Loaded -> In Transit action ("the truck
--      actually leaves"), explicitly NOT automatic -- same SECURITY DEFINER / role-check /
--      row-lock pattern as mark_trip_loaded, admin/dispatcher/warehouse eligible (same
--      operational role set as the other two warehouse-adjacent actions).
--   6. New generic audit trigger (log_trip_status_change) on trips, AFTER UPDATE, firing
--      whenever status actually changes -- this is what makes "every manual status change
--      records who/when" true universally, including the plain admin/dispatcher Status-dropdown
--      edit path in TripPanel.jsx, without needing every current and future code path to
--      remember to log it individually. Writes to the same locked-down trip_events table
--      (still zero direct grants to anon/authenticated -- only SECURITY DEFINER code, now
--      including this trigger, can ever write to it), so "not editable through the normal UI"
--      continues to hold with no grant changes.
--   7. To avoid duplicate audit entries: mark_trip_loaded, reject_trip_load, and
--      mark_trip_in_transit each already write (or, for the first two, already wrote before
--      this migration) their own richer event (loading_confirmed / loading_rejected /
--      departed) with more context than the generic trigger would produce. Each of the three
--      now calls `set_config('app.skip_status_audit', 'true', true)` (transaction-local,
--      third arg true = is_local, so it can never leak to another session or outlive the
--      current call) immediately before their own status UPDATE; the trigger checks this
--      setting and skips its own insert when set. The plain TripPanel Status-dropdown edit
--      path (and the new auto Planned -> Ready for Transporter transition, which is just
--      another ordinary authenticated UPDATE, not a new RPC) never sets this, so the trigger
--      fires normally for those and is the only thing that logs them.
--
-- Backward compatibility: all new columns are nullable or default false -- no existing row is
-- modified. The status CHECK constraint only grows. mark_trip_loaded/reject_trip_load's
-- narrower guard is a genuine behavior change for any trip currently sitting at 'Planned':
-- such a trip will not be loadable/rejectable at the warehouse until it's manually advanced to
-- 'Ready for Transporter' (via the Status dropdown, or by completing the new Delivery
-- Confirmation checkboxes) -- an operational note for existing in-flight trips, not data loss.

begin;

alter table public.trips
  add column if not exists date_time_confirmed boolean not null default false,
  add column if not exists customer_notified boolean not null default false,
  add column if not exists actual_delivery_date timestamptz;

alter table public.trips
  drop constraint if exists trips_status_check;

alter table public.trips
  add constraint trips_status_check
  check (status in (
    'Planned', 'Ready for Transporter', 'Waiting Driver', 'Loaded', 'In Transit',
    'Delivered', 'Cancelled', 'Rejected'
  ));

create or replace function public.log_trip_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.skip_status_audit', true), '') <> 'true'
  then
    select full_name into v_actor_name from public.profiles where id = auth.uid();
    insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
    values (
      new.id,
      'status_changed',
      auth.uid(),
      v_actor_name,
      jsonb_build_object('previous_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trips_status_change_audit on public.trips;
create trigger trips_status_change_audit
  after update on public.trips
  for each row
  execute function public.log_trip_status_change();

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

  if v_previous_trip_status <> 'Ready for Transporter' then
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

  if v_previous_trip_status <> 'Ready for Transporter' then
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

create function public.mark_trip_in_transit(p_trip_id uuid)
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
    raise exception 'Not authorized to update this trip.';
  end if;

  select status into v_previous_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_previous_trip_status <> 'Loaded' then
    raise exception 'Trip is not eligible to move to In Transit (current status: %).', v_previous_trip_status;
  end if;

  perform set_config('app.skip_status_audit', 'true', true);

  update public.trips
  set status = 'In Transit'
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
  values (
    p_trip_id,
    'departed',
    auth.uid(),
    v_actor_name,
    jsonb_build_object('previous_status', v_previous_trip_status, 'new_status', 'In Transit')
  );

  return v_row;
end;
$$;

revoke all on function public.mark_trip_in_transit(uuid) from public;
revoke all on function public.mark_trip_in_transit(uuid) from anon;
grant execute on function public.mark_trip_in_transit(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- Note: if any trip has already reached 'Ready for Transporter' by the time this rollback
-- runs, restoring the narrower CHECK constraint below will fail until those rows are updated
-- to a value the narrower constraint allows -- expected, same reasoning as 0008's rollback.
--
-- begin;
-- drop trigger if exists trips_status_change_audit on public.trips;
-- drop function if exists public.log_trip_status_change();
--
-- revoke execute on function public.mark_trip_in_transit(uuid) from authenticated;
-- drop function if exists public.mark_trip_in_transit(uuid);
--
-- -- Restores mark_trip_loaded exactly as applied by 0007 (Planned -> In Transit directly):
-- create or replace function public.mark_trip_loaded(p_trip_id uuid)
-- returns public.trips
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_role text;
--   v_profile_status text;
--   v_actor_name text;
--   v_previous_trip_status text;
--   v_row public.trips;
-- begin
--   if auth.uid() is null then
--     raise exception 'Authentication required.';
--   end if;
--   select role, status, full_name into v_role, v_profile_status, v_actor_name
--   from public.profiles where id = auth.uid();
--   if v_role is null then raise exception 'No profile found for the current user.'; end if;
--   if v_profile_status <> 'active' then raise exception 'Account is not active.'; end if;
--   if v_role not in ('admin', 'dispatcher', 'warehouse') then
--     raise exception 'Not authorized to confirm loading.';
--   end if;
--   select status into v_previous_trip_status from public.trips where id = p_trip_id for update;
--   if not found then raise exception 'Trip not found.'; end if;
--   if v_previous_trip_status <> 'Planned' then
--     raise exception 'Trip is not eligible for loading confirmation (current status: %).', v_previous_trip_status;
--   end if;
--   update public.trips set status = 'In Transit', loaded_at = now(), loaded_by = auth.uid()
--   where id = p_trip_id returning * into v_row;
--   insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
--   values (p_trip_id, 'loading_confirmed', auth.uid(), v_actor_name,
--     jsonb_build_object('previous_status', v_previous_trip_status, 'new_status', 'In Transit'));
--   return v_row;
-- end;
-- $$;
--
-- -- Restores reject_trip_load's guard to 'Planned' (target status/event unchanged):
-- create or replace function public.reject_trip_load(p_trip_id uuid, p_reason text)
-- returns public.trips
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_role text;
--   v_profile_status text;
--   v_actor_name text;
--   v_previous_trip_status text;
--   v_row public.trips;
-- begin
--   if p_reason is null or length(trim(p_reason)) = 0 then
--     raise exception 'A rejection reason is required.';
--   end if;
--   if auth.uid() is null then raise exception 'Authentication required.'; end if;
--   select role, status, full_name into v_role, v_profile_status, v_actor_name
--   from public.profiles where id = auth.uid();
--   if v_role is null then raise exception 'No profile found for the current user.'; end if;
--   if v_profile_status <> 'active' then raise exception 'Account is not active.'; end if;
--   if v_role not in ('admin', 'dispatcher', 'warehouse') then
--     raise exception 'Not authorized to reject loading.';
--   end if;
--   select status into v_previous_trip_status from public.trips where id = p_trip_id for update;
--   if not found then raise exception 'Trip not found.'; end if;
--   if v_previous_trip_status <> 'Planned' then
--     raise exception 'Trip is not eligible for rejection (current status: %).', v_previous_trip_status;
--   end if;
--   update public.trips set status = 'Rejected' where id = p_trip_id returning * into v_row;
--   insert into public.trip_events (trip_id, event_type, actor_id, actor_name, reason, metadata)
--   values (p_trip_id, 'loading_rejected', auth.uid(), v_actor_name, trim(p_reason),
--     jsonb_build_object('previous_status', v_previous_trip_status, 'new_status', 'Rejected'));
--   return v_row;
-- end;
-- $$;
--
-- alter table public.trips drop constraint if exists trips_status_check;
-- alter table public.trips add constraint trips_status_check
--   check (status in ('Planned', 'Waiting Driver', 'Loaded', 'In Transit', 'Delivered', 'Cancelled', 'Rejected'));
--
-- alter table public.trips drop column if exists date_time_confirmed;
-- alter table public.trips drop column if exists customer_notified;
-- alter table public.trips drop column if exists actual_delivery_date;
-- commit;
