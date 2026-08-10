-- Approved "suggested loading date" feature: Farm Frites (Sudair Industrial City) ships to
-- customers spread across Saudi Arabia (soon the wider Gulf), so a trip to a far city
-- genuinely needs to load earlier than one to a nearby city to still hit the customer's
-- requested delivery date. Rather than a full routing/logistics engine, this stores one simple
-- number per destination -- "Transit Days" (realistic travel time, already including a safety
-- buffer -- deliberately not split into separate transit/buffer fields for the Pilot, per
-- approved decision, to keep data entry to a single number per city) -- which the frontend
-- uses to suggest (never force) a Dispatch Date = Requested Delivery Date - Transit Days.
--
-- WHAT CHANGES AND WHY:
--   1. New nullable column public.destinations.transit_days -- purely additive, every existing
--      destination row is unaffected and simply has no suggestion available until someone
--      fills it in.
--   2. create_destination(text) is replaced, not overloaded, by create_destination(text,
--      integer) -- same reasoning 0012/0015 already established for create_transporter/
--      create_customer: a Postgres function is identified by name + argument types, so adding
--      a new two-argument version alongside the old one-argument version would leave both
--      callable in parallel, which is not what "replace" means here. Requires an explicit DROP
--      first (a plain CREATE OR REPLACE cannot add a new parameter), which also clears grants,
--      re-applied at the bottom exactly as 0010 set them.
--   3. p_transit_days defaults to null and is optional -- most destinations won't have a known
--      transit time on day one; the value is simply not required to create a destination, same
--      spirit as 0015 making transporter phone optional. No validation beyond "not negative"
--      -- this is operational data entered by staff who know the real routes, not a value this
--      system has any way to independently verify.
--
-- Editing an existing destination's transit_days later (correcting an estimate) is out of
-- scope for this migration -- no dedicated destinations-management UI exists yet (same
-- limitation already noted for customers/transporters/warehouses in 0009's comments). Only
-- settable at creation time via the inline "+" Add Destination dialog for now.

begin;

alter table public.destinations
  add column if not exists transit_days integer;

drop function if exists public.create_destination(text);

create function public.create_destination(p_name text, p_transit_days integer default null)
returns public.destinations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_name text;
  v_code text;
  v_row public.destinations;
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

  if p_transit_days is not null and p_transit_days < 0 then
    raise exception 'Transit Days cannot be negative.';
  end if;

  if exists (
    select 1 from public.destinations
    where lower(destination_name) = lower(v_name) and coalesce(is_active, true) = true
  ) then
    raise exception 'An active destination named "%" already exists.', v_name;
  end if;

  v_code := 'D' || lpad(nextval('public.destinations_code_seq')::text, 3, '0');

  insert into public.destinations (destination_code, destination_name, is_active, transit_days)
  values (v_code, v_name, true, p_transit_days)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_destination(text, integer) from public;
revoke all on function public.create_destination(text, integer) from anon;
grant execute on function public.create_destination(text, integer) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- drop function if exists public.create_destination(text, integer);
--
-- create function public.create_destination(p_name text)
-- returns public.destinations
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_role text;
--   v_profile_status text;
--   v_name text;
--   v_code text;
--   v_row public.destinations;
-- begin
--   if auth.uid() is null then raise exception 'Authentication required.'; end if;
--   select role, status into v_role, v_profile_status from public.profiles where id = auth.uid();
--   if v_role is null then raise exception 'No profile found for the current user.'; end if;
--   if v_profile_status <> 'active' then raise exception 'Account is not active.'; end if;
--   if v_role not in ('admin', 'dispatcher') then
--     raise exception 'Not authorized to create master data.';
--   end if;
--   v_name := trim(p_name);
--   if v_name = '' then raise exception 'Name is required.'; end if;
--   if exists (
--     select 1 from public.destinations
--     where lower(destination_name) = lower(v_name) and coalesce(is_active, true) = true
--   ) then
--     raise exception 'An active destination named "%" already exists.', v_name;
--   end if;
--   v_code := 'D' || lpad(nextval('public.destinations_code_seq')::text, 3, '0');
--   insert into public.destinations (destination_code, destination_name, is_active)
--   values (v_code, v_name, true)
--   returning * into v_row;
--   return v_row;
-- end;
-- $$;
--
-- revoke all on function public.create_destination(text) from public;
-- revoke all on function public.create_destination(text) from anon;
-- grant execute on function public.create_destination(text) to authenticated;
--
-- alter table public.destinations drop column if exists transit_days;
-- commit;
