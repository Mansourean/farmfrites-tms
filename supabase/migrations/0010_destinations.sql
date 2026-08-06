-- Pilot prep: adds a real, reusable `destinations` master-data table for Customer Delivery
-- trips, replacing the free-text Destination input in New Trip with a dropdown -- so
-- destinations stop being typed slightly differently on every trip. Confirmed against
-- production (information_schema.tables filtered on '%destination%') that no such table, or
-- anything like it, existed before this migration.
--
-- Mirrors customers/transporters/warehouses exactly: same column shape (code/name/is_active/
-- timestamps), same RLS pattern (SELECT-only for authenticated, zero for anon), same
-- SECURITY DEFINER creation RPC pattern as create_customer/create_transporter/create_warehouse
-- (0009), same sequence-based code generation as those three (0009) -- prefix 'D' this time
-- (D001, D002, ...), a new convention since no prior precedent existed for this entity.
--
-- Deliberately NOT a foreign key on trips: trips.destination stays exactly as it already is
-- (a free text column) -- Customer Delivery now resolves the *name* of the chosen destination
-- into that same column, identical to how Internal Transfer already resolves its chosen
-- Destination Warehouse's name into trips.destination. No new column on trips, no
-- destination_id anywhere -- consistent with the existing "don't invent trips columns" rule.
--
-- Deliberately NOT seeded from existing trips.destination values -- current production trips
-- are confirmed test data that will be cleaned before Pilot, so seeding real-looking rows from
-- them now would just create noise to clean up later. destinations starts empty; admin/
-- dispatcher populate it via the inline "+" as real trips are entered.
--
-- Frontend safety net (not part of this SQL, noted here for context): since every existing
-- trip's destination predates this table, TripPanel's edit form must never silently replace an
-- unmatched existing destination with the first list item -- it injects the trip's current text
-- as a synthetic, already-selected option instead, so opening an old trip and saving without
-- touching Destination never loses data.

begin;

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  destination_code text unique,
  destination_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.destinations enable row level security;

-- Explicit revoke before grant, same reasoning as every other table in this project: Supabase's
-- automatic schema-level default privileges would otherwise hand `anon`/`authenticated` far
-- more than intended on a newly created table.
revoke all on public.destinations from anon;
revoke all on public.destinations from authenticated;
grant select on public.destinations to authenticated;

create policy destinations_select on public.destinations
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

create sequence public.destinations_code_seq start with 1;

create function public.create_destination(p_name text)
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

  if exists (
    select 1 from public.destinations
    where lower(destination_name) = lower(v_name) and coalesce(is_active, true) = true
  ) then
    raise exception 'An active destination named "%" already exists.', v_name;
  end if;

  v_code := 'D' || lpad(nextval('public.destinations_code_seq')::text, 3, '0');

  insert into public.destinations (destination_code, destination_name, is_active)
  values (v_code, v_name, true)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_destination(text) from public;
revoke all on function public.create_destination(text) from anon;
grant execute on function public.create_destination(text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- revoke execute on function public.create_destination(text) from authenticated;
-- drop function if exists public.create_destination(text);
-- drop sequence if exists public.destinations_code_seq;
-- drop policy if exists destinations_select on public.destinations;
-- drop table if exists public.destinations;
-- commit;
-- Note: dropping public.destinations does NOT touch trips or trips.destination -- that column
-- is untouched by this entire migration and remains exactly as it was (free text), so a
-- rollback loses only the reusable destinations list and the "+" creation ability, not any
-- trip data.
