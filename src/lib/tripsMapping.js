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
// 'ready_for_transporter' added for the operational workflow (see 0013): the trip becomes
// this automatically once the customer info confirmation checkbox is set, and is now the
// eligible source status for mark_trip_loaded/reject_trip_load (was 'Planned'). 'waiting_driver'
// is kept for backward compatibility with any existing row already at that status -- it is no
// longer part of the automated flow, but remains selectable and mapped like every other value.
// 'waiting_for_loading' added (see 0016): the transporter has submitted driver/vehicle, truck
// is waiting at the factory to be loaded -- this is now the eligible source status for
// mark_trip_loaded/reject_trip_load (was 'Ready for Transporter'). DB values are unchanged by
// 0016; only UI labels differ ('Planned' displays as "New Order", 'Ready for Transporter'
// displays as "Transportation Assignment" -- see TripStatusPill.jsx/FilterBar.jsx/
// excelExporter.js), so no data migration was needed.
// 'at_gate' added (see 0021): sits between Confirmed and Loaded -- set only by gate_check_in,
// once the trip has actually been checked in at the factory gate. mark_trip_loaded/
// reject_trip_load now accept either 'waiting_for_loading' or 'at_gate' as their source status.
export const STATUS_TO_DB = {
  planned: 'Planned',
  ready_for_transporter: 'Ready for Transporter',
  waiting_for_loading: 'Waiting for Loading',
  at_gate: 'At Gate',
  waiting_driver: 'Waiting Driver',
  loaded: 'Loaded',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}
