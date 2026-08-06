-- Phase 3 follow-up: adds a real 'Rejected' trip status, driven by real-world Pilot feedback
-- that leaving a rejected trip's status as 'Planned' makes the rejection too easy to miss in
-- the Transportation Log -- a rejected truck needs visible follow-up action from the
-- transportation team, not a status that looks identical to a trip that was never scanned.
--
-- 0007_trip_loading_rpc.sql has ALREADY been applied to production -- this migration does NOT
-- rewrite or re-run it. It only widens the trips.status CHECK constraint (additive, cannot
-- violate any existing row) and replaces reject_trip_load's body/return type via
-- `drop function` + `create function` (a `create or replace` cannot change a function's return
-- type, which is why this needs an explicit drop first -- mark_trip_loaded is NOT touched by
-- this migration at all, its signature/return type/body are unchanged).
--
-- New workflow (approved):
--   Planned --[Reject Load, with a reason]--> Rejected  (atomic: status change + audit event)
--   Planned --[Loaded]--> In Transit                     (unchanged, see 0007)
-- Same eligibility rule as mark_trip_loaded: only a trip currently 'Planned' may be rejected.
-- An ineligible trip (any other current status) gets a clear error and NEITHER the status
-- change NOR the trip_events insert happens -- verified by checking eligibility before any
-- write, same pattern 0007 already used for mark_trip_loaded.
--
-- Existing data: purely additive to the CHECK constraint (widens the allowed set, removes
-- nothing), so no existing row can violate it. No existing row's status or trip_events history
-- is modified by this migration.
--
-- Safety note: unlike 0004's dynamic "drop whatever constraint mentions status" discovery
-- (appropriate there because no constraint existed yet to name), this migration targets the
-- known, specific constraint name by exact name only -- trips_status_check, as created by
-- 0004 and left untouched by every migration since. Confirm the live name/definition via
-- `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid =
-- 'public.trips'::regclass and contype = 'c';` before applying, so any schema drift is
-- caught rather than silently dropping an unexpected constraint.

begin;

alter table public.trips
  drop constraint if exists trips_status_check;

alter table public.trips
  add constraint trips_status_check
  check (status in ('Planned', 'Waiting Driver', 'Loaded', 'In Transit', 'Delivered', 'Cancelled', 'Rejected'));

-- Return type changes from `void` (0007) to `public.trips` (so the frontend can update local
-- state from the real row, same pattern mark_trip_loaded already uses) -- requires a drop
-- first, `create or replace` alone cannot do this.
drop function if exists public.reject_trip_load(uuid, text);

create function public.reject_trip_load(p_trip_id uuid, p_reason text)
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

  -- Row lock: mirrors mark_trip_loaded's guard against a concurrent second action on the
  -- same trip (e.g. one scanner rejecting while another confirms loading at the same time).
  select status into v_previous_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_previous_trip_status <> 'Planned' then
    raise exception 'Trip is not eligible for rejection (current status: %).', v_previous_trip_status;
  end if;

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

-- Dropping a function removes its ACL entries -- re-apply the same double-layer grant pattern
-- used everywhere else in this project (PUBLIC gets EXECUTE by default on create; revoke it).
revoke all on function public.reject_trip_load(uuid, text) from public;
revoke all on function public.reject_trip_load(uuid, text) from anon;
grant execute on function public.reject_trip_load(uuid, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- Note: if any trip has already been rejected under the new workflow (status = 'Rejected')
-- by the time this rollback runs, restoring the narrower CHECK constraint below will fail
-- until those rows are updated to a value the narrower constraint allows -- this is expected,
-- not a bug: a rollback cannot silently discard already-rejected trips' real status.
--
-- begin;
-- revoke execute on function public.reject_trip_load(uuid, text) from authenticated;
-- drop function if exists public.reject_trip_load(uuid, text);
--
-- -- Restores reject_trip_load exactly as applied by 0007 (audit-only, no status mutation):
-- create function public.reject_trip_load(p_trip_id uuid, p_reason text)
-- returns void
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_role text;
--   v_profile_status text;
--   v_actor_name text;
--   v_trip_exists boolean;
-- begin
--   if p_reason is null or length(trim(p_reason)) = 0 then
--     raise exception 'A rejection reason is required.';
--   end if;
--
--   if auth.uid() is null then
--     raise exception 'Authentication required.';
--   end if;
--
--   select role, status, full_name into v_role, v_profile_status, v_actor_name
--   from public.profiles
--   where id = auth.uid();
--
--   if v_role is null then
--     raise exception 'No profile found for the current user.';
--   end if;
--
--   if v_profile_status <> 'active' then
--     raise exception 'Account is not active.';
--   end if;
--
--   if v_role not in ('admin', 'dispatcher', 'warehouse') then
--     raise exception 'Not authorized to reject loading.';
--   end if;
--
--   select true into v_trip_exists from public.trips where id = p_trip_id;
--   if not found then
--     raise exception 'Trip not found.';
--   end if;
--
--   insert into public.trip_events (trip_id, event_type, actor_id, actor_name, reason)
--   values (p_trip_id, 'loading_rejected', auth.uid(), v_actor_name, trim(p_reason));
-- end;
-- $$;
--
-- revoke all on function public.reject_trip_load(uuid, text) from public;
-- revoke all on function public.reject_trip_load(uuid, text) from anon;
-- grant execute on function public.reject_trip_load(uuid, text) to authenticated;
--
-- alter table public.trips drop constraint if exists trips_status_check;
-- alter table public.trips add constraint trips_status_check
--   check (status in ('Planned', 'Waiting Driver', 'Loaded', 'In Transit', 'Delivered', 'Cancelled'));
-- commit;
