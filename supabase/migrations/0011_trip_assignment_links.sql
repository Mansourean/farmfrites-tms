-- WhatsApp redesign: replaces the broken, in-memory-only token/self-service page with a real,
-- durable, secure driver/vehicle assignment link -- plus two new optional Delivery Contact
-- fields on trips for Customer Delivery.
--
-- WHY A SEPARATE TABLE, NOT COLUMNS ON trips (investigated per your request):
-- trips_select (0004) grants SELECT to ALL FOUR active roles (admin/dispatcher/warehouse/
-- viewer), and the grant is table-level, not column-scoped -- RLS is row-level security, not
-- column-level. If the assignment token lived on trips, every authenticated active user
-- (including a read-only Viewer) could retrieve it for any trip they can see with a direct
-- PostgREST call (`select=assignment_token`), even though the app's own UI never requests that
-- column. That defeats the token's purpose: it's meant to be a credential shared with an
-- external, untrusted transporter, not something any logged-in staff account can read.
-- Column-level GRANTs could theoretically wall it off, but that means enumerating every OTHER
-- trips column explicitly forever (fragile -- a future column addition silently stays
-- inaccessible until someone remembers to re-grant it) instead of today's simple blanket
-- table-level grant. Isolating the credential in its own table with RLS enabled and NO
-- policies at all (identical to trip_events' original design) is simpler and strictly safer:
-- nothing except the two SECURITY DEFINER RPCs below can ever read or write it, regardless of
-- role, by construction rather than by remembering to maintain a column allow-list.
--
-- WHY NOT SINGLE-USE (per your correction): the link stays valid and reusable -- the
-- transporter may update Driver Name/Driver Mobile/Truck Plate Number as many times as needed
-- until the trip reaches a terminal status (Loaded, Delivered, Cancelled), checked dynamically
-- at submission time against the trip's current status rather than a one-time "used" flag.
-- No expiry column either, per your explicit "no expiry for the Pilot" instruction.
--
-- create_trip_assignment_link is idempotent (returns the existing row for a trip if one
-- already exists) -- "Send WhatsApp" always resurfaces the same stable, still-valid link
-- rather than minting a new one every click.

begin;

alter table public.trips
  add column if not exists delivery_contact_name text,
  add column if not exists delivery_contact_mobile text;

create table public.trip_assignment_links (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index trip_assignment_links_trip_id_key on public.trip_assignment_links (trip_id);

alter table public.trip_assignment_links enable row level security;

-- Explicit revoke before grant (Supabase's automatic default privileges otherwise hand `anon`/
-- `authenticated` far more than intended on any new table), then grant nothing at all -- not
-- even to authenticated. The two RPCs below are the only way in or out of this table, for
-- every role including admin.
revoke all on public.trip_assignment_links from anon;
revoke all on public.trip_assignment_links from authenticated;
-- (no policies, no grants -- intentional, matches trip_events' original design)

create function public.create_trip_assignment_link(p_trip_id uuid)
returns public.trip_assignment_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_row public.trip_assignment_links;
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
    raise exception 'Not authorized to create an assignment link.';
  end if;

  if not exists (select 1 from public.trips where id = p_trip_id) then
    raise exception 'Trip not found.';
  end if;

  select * into v_row from public.trip_assignment_links where trip_id = p_trip_id;
  if found then
    return v_row;
  end if;

  insert into public.trip_assignment_links (trip_id, created_by)
  values (p_trip_id, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Anonymous-facing read: the transporter's page needs to show the transporter's name and
-- decide whether the form is still open (trip not yet in a terminal status), plus prefill
-- whatever was last submitted so returning to update doesn't start blank. Deliberately returns
-- nothing beyond that -- no other trip fields.
create function public.get_trip_assignment_context(p_token uuid)
returns table (
  transporter_name text,
  is_active boolean,
  driver_name text,
  driver_mobile text,
  plate_no text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  select tal.trip_id into v_trip_id
  from public.trip_assignment_links tal
  where tal.token = p_token;

  if v_trip_id is null then
    return;
  end if;

  return query
  select
    tr.transporter_name,
    (t.status not in ('Loaded', 'Delivered', 'Cancelled')) as is_active,
    t.driver_name,
    t.driver_phone,
    t.plate_no
  from public.trips t
  join public.transporters tr on tr.id = t.transporter_id
  where t.id = v_trip_id;
end;
$$;

-- Anonymous-facing write: the ONLY function anon ever gets INSERT/UPDATE-adjacent access
-- through in this entire schema, and it only ever touches these three columns -- there is no
-- parameter for anything else, so "the transporter may edit nothing but these three fields"
-- is enforced here, not just hidden in the UI.
create function public.submit_driver_assignment(
  p_token uuid,
  p_driver_name text,
  p_driver_mobile text,
  p_plate_no text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_status text;
  v_name text;
  v_mobile text;
  v_plate text;
begin
  select tal.trip_id into v_trip_id
  from public.trip_assignment_links tal
  where tal.token = p_token;

  if v_trip_id is null then
    raise exception 'Link not found.';
  end if;

  select status into v_status
  from public.trips
  where id = v_trip_id
  for update;

  if v_status in ('Loaded', 'Delivered', 'Cancelled') then
    raise exception 'This trip has already been completed. Assignment is closed.';
  end if;

  v_name := trim(p_driver_name);
  v_mobile := trim(p_driver_mobile);
  v_plate := trim(p_plate_no);

  if v_name = '' or v_mobile = '' or v_plate = '' then
    raise exception 'Driver Name, Driver Mobile, and Truck Plate Number are all required.';
  end if;

  update public.trips
  set driver_name = v_name, driver_phone = v_mobile, plate_no = v_plate
  where id = v_trip_id;
end;
$$;

revoke all on function public.create_trip_assignment_link(uuid) from public;
revoke all on function public.create_trip_assignment_link(uuid) from anon;
grant execute on function public.create_trip_assignment_link(uuid) to authenticated;

revoke all on function public.get_trip_assignment_context(uuid) from public;
grant execute on function public.get_trip_assignment_context(uuid) to anon;
grant execute on function public.get_trip_assignment_context(uuid) to authenticated;

revoke all on function public.submit_driver_assignment(uuid, text, text, text) from public;
grant execute on function public.submit_driver_assignment(uuid, text, text, text) to anon;
grant execute on function public.submit_driver_assignment(uuid, text, text, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- revoke execute on function public.create_trip_assignment_link(uuid) from authenticated;
-- revoke execute on function public.get_trip_assignment_context(uuid) from anon;
-- revoke execute on function public.get_trip_assignment_context(uuid) from authenticated;
-- revoke execute on function public.submit_driver_assignment(uuid, text, text, text) from anon;
-- revoke execute on function public.submit_driver_assignment(uuid, text, text, text) from authenticated;
-- drop function if exists public.create_trip_assignment_link(uuid);
-- drop function if exists public.get_trip_assignment_context(uuid);
-- drop function if exists public.submit_driver_assignment(uuid, text, text, text);
-- drop table if exists public.trip_assignment_links;
-- alter table public.trips drop column if exists delivery_contact_name;
-- alter table public.trips drop column if exists delivery_contact_mobile;
-- commit;
-- Note: dropping delivery_contact_name/mobile discards any values already entered in those
-- columns -- confirm before running in production if any real trips have been assigned a
-- delivery contact by then.
