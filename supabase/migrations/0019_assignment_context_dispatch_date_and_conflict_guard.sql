-- Two related fixes to the transporter assignment flow, both requested directly:
--
-- 1. get_trip_assignment_context (0011/0014) never returned dispatch_date (Loading Date) --
--    the public assignment page only ever showed one date, labeled "Delivery Date & Time",
--    with no Loading Date visible at all. This is a genuine functional gap, not cosmetic: the
--    transporter has no way to know when the truck must be at the factory vs. when the goods
--    must reach the client. Return type is changing (new output column), so this requires an
--    explicit DROP before CREATE -- same pattern as 0014 itself -- which clears its grants,
--    re-applied at the bottom exactly as before.
--
-- 2. submit_driver_assignment (0011/0016) never checked whether the driver/vehicle being
--    submitted was already committed to a different active trip on the same Loading Date --
--    a transporter could accidentally double-book a driver or truck across two trips loading
--    the same day. Adds a same-Loading-Date conflict check (same plate_no OR same
--    driver_phone, on another trip that isn't already Delivered/Cancelled/Rejected) that
--    blocks the submission with a clear error message. Only runs when the trip actually has a
--    dispatch_date set -- if Loading Date isn't known yet, there is nothing meaningful to
--    compare, so the check is skipped rather than guessed at. Signature (4 params, returns
--    void) is unchanged, so this is a plain CREATE OR REPLACE -- no grant changes needed.

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
  dispatch_date timestamptz,
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
    t.dispatch_date,
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

create or replace function public.submit_driver_assignment(
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
  v_dispatch_date timestamptz;
  v_name text;
  v_mobile text;
  v_plate text;
  v_conflict_sales_no text;
begin
  select tal.trip_id into v_trip_id
  from public.trip_assignment_links tal
  where tal.token = p_token;

  if v_trip_id is null then
    raise exception 'Link not found.';
  end if;

  select status, dispatch_date into v_status, v_dispatch_date
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

  -- Same-Loading-Date duplicate driver/vehicle guard: only meaningful once this trip actually
  -- has a Loading Date -- skipped otherwise (nothing to compare against).
  if v_dispatch_date is not null then
    select t2.sales_no into v_conflict_sales_no
    from public.trips t2
    where t2.id <> v_trip_id
      and t2.dispatch_date = v_dispatch_date
      and t2.status not in ('Delivered', 'Cancelled', 'Rejected')
      and (
        upper(trim(t2.plate_no)) = upper(v_plate)
        or t2.driver_phone = v_mobile
      )
    limit 1;

    if v_conflict_sales_no is not null then
      raise exception 'This driver or vehicle is already assigned to trip % on the same Loading Date.', v_conflict_sales_no;
    end if;
  end if;

  if v_status = 'Ready for Transporter' then
    update public.trips
    set driver_name = v_name, driver_phone = v_mobile, plate_no = v_plate, status = 'Waiting for Loading'
    where id = v_trip_id;
  else
    update public.trips
    set driver_name = v_name, driver_phone = v_mobile, plate_no = v_plate
    where id = v_trip_id;
  end if;
end;
$$;

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
--   plate_no text,
--   sales_no text,
--   customer_name text,
--   destination text,
--   delivery_date timestamptz,
--   delivery_contact_mobile text
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
--     t.driver_name, t.driver_phone, t.plate_no, t.sales_no, c.customer_name, t.destination,
--     t.delivery_date, t.delivery_contact_mobile
--   from public.trips t
--   join public.transporters tr on tr.id = t.transporter_id
--   left join public.customers c on c.id = t.customer_id
--   where t.id = v_trip_id;
-- end;
-- $$;
--
-- revoke all on function public.get_trip_assignment_context(uuid) from public;
-- grant execute on function public.get_trip_assignment_context(uuid) to anon;
-- grant execute on function public.get_trip_assignment_context(uuid) to authenticated;
--
-- -- Restores submit_driver_assignment to 0016's version (no conflict guard) -- re-run 0016's
-- -- CREATE OR REPLACE statement for this function verbatim.
-- commit;
