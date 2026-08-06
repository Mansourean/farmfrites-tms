// Translation layer between the frontend's existing trip shape/vocabulary (unchanged, so
// every consumer component keeps working as-is) and the verified production public.trips
// schema. Nothing here changes what the UI shows or how components call TripsContext --
// only what gets sent to / read from Supabase.

// Frontend keeps its existing lowercase keys ('customer'/'internal') -- only the Supabase
// boundary knows about the DB's exact strings.
export const TRIP_TYPE_TO_DB = {
  customer: 'Customer Delivery',
  internal: 'Internal Transfer',
}
export const TRIP_TYPE_FROM_DB = {
  'Customer Delivery': 'customer',
  'Internal Transfer': 'internal',
}

// 'waiting_driver' and 'cancelled' are new frontend-side keys (the DB already supports both
// values; the frontend previously only knew 3 of the 6). Existing keys/values are unchanged.
// 'rejected' added for Phase 3's reject_trip_load workflow (see 0008_reject_status.sql) --
// set only via that RPC, not selectable as a source status for any other transition.
export const STATUS_TO_DB = {
  planned: 'Planned',
  waiting_driver: 'Waiting Driver',
  loaded: 'Loaded',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}
export const STATUS_FROM_DB = {
  Planned: 'planned',
  'Waiting Driver': 'waiting_driver',
  Loaded: 'loaded',
  'In Transit': 'in_transit',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
  Rejected: 'rejected',
}

export function tripTypeToDb(value) {
  return TRIP_TYPE_TO_DB[value] ?? TRIP_TYPE_TO_DB.customer
}
export function tripTypeFromDb(value) {
  return TRIP_TYPE_FROM_DB[value] ?? 'customer'
}
export function statusToDb(value) {
  return STATUS_TO_DB[value] ?? STATUS_TO_DB.planned
}
export function statusFromDb(value) {
  return STATUS_FROM_DB[value] ?? 'planned'
}

// trips.dispatch_date / delivery_date are timestamptz; the UI only ever collects/shows a
// plain date (<input type="date">), so time-of-day is fixed at midnight UTC both ways.
export function dateToDb(dateStr) {
  if (!dateStr) return null
  return new Date(`${dateStr}T00:00:00Z`).toISOString()
}
export function dateFromDb(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(0, 10)
}

// Converts one public.trips row into the exact shape TripsContext/components have always
// used. customerId/sourceWarehouseId/transporterId hold the real Supabase UUID directly
// (matching the `.id` field on the live master-data lists from services/masterData.js) --
// this is the same shape convention the old static seed data already used (an id that every
// `.find(x => x.id === trip.customerId)` call site in the codebase matches against), so no
// separate code<->uuid translation is needed here, and existing lookups keep working
// unchanged. Fields with no column in the verified schema (destinationWarehouseId,
// vehicleType, documents, whatsapp, customFields, timeline as real history) are deliberately
// given safe empty defaults, not fabricated data -- see the Phase 2 report for which UI areas
// this affects.
// `names` (optional) is { customerName, sourceWarehouseName, transporterName } resolved once
// by TripsContext against the live master-data lists -- attached directly to the trip so
// src/data/lookup.js's originLabel()/transporterName() (used by ~9 display components) can
// keep working exactly as before without every call site needing to do its own live lookup.
export function dbRowToTrip(row, names = {}) {
  return {
    id: row.id,
    salesNo: row.sales_no ?? '',
    tripType: tripTypeFromDb(row.trip_type),
    customerId: row.customer_id ?? null,
    customerName: names.customerName ?? null,
    sourceWarehouseId: row.source_warehouse_id ?? null,
    sourceWarehouseName: names.sourceWarehouseName ?? null,
    destinationWarehouseId: null, // no destination_warehouse_id column -- see report
    destination: row.destination ?? '',
    loadTons: row.load_tons ?? 0,
    transporterId: row.transporter_id ?? null,
    transporterName: names.transporterName ?? null,
    driver: row.driver_name ? { name: row.driver_name, phone: row.driver_phone ?? '' } : null,
    plateNo: row.plate_no ?? '',
    vehicleType: '', // no vehicle_type column -- see report
    dispatchDate: dateFromDb(row.dispatch_date),
    deliveryDate: dateFromDb(row.delivery_date),
    status: statusFromDb(row.status),
    remarks: row.remarks ?? '',
    documents: [], // no storage-backed documents exist yet, unchanged from before this phase
    timeline: buildSyntheticTimeline(row),
    whatsapp: null, // whatsapp_token/requestedAt/filledAt have no columns -- see report
    createdSeq: row.created_at ? new Date(row.created_at).getTime() : 0,
    loadedAt: row.loaded_at,
    loadedBy: row.loaded_by,
  }
}

