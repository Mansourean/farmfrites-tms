-- Phase 3: moves the Warehouse Loaded/Reject workflow from local/in-memory-only behavior to
-- real, atomic, tamper-resistant Supabase persistence, via two SECURITY DEFINER RPC functions.
-- Approved design (see the Phase 3 report for full reasoning):
--   - mark_trip_loaded transitions a trip directly Planned -> In Transit (the existing
--     operational workflow, preserved as-is for the Pilot -- the DB's 'Loaded' status value
--     is left available for a possible future separate step, not used by this function).
--   - reject_trip_load never changes trip status -- audit-only, matching current behavior.
--
-- Why RPC functions instead of direct client INSERT/UPDATE:
--   - trips_update (0004) only allows admin/dispatcher to UPDATE trips directly -- warehouse
--     has no direct write path today, by design ("warehouse's only future write path is the
--     controlled Loaded/Reject RPC functions planned for a later phase", per 0004's comments).
--     This migration does not change that grant/policy -- warehouse still cannot UPDATE trips
--     or INSERT/UPDATE/DELETE trip_events directly; these two functions remain the only path.
--   - trip_events has NO insert policy and NO insert grant for any role, including admin --
--     also by design, so its history can only ever be written by a trusted server-side
--     function, never edited/backfilled directly through the client API. Unchanged here.
--   - A SECURITY DEFINER function runs as its owner (bypassing RLS on the tables it touches),
--     so it can perform the trips status update + trip_events audit insert as one atomic
--     transaction, while still re-checking the caller's real identity/role/active-status
--     itself before doing anything -- the same trusted-helper pattern already established by
--     public.is_admin() in 0002_auth_profiles.sql.
--
-- Eligible source status for mark_trip_loaded: 'Planned' only. Investigated whether 'Waiting
-- Driver' should also be eligible (a plausible-sounding pre-loading state) and found no
-- evidence it is: it's a status value only ever set manually via the trip edit form's status
-- dropdown, with no automatic linkage to driver assignment anywhere in the app (the
-- "Waiting Driver" badge shown on trip cards is a separate, purely presentational computed
-- badge based on `!trip.driver`, unrelated to this status value). The existing
-- findTripByPlate() warehouse-scan matcher itself only ever surfaces trips with status
-- 'planned' or 'in_transit' -- it already excludes 'waiting_driver' today. So there is no
-- existing business flow that reaches the warehouse scanner from a 'Waiting Driver' trip,
-- and the allowed transition is kept minimal: 'Planned' only, matching mark_trip_loaded's
-- pre-Phase-3 status guard exactly.
--
-- Fixes the current misleading no-op: previously, calling this action on a non-'Planned' trip
-- silently left status unchanged but still logged a "Loaded and verified" event. Now it raises
-- a clear error and performs neither the update nor the trip_events insert.
--
-- Does not add/change any table or column. Does not touch existing RLS policies or grants on
-- trips/trip_events/profiles. Does not touch service_role, postgres, or ownership.

begin;

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

  -- Row lock prevents two concurrent scans of the same trip from both succeeding.
  select status into v_previous_trip_status
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Trip not found.';
  end if;

  if v_previous_trip_status <> 'Planned' then
    raise exception 'Trip is not eligible for loading confirmation (current status: %).', v_previous_trip_status;
  end if;

  update public.trips
  set status = 'In Transit', loaded_at = now(), loaded_by = auth.uid()
  where id = p_trip_id
  returning * into v_row;

  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, metadata)
  values (
    p_trip_id,
    'loading_confirmed',
    auth.uid(),
    v_actor_name,
    jsonb_build_object('previous_status', v_previous_trip_status, 'new_status', 'In Transit')
  );

  return v_row;
end;
$$;

create or replace function public.reject_trip_load(p_trip_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_actor_name text;
  v_trip_exists boolean;
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

  select true into v_trip_exists from public.trips where id = p_trip_id;
  if not found then
    raise exception 'Trip not found.';
  end if;

  -- Deliberately does not touch public.trips -- Reject has never changed trip status in this
  -- app; it is an audit-only annotation that dispatchers act on manually. Preserved exactly.
  insert into public.trip_events (trip_id, event_type, actor_id, actor_name, reason)
  values (p_trip_id, 'loading_rejected', auth.uid(), v_actor_name, trim(p_reason));
end;
$$;

-- Functions get EXECUTE granted to PUBLIC by default on creation -- revoke that and grant only
-- to authenticated, same double-layer pattern as every other grant in this project.
revoke all on function public.mark_trip_loaded(uuid) from public;
revoke all on function public.mark_trip_loaded(uuid) from anon;
grant execute on function public.mark_trip_loaded(uuid) to authenticated;

revoke all on function public.reject_trip_load(uuid, text) from public;
revoke all on function public.reject_trip_load(uuid, text) from anon;
grant execute on function public.reject_trip_load(uuid, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- revoke execute on function public.mark_trip_loaded(uuid) from authenticated;
-- revoke execute on function public.reject_trip_load(uuid, text) from authenticated;
-- drop function if exists public.mark_trip_loaded(uuid);
-- drop function if exists public.reject_trip_load(uuid, text);
-- commit;
-- Purely additive migration (no existing table/column/policy/grant touched), so this rollback
-- carries zero risk to existing data or any other functionality -- it just makes the two new
-- actions unavailable again, reverting Loaded/Reject to being unimplemented at the DB layer.
