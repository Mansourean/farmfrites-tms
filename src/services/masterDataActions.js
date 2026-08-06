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

export async function createTransporter(name) {
  const { data, error } = await supabase.rpc('create_transporter', { p_name: name })
  if (error) throw new Error(error.message)
  return data
}

export async function createWarehouse(name) {
  const { data, error } = await supabase.rpc('create_warehouse', { p_name: name })
  if (error) throw new Error(error.message)
  return data
}

export async function createDestination(name) {
  const { data, error } = await supabase.rpc('create_destination', { p_name: name })
  if (error) throw new Error(error.message)
  return data
}
