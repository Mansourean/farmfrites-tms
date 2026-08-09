-- Adds read-only trip context to the public transporter assignment page (0011's
-- DriverAssignment.jsx), per approved requirement: show Sales No, Customer, Destination,
-- Delivery Date & Time, and Receiver Mobile (only if available) above the driver/vehicle
-- fields, so the transporter can confirm they're assigning the right trip before submitting.
--
-- Security is unchanged, not weakened: get_trip_assignment_context is, and remains, a
-- read-only RPC -- it still only resolves a valid token to its trip_id server-side, same as
-- before. submit_driver_assignment (not touched by this migration) remains the only write
-- path available to anon, and it still only ever accepts/writes driver_name/driver_phone/
-- plate_no -- the transporter still cannot edit any trip information, enforced by that
-- function's parameter list, not by the UI.
--
-- get_trip_assignment_context's return type is changing (new output columns), so this requires
-- an explicit DROP before CREATE (a plain CREATE OR REPLACE cannot change a function's return
-- type) -- which also clears its grants, re-applied at the bottom exactly as 0011 set them.

begin;

drop function if exists public.get_trip_assignment_context(uuid);

create function public.get_trip_assignment_context(p_token uuid)
returns table (
  transporter_name text,
  is_active boolean,
  driver_name text,
  driver_mobile text,
  plate_no text,
  sales_no text,
  customer_name text,
  destination text,
  delivery_date timestamptz,
  delivery_contact_mobile text
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
    t.plate_no,
    t.sales_no,
    c.customer_name,
    t.destination,
    t.delivery_date,
    t.delivery_contact_mobile
  from public.trips t
  join public.transporters tr on tr.id = t.transporter_id
  left join public.customers c on c.id = t.customer_id
  where t.id = v_trip_id;
end;
$$;

revoke all on function public.get_trip_assignment_context(uuid) from public;
grant execute on function public.get_trip_assignment_context(uuid) to anon;
grant execute on function public.get_trip_assignment_context(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- drop function if exists public.get_trip_assignment_context(uuid);
--
-- create function public.get_trip_assignment_context(p_token uuid)
-- returns table (
--   transporter_name text,
--   is_active boolean,
--   driver_name text,
--   driver_mobile text,
--   plate_no text
-- )
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_trip_id uuid;
-- begin
--   select tal.trip_id into v_trip_id from public.trip_assignment_links tal where tal.token = p_token;
--   if v_trip_id is null then return; end if;
--   return query
--   select tr.transporter_name, (t.status not in ('Loaded', 'Delivered', 'Cancelled')) as is_active,
--     t.driver_name, t.driver_phone, t.plate_no
--   from public.trips t
--   join public.transporters tr on tr.id = t.transporter_id
--   where t.id = v_trip_id;
-- end;
-- $$;
--
-- revoke all on function public.get_trip_assignment_context(uuid) from public;
-- grant execute on function public.get_trip_assignment_context(uuid) to anon;
-- grant execute on function public.get_trip_assignment_context(uuid) to authenticated;
-- commit;
