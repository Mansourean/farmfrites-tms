-- Closes a real gap in 0017: Transit Days was only ever settable at destination *creation*
-- time (via the inline "+" dialog), so it could never be added to any destination that already
-- existed before 0017 shipped -- which is every destination currently in production (they all
-- predate this feature). Confirmed as the actual reason the Loading Date suggestion "does
-- nothing" in practice: it silently has no effect for a destination whose transit_days is
-- still null, and there was no way to fix that after the fact.
--
-- Same minimal pattern as 0002's `grant update (status) on public.profiles` -- a column-scoped
-- GRANT plus an RLS policy restricted to that one column's update, rather than a dedicated RPC.
-- admin/dispatcher only (matches create_destination's own role check in 0009/0017) -- no other
-- column on destinations becomes writable by this (name/code/is_active stay exactly as
-- protected as before: no UPDATE grant on them at all for authenticated).

begin;

grant update (transit_days) on public.destinations to authenticated;

drop policy if exists destinations_update_transit_days on public.destinations;
create policy destinations_update_transit_days on public.destinations
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active' and p.role in ('admin', 'dispatcher')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active' and p.role in ('admin', 'dispatcher')
    )
  );

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- drop policy if exists destinations_update_transit_days on public.destinations;
-- revoke update (transit_days) on public.destinations from authenticated;
-- commit;
