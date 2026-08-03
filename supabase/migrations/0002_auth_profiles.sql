-- Auth Phase: real Supabase Auth for the TMS, preserving the existing
-- admin/dispatcher/warehouse/viewer role model and active/disabled status.
--
-- What this does:
--   1. Creates public.profiles (1:1 with auth.users) to hold full_name, username,
--      role, status — fields Supabase's own auth.users table doesn't have.
--   2. Adds a SECURITY DEFINER helper (public.is_admin()) so RLS policies can check
--      "is the caller an active admin" without recursively re-invoking RLS on the
--      same table.
--   3. RLS: every authenticated user can read their own row (needed for login/
--      routing); admins can read every row (needed for the User Management page).
--      Only the `status` column is writable directly by clients (column-level
--      GRANT, not just a row policy) — full_name/username/role changes must go
--      through the admin-users Edge Function so auth.users.email (derived from
--      username) never drifts out of sync. No insert/delete policy at all: only
--      the service-role Edge Function may create or remove profile rows.
--
-- Does not touch customers/transporters/warehouses/trips or any existing data.
-- Fully additive and reversible (drop function/table to undo).

begin;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  username    text not null,
  role        text not null check (role in ('admin','dispatcher','warehouse','viewer')),
  status      text not null default 'active' check (status in ('active','disabled')),
  created_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness backstop: usernames map 1:1 to synthetic emails,
-- which are case-insensitive in auth.users.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

grant select on public.profiles to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (status) on public.profiles to authenticated;

drop policy if exists profiles_update_status on public.profiles;
create policy profiles_update_status on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

-- ---------------------------------------------------------------------------
-- Bootstrap the first admin (run AFTER creating the user in
-- Supabase Dashboard > Auth > Add User, with the email below).
-- Looked up by email so there's no UUID to copy-paste by hand.
-- ---------------------------------------------------------------------------
-- insert into public.profiles (id, full_name, username, role, status)
-- select id, 'Mansour', 'admin', 'admin', 'active'
-- from auth.users
-- where email = 'admin@tms.farmfrites.internal'
-- on conflict (id) do update set role = 'admin', status = 'active';
