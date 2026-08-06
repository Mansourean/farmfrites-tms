import { supabase } from '../lib/supabase'

// Reads the real production customers/transporters/warehouses (UUID-keyed, business `code`)
// for authenticated users -- replaces the old static src/data/{customers,transporters,
// warehouses}.js as the source for trip creation/editing/import, so every selection a user
// makes always resolves to a real UUID. The read-only master-data list pages
// (Customers.jsx/Transporters.jsx/Warehouses.jsx) are unrelated to trips and are left on the
// static files, unchanged -- out of scope for this phase.
async function fetchList(table, codeColumn, nameColumn, extraColumns = '') {
  const { data, error } = await supabase.from(table).select(`id, code:${codeColumn}, name:${nameColumn}${extraColumns}`)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchMasterData() {
  const [customers, transporters, warehouses, destinations] = await Promise.all([
    fetchList('customers', 'customer_code', 'customer_name'),
    fetchList('transporters', 'transporter_code', 'transporter_name'),
    // isActive is read only for warehouses, so New Trip can auto-default Source Warehouse when
    // exactly one is active (see TripPanel.jsx) without hard-coding any warehouse's identity.
    fetchList('warehouses', 'warehouse_code', 'warehouse_name', ', isActive:is_active'),
    fetchList('destinations', 'destination_code', 'destination_name'),
  ])
  return { customers, transporters, warehouses, destinations }
}
