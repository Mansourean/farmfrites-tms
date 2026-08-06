import { supabase } from '../lib/supabase'

// Thin wrappers around the Phase 3 warehouse-loading RPCs (see
// supabase/migrations/0007_trip_loading_rpc.sql, 0008_reject_status.sql). Both functions
// re-validate identity/role/active-status and perform their write server-side -- these calls
// carry no trust of their own, they just surface the RPC's result or error to the caller.

export async function markTripLoaded(tripId) {
  const { data, error } = await supabase.rpc('mark_trip_loaded', { p_trip_id: tripId })
  if (error) throw new Error(error.message)
  return data
}

// 0008: reject_trip_load now returns the updated trips row (moved to 'Rejected'), same as
// mark_trip_loaded returns its updated row.
export async function rejectTripLoad(tripId, reason) {
  const { data, error } = await supabase.rpc('reject_trip_load', { p_trip_id: tripId, p_reason: reason })
  if (error) throw new Error(error.message)
  return data
}
