-- Phase 1 of the Edge-Function-based username login redesign: prepares the profile layer to
-- hold each employee's real Supabase Auth email, so a later login-resolution step (Phase 2)
-- can look it up server-side without ever exposing it to an unauthenticated browser.
--
-- What this does:
--   1. Adds public.profiles.email (nullable) — a denormalized copy of auth.users.email.
--      Nullable is deliberate: the existing admin-users Edge Function's `create` action does
--      not yet set this column (that's Phase 2/3 work), so a NOT NULL constraint here would
--      break user creation before this migration's dependent code ships. Tighten to NOT NULL
--      in a later migration once create/update always supplies it.
--   2. Backfills profiles.email from auth.users.email by matching the shared UUID
--      (profiles.id = auth.users.id) — covers every existing profile, including the current
--      admin account (mansourean@gmail.com), with no manual per-row action needed.
--   3. Adds a case-insensitive unique index on email (partial: only where email is not null),
--      mirroring the existing profiles_username_lower_idx pattern, so two profiles can never
--      collide on the same address once populated.
--   4. Adds a trigger on auth.users that keeps profiles.email in sync whenever an email
--      changes there — including changes made directly in the Supabase Dashboard (exactly how
--      the current admin/mansourean@gmail.com mismatch happened in the first place).
--
-- What this deliberately does NOT do:
--   - Does not change login behavior. AuthContext.jsx still derives a synthetic email exactly
--     as it does today; nothing reads profiles.email yet.
--   - Does not touch auth.users data, usernames, roles, passwords, or auth user IDs — only
--     reads auth.users (for backfill) and listens to it (for the sync trigger); the only
--     table ever written to by this migration's logic is public.profiles.
--   - Does not add any new grant to the anon or authenticated roles. profiles.email inherits
--     the exact same row-level policy as every other profiles column already does
--     (profiles_select: id = auth.uid() or public.is_admin()) — an employee can read their own
--     email, an admin can read everyone's, nobody else can read anyone else's, and anonymous
--     (unauthenticated) callers still have zero access to public.profiles at all, exactly as
--     before this migration.
--
-- Safe to re-run: column/index/trigger creation are guarded, and the backfill UPDATE only
-- touches rows where the value actually differs.
-- Fully additive and reversible — see rollback notes at the bottom.

begin;

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_profile_email() from public;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed — none of this touches or risks auth.users data):
-- ---------------------------------------------------------------------------
-- begin;
-- drop trigger if exists on_auth_user_email_updated on auth.users;
-- drop function if exists public.sync_profile_email();
-- drop index if exists public.profiles_email_lower_idx;
-- alter table public.profiles drop column if exists email;
-- commit;