// trip_events has no INSERT policy for any role yet (Phase 1 deliberately reserved writes for
// the future Loaded/Reject RPCs) -- so a real persisted event history isn't available this
// phase. Synthesizes the two events we *do* have real timestamps for, rather than fabricating
// a longer history.
function buildSyntheticTimeline(row) {
  const events = []
  if (row.created_at) {
    events.push({ id: `${row.id}-created`, label: 'Trip created', actor: 'System', timestamp: row.created_at })
  }
  if (row.updated_at && row.updated_at !== row.created_at) {
    events.push({ id: `${row.id}-updated`, label: 'Trip last updated', actor: 'System', timestamp: row.updated_at })
  }
  return events
}

// Converts a TripsContext create/update payload (frontend shape) into a public.trips row
// patch. customerId/sourceWarehouseId/transporterId are already real UUIDs by this point (the
// TripPanel/Excel-import dropdowns only ever offer live Supabase master-data ids as choices --
// see services/masterData.js) so this is a direct pass-through, not a lookup. Only writes
// columns the verified schema actually has -- see the Phase 2 report for the frontend fields
// this silently drops (by necessity, not by accident).
export function tripPatchToDbRow(patch) {
  const row = {}

  if ('salesNo' in patch) {
    row.sales_no = patch.salesNo
    // trip_no is NOT NULL with no dedicated frontend concept (confirmed: no existing
    // trip_no mechanism anywhere in the app) -- mirrored from salesNo as the minimal safe
    // default. See the Phase 2 report.
    row.trip_no = patch.salesNo
  }
  if ('tripType' in patch) row.trip_type = tripTypeToDb(patch.tripType)
  if ('customerId' in patch) row.customer_id = patch.customerId || null
  if ('sourceWarehouseId' in patch) row.source_warehouse_id = patch.sourceWarehouseId || null
  if ('destination' in patch) row.destination = patch.destination
  if ('loadTons' in patch) row.load_tons = patch.loadTons
  if ('transporterId' in patch) row.transporter_id = patch.transporterId || null
  if ('driver' in patch) {
    row.driver_name = patch.driver?.name ?? null
    row.driver_phone = patch.driver?.phone ?? null
  }
  if ('plateNo' in patch) row.plate_no = patch.plateNo
  if ('dispatchDate' in patch) row.dispatch_date = dateToDb(patch.dispatchDate)
  if ('deliveryDate' in patch) row.delivery_date = dateToDb(patch.deliveryDate)
  if ('status' in patch) row.status = statusToDb(patch.status)
  if ('remarks' in patch) row.remarks = patch.remarks

  // destinationWarehouseId and vehicleType intentionally never written -- no column exists.

  return row
}

// Converts one public.trip_events row (Phase 3 warehouse-loading audit trail) into the same
// { id, label, actor, timestamp } shape the Timeline tab already renders for its synthetic/
// optimistic entries, so TripPanel can merge both sources with no rendering changes.
// event_type is deliberately unconstrained in the DB (see 0004's comment) -- unrecognized
// future event types still render, just with their raw type string as the label.
export function tripEventToTimelineItem(event) {
  const actor = event.actor_name || 'Unknown'
  if (event.event_type === 'loading_confirmed') {
    return { id: event.id, label: 'Loaded and verified at warehouse', actor, timestamp: event.created_at }
  }
  if (event.event_type === 'loading_rejected') {
    return { id: event.id, label: `Load rejected — ${event.reason}`, actor, timestamp: event.created_at }
  }
  return { id: event.id, label: event.event_type, actor, timestamp: event.created_at }
}
