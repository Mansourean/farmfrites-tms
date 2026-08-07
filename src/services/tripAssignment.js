import { supabase } from '../lib/supabase'

// Thin wrappers around the driver/vehicle assignment RPCs (see
// supabase/migrations/0011_trip_assignment_links.sql). createAssignmentLink requires an
// authenticated admin/dispatcher session; the other two are also callable anonymously by the
// transporter's own browser (no session) -- neither carries any trust of its own, the RPC
// re-validates everything server-side.

export async function createAssignmentLink(tripId) {
  const { data, error } = await supabase.rpc('create_trip_assignment_link', { p_trip_id: tripId })
  if (error) throw new Error(error.message)
  return data
}

export async function getAssignmentContext(token) {
  const { data, error } = await supabase.rpc('get_trip_assignment_context', { p_token: token })
  if (error) throw new Error(error.message)
  // The RPC returns a table (array) with zero or one row -- zero means an unknown token.
  return data?.[0] ?? null
}

export async function submitDriverAssignment(token, { driverName, driverMobile, plateNo }) {
  const { error } = await supabase.rpc('submit_driver_assignment', {
    p_token: token,
    p_driver_name: driverName,
    p_driver_mobile: driverMobile,
    p_plate_no: plateNo,
  })
  if (error) throw new Error(error.message)
}
