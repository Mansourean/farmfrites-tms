import { customers } from './customers'
import { transporters } from './transporters'
import { warehouses } from './warehouses'

export const getCustomer = (id) => customers.find((c) => c.id === id) ?? null
export const getTransporter = (id) => transporters.find((t) => t.id === id) ?? null
export const getWarehouse = (id) => warehouses.find((w) => w.id === id) ?? null

// Reads the name TripsContext already resolved against live Supabase master data when the
// trip was loaded (see dbRowToTrip in lib/tripsMapping.js) rather than looking it up here --
// trip.customerId/sourceWarehouseId/transporterId are now real Supabase UUIDs, not slugs
// matching the static arrays above, so a lookup against those arrays would no longer find
// anything. Every call site of originLabel()/transporterName() is unchanged.
export function originLabel(trip) {
  if (trip.tripType === 'customer') return trip.customerName ?? '—'
  return trip.sourceWarehouseName ?? '—'
}

export function transporterName(trip) {
  return trip.transporterName ?? '—'
}