export const STATUS_FROM_DB = {
  Planned: 'planned',
  'Ready for Transporter': 'ready_for_transporter',
  'Waiting for Loading': 'waiting_for_loading',
  'At Gate': 'at_gate',
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

// Centralizes the New Order -> Transportation Assignment auto-promotion rule: once a Customer
// Delivery trip has a Delivery Date, it's ready to be handed to the transporter -- no separate
// confirmation checkbox (removed per approved decision: a checkbox is a clearer, more
// deliberate signal than a still-tentative typed date, but adds an extra required step: not
// needed once the coordinator is expected to only enter the date after actually confirming it
// with the customer). Only fires forward from New Order (DB value 'planned'), only for
// Customer Delivery trips.
export function autoReadyStatus(tripType, currentStatus, deliveryDate) {
  return tripType === 'customer' && currentStatus === 'planned' && !!deliveryDate
    ? 'ready_for_transporter'
    : null
}

// Centralizes the "suggested Loading Date" calculation (see 0017's destinations.transit_days)
// so every place a Requested Delivery Date can be set -- TripPanel's form and the
// Transportation Log table's inline date cell -- computes the same suggestion identically.
// Returns null when there's nothing to suggest (no date, unknown destination, or the
// destination has no Transit Days on file yet) -- callers are expected to only apply the
// result when the trip doesn't already have a Loading Date set, never overwriting one.
export function suggestedDispatchDate(destinations, destinationName, deliveryDate) {
  if (!deliveryDate) return null
  const destination = destinations.find((d) => d.name === destinationName)
  if (!destination?.transitDays) return null
  const suggested = new Date(`${deliveryDate}T00:00:00Z`)
  suggested.setUTCDate(suggested.getUTCDate() - destination.transitDays)
  return suggested.toISOString().slice(0, 10)
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

// Separate from dateToDb/dateFromDb on purpose: dispatch_date stays date-only (unchanged,
// still used by every existing consumer -- Excel, sorting, printing), while the Delivery
// Confirmation section now needs a real time-of-day on delivery_date and actual_delivery_date
// (both already timestamptz -- no schema change was needed to support this). Pairs with
// <input type="datetime-local">, which is always local time with no timezone in its string --
// new Date(localStr) interprets it as the browser's local time, exactly matching what the
// user typed, then converts to a real UTC instant for storage.
export function datetimeToDb(localStr) {
  if (!localStr) return null
  return new Date(localStr).toISOString()
}
export function datetimeFromDb(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Converts one public.trips row into the exact shape TripsContext/components have always
// used. customerId/sourceWarehouseId/transporterId hold the real Supabase UUID directly
// (matching the `.id` field on the live master-data lists from services/masterData.js) --
// this is the same shape convention the old static seed data already used (an id that every
// `.find(x => x.id === trip.customerId)` call site in the codebase matches against), so no
// separate code<->uuid translation is needed here, and existing lookups keep working
// unchanged. Fields with no column in the verified schema (destinationWarehouseId,
// vehicleType, documents, customFields, timeline as real history) are deliberately given safe
// empty defaults, not fabricated data -- see the Phase 2 report for which UI areas this
// affects.
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
    // Full date+time reads of the same delivery_date column, for the Delivery Confirmation
    // section specifically -- deliveryDate above is untouched (still date-only) so every
    // existing consumer (Excel, sorting, printing) keeps working exactly as before.
    deliveryDateTime: datetimeFromDb(row.delivery_date),
    actualDeliveryDate: datetimeFromDb(row.actual_delivery_date),
    status: statusFromDb(row.status),
    remarks: row.remarks ?? '',
    documents: [], // no storage-backed documents exist yet, unchanged from before this phase
    timeline: buildSyntheticTimeline(row),
    // delivery_contact_name still exists as a column (see 0011) but the app no longer reads or
    // writes it -- that field was removed from the product; deliveryContactMobile was kept and
    // is now displayed as "Receiver Mobile" everywhere (field name/column unchanged, label
    // only). No migration/column drop.
    deliveryContactMobile: row.delivery_contact_mobile ?? '',
    // Operational workflow (see 0013): the two Delivery Confirmation checkboxes.
    dateTimeConfirmed: row.date_time_confirmed ?? false,
    customerNotified: row.customer_notified ?? false,
    createdSeq: row.created_at ? new Date(row.created_at).getTime() : 0,
    loadedAt: row.loaded_at,
    loadedBy: row.loaded_by,
    // Gate check-in/out (see 0020) -- read-only here, same as loadedAt/loadedBy above; only
    // ever written by gate_check_in/gate_check_out, never through tripPatchToDbRow. Actor
    // *names* are denormalized straight onto the row (mirrors trip_events.actor_name) so the
    // Gate page never needs a separate profiles lookup just to show who acted.
    gateCheckInAt: row.gate_check_in_at,
    gateCheckInByName: row.gate_check_in_by_name,
    gateCheckOutAt: row.gate_check_out_at,
    gateCheckOutByName: row.gate_check_out_by_name,
    gateDelayReason: row.gate_delay_reason,
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
  // deliveryDateTime takes priority when both are present in the same patch (TripPanel only
  // ever sends one or the other, never both, but if it did, the richer datetime write should
  // win) -- same delivery_date column either way.
  if ('deliveryDateTime' in patch) row.delivery_date = datetimeToDb(patch.deliveryDateTime)
  if ('actualDeliveryDate' in patch) row.actual_delivery_date = datetimeToDb(patch.actualDeliveryDate)
  if ('status' in patch) row.status = statusToDb(patch.status)
  if ('remarks' in patch) row.remarks = patch.remarks
  if ('deliveryContactMobile' in patch) row.delivery_contact_mobile = patch.deliveryContactMobile || null
  if ('dateTimeConfirmed' in patch) row.date_time_confirmed = !!patch.dateTimeConfirmed
  if ('customerNotified' in patch) row.customer_notified = !!patch.customerNotified

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
  if (event.event_type === 'departed') {
    return { id: event.id, label: 'Trip departed — now In Transit', actor, timestamp: event.created_at }
  }
  if (event.event_type === 'gate_check_in') {
    return { id: event.id, label: 'Checked in at gate — now At Gate', actor, timestamp: event.created_at }
  }
  if (event.event_type === 'gate_check_out') {
    const reason = event.metadata?.delay_reason
    return {
      id: event.id,
      label: reason ? `Checked out at gate — delayed: ${reason}` : 'Checked out at gate',
      actor,
      timestamp: event.created_at,
    }
  }
  // Generic audit trigger (see 0013) -- covers every other status change, including plain
  // Status-dropdown edits and the automatic Planned -> Ready for Transporter transition, none
  // of which have their own dedicated event_type.
  if (event.event_type === 'status_changed') {
    const from = event.metadata?.previous_status ?? '?'
    const to = event.metadata?.new_status ?? '?'
    return { id: event.id, label: `Status changed: ${from} → ${to}`, actor, timestamp: event.created_at }
  }
  return { id: event.id, label: event.event_type, actor, timestamp: event.created_at }
}
