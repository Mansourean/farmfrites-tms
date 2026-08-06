-- Corrects grants left over from 0004_trips_loading_foundation.sql. That migration only
-- ADDED grants (`grant select on public.trip_events to authenticated`, etc.) without first
-- REVOKing anything — an incorrect assumption that a table with no explicit grant has no
-- privileges. On Supabase, schema-level default privileges automatically hand `anon` and
-- `authenticated` broad access (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) to
-- any table in `public`, independent of what a migration explicitly grants. Confirmed via
-- information_schema.role_table_grants against production: both public.trips (pre-existing)
-- and public.trip_events (created by 0004) carried these stale broad grants for `anon`, and
-- `authenticated` had more than the intended SELECT-only on trip_events.
--
-- This does not change RLS policies (they were already correctly scoped `to authenticated`
-- only, so `anon` was never actually able to read rows despite the loose grants — this closes
-- a latent least-privilege gap, not an active data leak) and does not touch `service_role`,
-- `postgres`, or table ownership — those are untouched by REVOKE statements targeting other
-- roles.
--
-- Reversible: re-running 0004's original (pre-correction) GRANT statements would restore the
-- prior (overly broad) state, but there's no reason to ever want that — the fix below is
-- final, not provisional.

begin;

revoke all on public.trips from anon;
revoke all on public.trips from authenticated;
grant select, insert, update, delete on public.trips to authenticated;

revoke all on public.trip_events from anon;
revoke all on public.trip_events from authenticated;
grant select on public.trip_events to authenticated;

commit;
