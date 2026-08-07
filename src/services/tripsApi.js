import { supabase } from '../lib/supabase'

const TRIPS_COLUMNS =
  'id, trip_no, sales_no, trip_type, customer_id, source_warehouse_id, destination, ' +
  'transporter_id, driver_name, driver_phone, plate_no, load_tons, dispatch_date, ' +
  'delivery_date, status, remarks, created_at, updated_at, loaded_at, loaded_by, ' +
  'delivery_contact_name, delivery_contact_mobile'

export async function fetchTripRows() {
  const { data, error } = await supabase.from('trips').select(TRIPS_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function insertTripRow(row) {
  const { data, error } = await supabase.from('trips').insert(row).select(TRIPS_COLUMNS).single()
  if (error) throw new Error(error.message)
  return data
}

export async function insertTripRows(rows) {
  const { data, error } = await supabase.from('trips').insert(rows).select(TRIPS_COLUMNS)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateTripRow(id, patch) {
  const { data, error } = await supabase.from('trips').update(patch).eq('id', id).select(TRIPS_COLUMNS).single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteTripRow(id) {
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
