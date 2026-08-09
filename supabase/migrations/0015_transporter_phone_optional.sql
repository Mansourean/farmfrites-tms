-- Reverts 0012's "phone is required" rule for transporter creation, per approved Master Data
-- requirement: the inline "+" Add Transporter dialog now collects Transporter Name only.
--
-- Does NOT edit 0012 -- that migration already ran in production and its file must stay an
-- accurate record of what was actually applied. This is a new, additive migration on top of
-- it, exactly like 0013/0014 were additive on top of 0011/0012.
--
-- Signature is unchanged (create_transporter(text, text), same as 0012 left it), so this is a
-- plain CREATE OR REPLACE -- no DROP, no grant changes needed (grants survive a replace, only a
-- drop clears them; the existing `grant execute ... to authenticated` from 0012 still applies
-- unchanged).
--
-- Phone stays fully supported, just optional: p_phone now defaults to null and, when null or
-- blank, is skipped entirely (stored as null) -- when a phone IS provided, it's still validated/
-- normalized exactly as 0012 defined (Saudi local or international shape, stored digits-only
-- international), so data quality for any phone that does get entered is unchanged.
--
-- Backward compatible by construction: does not touch the transporters table, does not modify
-- or clear any existing row's phone -- a transporter created under 0012's phone-required rule
-- keeps whatever phone it already has. Only what create_transporter requires going forward
-- changes.

begin;

create or replace function public.create_transporter(p_name text, p_phone text default null)
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

  -- Phone is optional (see 0015) -- only validate/normalize when actually provided; a null or
  -- blank value is stored as null, no exception raised.
  if p_phone is not null and trim(p_phone) <> '' then
    v_phone_digits := regexp_replace(p_phone, '\D', '', 'g');
    if v_phone_digits ~ '^05\d{8}$' then
      v_phone := '966' || substring(v_phone_digits from 2);
    elsif v_phone_digits ~ '^9665\d{8}$' then
      v_phone := v_phone_digits;
    else
      raise exception 'Enter a valid Saudi mobile number (e.g. 0512345678 or 966512345678).';
    end if;
  else
    v_phone := null;
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

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if ever needed):
-- ---------------------------------------------------------------------------
-- Restores 0012's exact phone-required body (signature unchanged, so still a plain
-- CREATE OR REPLACE -- no grant changes needed).
-- begin;
-- create or replace function public.create_transporter(p_name text, p_phone text)
-- returns public.transporters
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_role text;
--   v_profile_status text;
--   v_name text;
--   v_phone_digits text;
--   v_phone text;
--   v_code text;
--   v_row public.transporters;
-- begin
--   if auth.uid() is null then
--     raise exception 'Authentication required.';
--   end if;
--   select role, status into v_role, v_profile_status
--   from public.profiles where id = auth.uid();
--   if v_role is null then raise exception 'No profile found for the current user.'; end if;
--   if v_profile_status <> 'active' then raise exception 'Account is not active.'; end if;
--   if v_role not in ('admin', 'dispatcher') then
--     raise exception 'Not authorized to create master data.';
--   end if;
--   v_name := trim(p_name);
--   if v_name = '' then raise exception 'Name is required.'; end if;
--   if p_phone is null or trim(p_phone) = '' then
--     raise exception 'Mobile number is required.';
--   end if;
--   v_phone_digits := regexp_replace(p_phone, '\D', '', 'g');
--   if v_phone_digits ~ '^05\d{8}$' then
--     v_phone := '966' || substring(v_phone_digits from 2);
--   elsif v_phone_digits ~ '^9665\d{8}$' then
--     v_phone := v_phone_digits;
--   else
--     raise exception 'Enter a valid Saudi mobile number (e.g. 0512345678 or 966512345678).';
--   end if;
--   if exists (
--     select 1 from public.transporters
--     where lower(transporter_name) = lower(v_name) and coalesce(is_active, true) = true
--   ) then
--     raise exception 'An active transporter named "%" already exists.', v_name;
--   end if;
--   v_code := 'T' || lpad(nextval('public.transporters_code_seq')::text, 3, '0');
--   insert into public.transporters (transporter_code, transporter_name, phone, is_active)
--   values (v_code, v_name, v_phone, true)
--   returning * into v_row;
--   return v_row;
-- end;
-- $$;
-- commit;
