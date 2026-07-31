import { customers } from './customers'
import { transporters } from './transporters'
import { warehouses } from './warehouses'

export const getCustomer = (id) => customers.find((c) => c.id === id) ?? null
export const getTransporter = (id) => transporters.find((t) => t.id === id) ?? null
export const getWarehouse = (id) => warehouses.find((w) => w.id === id) ?? null

export function originLabel(trip) {
  if (trip.tripType === 'customer') return getCustomer(trip.customerId)?.name ?? '—'
  return getWarehouse(trip.sourceWarehouseId)?.name ?? '—'
}

export function transporterName(trip) {
  return getTransporter(trip.transporterId)?.name ?? '—'
}
