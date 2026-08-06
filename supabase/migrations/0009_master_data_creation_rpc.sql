-- Phase 4 (New Trip completeness + inline master-data creation): lets admin/dispatcher create
-- a missing customer/transporter/warehouse from inside the New Trip form without leaving it,
-- via SECURITY DEFINER RPCs -- the same trusted pattern as the Phase 3 warehouse-loading RPCs
-- (0007/0008). customers/transporters/warehouses keep their existing RLS and SELECT-only
-- grants for `authenticated`, zero for `anon` -- nothing about that changes here. These three
-- functions remain the only write path into those tables from the client.
--
-- Confirmed live schema (via information_schema.columns / pg_constraint, run against
-- production before this migration was written):
--   customers:    id uuid, customer_code text UNIQUE (nullable), customer_name text NOT NULL,
--                 city, contact_person, phone, email, is_active boolean, created_at, updated_at
--   transporters: id uuid, transporter_code text UNIQUE (nullable), transporter_name text NOT
--                 NULL, contact_person, phone, email, is_active boolean, created_at, updated_at
--   warehouses:   id uuid, warehouse_code text UNIQUE (nullable), warehouse_name text NOT NULL,
--                 city, address, is_active boolean, created_at, updated_at
-- No UNIQUE constraint exists on any *_name column. Only *_name is NOT NULL among the optional
-- fields, so it's the only one collected by the inline "+" modal this phase (city/contact_
-- person/phone/email/address are left for a future proper master-data management UI, not
-- built here -- keeps the modal to genuinely the minimum required information, per the
-- approved design).
--
-- Code generation: a dedicated SEQUENCE per table, not MAX(code)+1. MAX+1 has a real
-- read-then-write race (two concurrent creates can read the same max and generate the same
-- code before either commits); nextval() is atomic, so two concurrent callers are structurally
-- guaranteed distinct codes. Confirmed current production highs: customer_code C005,
-- transporter_code T004, warehouse_code WH004 -- sequences start one past each, so the very
-- next generated codes are C006 / T005 / WH005, colliding with nothing existing. The existing
-- UNIQUE constraints on the code columns are an independent second layer of protection.
--
-- Duplicate names: no UNIQUE constraint exists on *_name (confirmed), so this is enforced in
-- application logic inside each function -- trimmed, case-insensitive comparison, scoped to
-- *active* rows only, matching the approved "prevent duplicate active names" requirement (a
-- name reused by a previously deactivated record is allowed). `coalesce(is_active, true)` is
-- deliberate: is_active is nullable and current production values were not inspected row by
-- row, so a NULL is treated as active (the safer default -- not silently letting undetected
-- NULLs bypass the duplicate check) while an explicit `false` is treated as inactive. This is
-- an application-level check, not a DB constraint, so it cannot fully close a race between two
-- simultaneous creates of the same brand-new name -- an accepted, low-severity gap explicitly
-- called out rather than oversold as airtight.
--
-- Security, identical pattern to 0007/0008: SECURITY DEFINER, set search_path = public,
-- explicit auth.uid() null check, explicit profile-exists check, explicit active-status check,
-- explicit role check (admin/dispatcher only -- warehouse and viewer excluded, consistent with
-- trips_insert/trips_update in 0004 already restricting direct writes to admin/dispatcher).
-- EXECUTE revoked from public/anon, granted only to authenticated; the function enforces
-- authorization itself, the grant alone is not the boundary.

begin;

create sequence if not exists public.customers_code_seq start with 6;
create sequence if not exists public.transporters_code_seq start with 5;
create sequence if not exists public.warehouses_code_seq start with 5;

create function public.create_customer(p_name text)
returns public.customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_name text;
  v_code text;
  v_row public.customers;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select role, status into v_role, v_profile_status
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'No profile found for the current user.';
  end if;

  if v_profile_status <> 'active' then
    raise exception 'Account is not active.';
  end if;

  if v_role not in ('admin', 'dispatcher') then
    raise exception 'Not authorized to create master data.';
  end if;

  v_name := trim(p_name);
  if v_name = '' then
    raise exception 'Name is required.';
  end if;

  if exists (
    select 1 from public.customers
    where lower(customer_name) = lower(v_name) and coalesce(is_active, true) = true
  ) then
    raise exception 'An active customer named "%" already exists.', v_name;
  end if;

  v_code := 'C' || lpad(nextval('public.customers_code_seq')::text, 3, '0');

  insert into public.customers (customer_code, customer_name, is_active)
  values (v_code, v_name, true)
  returning * into v_row;

  return v_row;
end;
$$;

create function public.create_transporter(p_name text)
returns public.transporters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_name text;
  v_code text;
  v_row public.transporters;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select role, status into v_role, v_profile_status
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'No profile found for the current user.';
  end if;

  if v_profile_status <> 'active' then
    raise exception 'Account is not active.';
  end if;

  if v_role not in ('admin', 'dispatcher') then
    raise exception 'Not authorized to create master data.';
  end if;

  v_name := trim(p_name);
  if v_name = '' then
    raise exception 'Name is required.';
  end if;

  if exists (
    select 1 from public.transporters
    where lower(transporter_name) = lower(v_name) and coalesce(is_active, true) = true
  ) then
    raise exception 'An active transporter named "%" already exists.', v_name;
  end if;

  v_code := 'T' || lpad(nextval('public.transporters_code_seq')::text, 3, '0');

  insert into public.transporters (transporter_code, transporter_name, is_active)
  values (v_code, v_name, true)
  returning * into v_row;

  return v_row;
end;
$$;

create function public.create_warehouse(p_name text)
returns public.warehouses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_name text;
  v_code text;
  v_row public.warehouses;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select role, status into v_role, v_profile_status
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'No profile found for the current user.';
  end if;

  if v_profile_status <> 'active' then
    raise exception 'Account is not active.';
  end if;

  if v_role not in ('admin', 'dispatcher') then
    raise exception 'Not authorized to create master data.';
  end if;

  v_name := trim(p_name);
  if v_name = '' then
    raise exception 'Name is required.';
  end if;

  if exists (
    select 1 from public.warehouses
    where lower(warehouse_name) = lower(v_name) and coalesce(is_active, true) = true
  ) then
    raise exception 'An active warehouse named "%" already exists.', v_name;
  end if;

  v_code := 'WH' || lpad(nextval('public.warehouses_code_seq')::text, 3, '0');

  insert into public.warehouses (warehouse_code, warehouse_name, is_active)
  values (v_code, v_name, true)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_customer(text) from public;
revoke all on function public.create_customer(text) from anon;
grant execute on function public.create_customer(text) to authenticated;

revoke all on function public.create_transporter(text) from public;
revoke all on function public.create_transporter(text) from anon;
grant execute on function public.create_transporter(text) to authenticated;

revoke all on function public.create_warehouse(text) from public;
revoke all on function public.create_warehouse(text) from anon;
grant execute on function public.create_warehouse(text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- revoke execute on function public.create_customer(text) from authenticated;
-- revoke execute on function public.create_transporter(text) from authenticated;
-- revoke execute on function public.create_warehouse(text) from authenticated;
-- drop function if exists public.create_customer(text);
-- drop function if exists public.create_transporter(text);
-- drop function if exists public.create_warehouse(text);
-- drop sequence if exists public.customers_code_seq;
-- drop sequence if exists public.transporters_code_seq;
-- drop sequence if exists public.warehouses_code_seq;
-- commit;
-- Purely additive (no existing table/column/policy/grant touched) -- rows already created via
-- these functions before a rollback are unaffected; only the ability to create more is removed.
