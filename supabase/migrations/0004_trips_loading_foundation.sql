-- Phase 1 of the trips-to-Supabase migration: database foundation only. Prepares the schema
-- for the future Loaded/Reject warehouse workflow and a real, tamper-resistant audit trail.
-- No frontend code changes accompany this migration — TripsContext.jsx keeps running on
-- localStorage until a later phase switches it over.
--
-- What this does:
--   1. Adds trips.loaded_at / trips.loaded_by (nullable) — who confirmed loading, and when.
--   2. Widens the trips.status CHECK constraint to add 'Loaded', preserving every existing
--      allowed value and its exact capitalization/wording as manually confirmed against
--      production ('Planned', 'Waiting Driver', 'In Transit', 'Delivered', 'Cancelled') — this
--      is a strict superset, nothing existing is removed or renamed. The constraint is still
--      dropped and re-added dynamically (by discovering its actual name via pg_constraint, the
--      same technique 0001_phase1_reference_data.sql already uses for FK constraints) rather
--      than assuming a name, since the name itself was never inspected — only the value list
--      was. Safe regardless: public.trips currently has 0 rows, so there is no existing data
--      that could violate the new constraint either way.
--   3. Creates public.trip_events — a dedicated, append-only audit table. Deliberately NOT a
--      JSON column on trips: a real FK from actor_id to auth.users(id) is the only way to
--      cryptographically tie an event to the authenticated user who performed it, rather than
--      trusting a client-supplied name string (which is exactly what the current localStorage
--      timeline does today, and which is the whole problem this table exists to fix).
--   4. RLS on trips: SELECT open to all four active roles (admin/dispatcher/warehouse/viewer).
--      INSERT/UPDATE/DELETE preserve the current app's intended behavior for admin and
--      dispatcher (both already have create/edit/delete trip UI today), and grant NONE of
--      those to warehouse or viewer — warehouse's only future write path is the controlled
--      Loaded/Reject RPC functions planned for a later phase, deliberately not built yet.
--   5. RLS on trip_events: SELECT open to the same four active roles (so, e.g., a Warehouse
--      Operator can see a trip's prior loading/rejection history). No INSERT/UPDATE/DELETE
--      policy for ANY role, including admin — this table is meant to be written only by
--      future SECURITY DEFINER functions, not directly by any client, so its history can't be
--      edited or backfilled by anyone through the API. Table-level grants mirror this: SELECT
--      only, nothing else, as a second, independent layer of the same restriction — explicit
--      REVOKEs precede the GRANTs so Supabase's automatic default privileges for new tables
--      (which otherwise hand `anon` and `authenticated` far more than intended) don't linger.
--
-- Explicitly out of scope for this migration (by design, per the agreed phased plan):
--   - No frontend changes, no localStorage data migration.
--   - No SECURITY DEFINER functions (the Loaded/Reject RPCs belong to a later phase).
--   - No changes to trip_type, driver/vehicle columns, or any column beyond loaded_at/loaded_by.
--   - No changes to Dispatcher's existing effective permissions (preserved as today's app
--     already intends: full create/edit/delete), and no changes to Viewer or Admin.
--
-- Reversible — see the rollback block at the bottom of this file.

begin;

alter table public.trips
  add column if not exists loaded_at timestamptz,
  add column if not exists loaded_by uuid references auth.users(id) on delete set null;

do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.trips drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.trips
  add constraint trips_status_check
  check (status in ('Planned', 'Waiting Driver', 'Loaded', 'In Transit', 'Delivered', 'Cancelled'));

create table if not exists public.trip_events (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  event_type  text not null,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_name  text,
  reason      text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- event_type is deliberately NOT constrained to a fixed list — this table must keep accepting
-- new event kinds (trip_created, loading_confirmed, loading_rejected, ...) as the workflow
-- grows, without a migration every time. Indexed since "all events for this trip" is the
-- primary access pattern (trip detail / timeline view).
create index if not exists trip_events_trip_id_idx on public.trip_events (trip_id);

alter table public.trips enable row level security;
alter table public.trip_events enable row level security;

-- Supabase pre-configures schema-level default privileges that automatically grant broad
-- access (including to `anon`) to any new table, independent of the GRANTs below — and
-- `trips` already existed before this migration, so it may carry the same kind of stale
-- default grants from whenever it was first created. Revoke everything from anon/authenticated
-- on both tables first, so only exactly the intended privileges end up in effect.
revoke all on public.trips from anon;
revoke all on public.trips from authenticated;
revoke all on public.trip_events from anon;
revoke all on public.trip_events from authenticated;

grant select, insert, update, delete on public.trips to authenticated;
grant select on public.trip_events to authenticated;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher', 'warehouse', 'viewer')
    )
  );

drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher')
    )
  );

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher')
    )
  );

drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher')
    )
  );

drop policy if exists trip_events_select on public.trip_events;
create policy trip_events_select on public.trip_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
        and p.role in ('admin', 'dispatcher', 'warehouse', 'viewer')
    )
  );

-- No insert/update/delete policy on trip_events for any role, and no such grant either
-- (see the explicit REVOKE + GRANT statements above) — intentional, on both layers
-- independently.

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- drop policy if exists trip_events_select on public.trip_events;
-- drop policy if exists trips_delete on public.trips;
-- drop policy if exists trips_update on public.trips;
-- drop policy if exists trips_insert on public.trips;
-- drop policy if exists trips_select on public.trips;
-- revoke insert, update, delete on public.trips from authenticated;
-- revoke select on public.trips from authenticated;
-- revoke select on public.trip_events from authenticated;
-- drop table if exists public.trip_events;
-- alter table public.trips drop constraint if exists trips_status_check;
-- -- Restores the exact pre-migration allowed set (manually confirmed against production
-- -- before this migration was written) -- i.e. everything except the newly added 'Loaded'.
-- alter table public.trips add constraint trips_status_check
--   check (status in ('Planned', 'Waiting Driver', 'In Transit', 'Delivered', 'Cancelled'));
-- alter table public.trips drop column if exists loaded_by;
-- alter table public.trips drop column if exists loaded_at;
-- commit;
