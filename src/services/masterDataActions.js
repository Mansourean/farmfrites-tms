import { supabase } from '../lib/supabase'

// Thin wrappers around the Phase 4 master-data-creation RPCs (see
// supabase/migrations/0009_master_data_creation_rpc.sql). Each RPC re-validates identity/role/
// active-status and generates the record's code server-side (a sequence, never client-
// supplied) -- these calls carry no trust of their own, they just surface the RPC's result or
// error to the caller.

export async function createCustomer(name) {
  const { data, error } = await supabase.rpc('create_customer', { p_name: name })
  if (error) throw new Error(error.message)
  return data
}

// phone is optional (see 0015 -- 0012's phone-required rule was reverted): the inline "+" Add
// Transporter dialog no longer collects it, so this is normally called name-only; the RPC
// itself still accepts and validates a phone if one is ever passed.
export async function createTransporter(name, phone = null) {
  const { data, error } = await supabase.rpc('create_transporter', { p_name: name, p_phone: phone })
  if (error) throw new Error(error.message)
  return data
}

export async function createWarehouse(name) {
  const { data, error } = await supabase.rpc('create_warehouse', { p_name: name })
  if (error) throw new Error(error.message)
  return data
}

// transit_days is optional (see 0017) -- most destinations won't have a known transit time on
// day one, so this is normally called name-only.
export async function createDestination(name, transitDays = null) {
  const { data, error } = await supabase.rpc('create_destination', { p_name: name, p_transit_days: transitDays })
  if (error) throw new Error(error.message)
  return data
}
