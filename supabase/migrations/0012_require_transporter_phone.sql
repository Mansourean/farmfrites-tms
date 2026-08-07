-- WhatsApp assignment depends on transporters.phone (0011 addresses the wa.me link to it).
-- create_transporter (0009) only ever collected a name, so most/all transporters created
-- through the app so far likely have no phone on file. This migration makes phone a required
-- part of transporter creation going forward so the gap can't keep growing.
--
-- create_transporter(text) is replaced, not just overloaded, by create_transporter(text,
-- text): a Postgres function is identified by name + argument types, so simply adding a new
-- two-argument version would leave the old name-only one callable in parallel, silently
-- defeating "phone is now required." Dropping the old signature first closes that path.
--
-- Phone format: accepts either Saudi local (05XXXXXXXX, 10 digits) or international
-- (9665XXXXXXXX, 12 digits) once punctuation/spaces are stripped, and always stores the
-- normalized international digits-only form -- the exact shape a wa.me link needs (see
-- toWhatsappDigits in lib/whatsappMessage.js), so a stored number is always ready to use as
-- soon as it's read back. Validated here, not just in the UI (lib/phone.js's client-side
-- check is UX-only) -- this RPC is the real boundary, same as every other check in it.
--
-- Backward compatible by construction: this only changes what create_transporter requires
-- going forward. It does not touch the transporters table, does not add a NOT NULL constraint
-- on phone, and does not read, validate, or modify any existing row -- a transporter created
-- before this migration (phone null or in some other format) is completely unaffected.
--
-- Only public.transporters is touched -- create_customer/create_warehouse/create_destination
-- (0009/0010) are unchanged; nothing about this migration affects them.

begin;

drop function if exists public.create_transporter(text);

create function public.create_transporter(p_name text, p_phone text)
returns public.transporters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_profile_status text;
  v_name text;
  v_phone_digits text;
  v_phone text;
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

  if p_phone is null or trim(p_phone) = '' then
    raise exception 'Mobile number is required.';
  end if;

  -- Strip everything but digits, then accept either Saudi local (05XXXXXXXX) or
  -- international (9665XXXXXXXX) shape -- always store the normalized international form.
  v_phone_digits := regexp_replace(p_phone, '\D', '', 'g');
  if v_phone_digits ~ '^05\d{8}$' then
    v_phone := '966' || substring(v_phone_digits from 2);
  elsif v_phone_digits ~ '^9665\d{8}$' then
    v_phone := v_phone_digits;
  else
    raise exception 'Enter a valid Saudi mobile number (e.g. 0512345678 or 966512345678).';
  end if;

  if exists (
    select 1 from public.transporters
    where lower(transporter_name) = lower(v_name) and coalesce(is_active, true) = true
  ) then
    raise exception 'An active transporter named "%" already exists.', v_name;
  end if;

  v_code := 'T' || lpad(nextval('public.transporters_code_seq')::text, 3, '0');

  insert into public.transporters (transporter_code, transporter_name, phone, is_active)
  values (v_code, v_name, v_phone, true)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_transporter(text, text) from public;
revoke all on function public.create_transporter(text, text) from anon;
grant execute on function public.create_transporter(text, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- begin;
-- revoke execute on function public.create_transporter(text, text) from authenticated;
-- drop function if exists public.create_transporter(text, text);
--
-- create function public.create_transporter(p_name text)
-- returns public.transporters
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_role text;
--   v_profile_status text;
--   v_name text;
--   v_code text;
--   v_row public.transporters;
-- begin
--   if auth.uid() is null then
--     raise exception 'Authentication required.';
--   end if;
--
--   select role, status into v_role, v_profile_status
--   from public.profiles
--   where id = auth.uid();
--
--   if v_role is null then
--     raise exception 'No profile found for the current user.';
--   end if;
--
--   if v_profile_status <> 'active' then
--     raise exception 'Account is not active.';
--   end if;
--
--   if v_role not in ('admin', 'dispatcher') then
--     raise exception 'Not authorized to create master data.';
--   end if;
--
--   v_name := trim(p_name);
--   if v_name = '' then
--     raise exception 'Name is required.';
--   end if;
--
--   if exists (
--     select 1 from public.transporters
--     where lower(transporter_name) = lower(v_name) and coalesce(is_active, true) = true
--   ) then
--     raise exception 'An active transporter named "%" already exists.', v_name;
--   end if;
--
--   v_code := 'T' || lpad(nextval('public.transporters_code_seq')::text, 3, '0');
--
--   insert into public.transporters (transporter_code, transporter_name, is_active)
--   values (v_code, v_name, true)
--   returning * into v_row;
--
--   return v_row;
-- end;
-- $$;
--
-- revoke all on function public.create_transporter(text) from public;
-- revoke all on function public.create_transporter(text) from anon;
-- grant execute on function public.create_transporter(text) to authenticated;
-- commit;
-- Note: this restores 0009's exact original function (phone optional again) -- does not
-- remove phone values already stored on transporters created under the new required-phone
-- version.
