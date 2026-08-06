-- Fixes the Phase 2 blocker confirmed against production: public.customers/transporters/
-- warehouses all have RLS enabled with zero policies (pg_policies returned 0 rows for all
-- three), so every authenticated read was silently filtered to an empty result -- not an
-- error, which is why Transportation Log loaded fine while the New Trip dropdowns came back
-- empty. Also confirmed: these three tables carry the same kind of stale, overly broad
-- Supabase default grants (including for `anon`) that 0005_trips_grants_correction.sql
-- already fixed for trips/trip_events -- cleaned up here the same way.
--
-- What this does:
--   1. Revokes the broad default grants from anon (all privileges) and authenticated (all
--      privileges), then grants back exactly SELECT to authenticated -- no INSERT/UPDATE/
--      DELETE, per the requirement that this stay read-only. anon ends up with nothing.
--   2. Adds one SELECT policy per table for authenticated users, gated on the caller having
--      an active profile (`profiles.status = 'active'`) -- the same pattern every other RLS
--      policy in this project already uses (profiles_select, trips_select, trip_events_select
--      in earlier migrations), so a disabled user is blocked here exactly as they already are
--      everywhere else, not just left to an inconsistent `using (true)`. All four roles
--      (admin/dispatcher/warehouse/viewer) need this data for trip creation/display, so there
--      is no role restriction beyond "active".
--
-- Does not disable RLS, does not add any INSERT/UPDATE/DELETE policy, does not change any
-- existing row, does not change any column/table schema, does not touch service_role,
-- postgres, or table ownership.

begin;

revoke all on public.customers from anon;
revoke all on public.customers from authenticated;
grant select on public.customers to authenticated;

revoke all on public.transporters from anon;
revoke all on public.transporters from authenticated;
grant select on public.transporters to authenticated;

revoke all on public.warehouses from anon;
revoke all on public.warehouses from authenticated;
grant select on public.warehouses to authenticated;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

drop policy if exists transporters_select on public.transporters;
create policy transporters_select on public.transporters
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- drop policy if exists customers_select on public.customers;
-- drop policy if exists transporters_select on public.transporters;
-- drop policy if exists warehouses_select on public.warehouses;
-- revoke select on public.customers from authenticated;
-- revoke select on public.transporters from authenticated;
-- revoke select on public.warehouses from authenticated;
-- commit;
-- Note: this intentionally does NOT restore the old broad anon grants -- there's never a
-- reason to want that back, same reasoning as 0005's rollback.
