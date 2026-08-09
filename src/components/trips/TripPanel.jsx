import { useEffect, useMemo, useState } from 'react'
import { useTripPanel } from '../../context/TripPanelContext'
import { useTrips } from '../../context/TripsContext'
import { useWhatsappModal } from '../../context/WhatsappModalContext'
import { useDeleteTrip } from '../../context/DeleteTripContext'
import { useAuth } from '../../context/AuthContext'
import { canEdit, canManageMasterData } from '../../data/roles'
import { fetchTripEvents } from '../../services/tripEvents'
import { tripEventToTimelineItem } from '../../lib/tripsMapping'
import { Icon } from '../ui/Icon'
import { Avatar } from '../ui/Avatar'
import { TripStatusPill } from './TripStatusPill'
import { AddMasterDataModal } from './AddMasterDataModal'
import { formatDate, formatDateTime } from '../../utils/format'
import { getInitials } from '../../utils/initials'

const tabs = [
  { key: 'details', label: 'Details' },
  { key: 'timeline', label: 'Timeline' },
]

// Only auto-picks a Destination Warehouse when exactly one warehouse is active -- the current
// real-world case (a single active operational warehouse today). If zero or more than one are
// active, the field starts unselected rather than arbitrarily picking the first row in the
// list -- there is no default rule for the multi-warehouse case yet, so the dispatcher must
// choose consciously. Never hard-codes any warehouse's identity; purely a count of `isActive`
// rows.
function singleActiveWarehouseId(warehouses) {
  const active = warehouses.filter((w) => w.isActive)
  return active.length === 1 ? active[0].id : ''
}

// customers/warehouses/transporters now come from live Supabase data (see TripsContext),
// so these take the current lists as arguments instead of closing over a static import.
function emptyForm({ customers, warehouses, transporters }) {
  return {
    salesNo: '',
    tripType: 'customer',
    customerId: customers[0]?.id ?? '',
    // Pilot scope: goods physically originate from the Sudair factory for every trip, not from
    // any warehouse record. Confirmed source_warehouse_id is nullable in production, so this is
    // left null (never shown, never asked of the user, never auto-filled) rather than borrowing
    // a warehouse's identity as a stand-in -- that would misrepresent where the trip actually
    // started. A proper Origin/Dispatch-From concept is a deliberate post-Pilot design.
    sourceWarehouseId: '',
    destinationWarehouseId: singleActiveWarehouseId(warehouses),
    destination: '',
    deliveryContactMobile: '',
    transporterId: transporters[0]?.id ?? '',
    driverName: '',
    driverPhone: '',
    plateNo: '',
    dispatchDate: '',
    deliveryDate: '',
    status: 'planned',
    remarks: '',
  }
}

function formFromTrip(trip, { customers, warehouses }) {
  // destinationWarehouseId has no DB column (destination only stores the resolved warehouse
  // name as text -- see tripsMapping.js), so on edit it's re-derived by matching that name
  // back against the live warehouse list, not read from trip.destinationWarehouseId (always
  // null after a reload). Without this, the dropdown would silently default to the wrong
  // warehouse and saving would overwrite the correct destination text.
  const matchedDestinationWarehouse =
    trip.tripType === 'internal' ? warehouses.find((w) => w.name === trip.destination) : null
  return {
    salesNo: trip.salesNo,
    tripType: trip.tripType,
    customerId: trip.customerId ?? customers[0]?.id ?? '',
    sourceWarehouseId: trip.sourceWarehouseId,
    destinationWarehouseId: matchedDestinationWarehouse?.id ?? warehouses[1]?.id ?? warehouses[0]?.id ?? '',
    destination: trip.destination,
    deliveryContactMobile: trip.deliveryContactMobile ?? '',
    transporterId: trip.transporterId,
    driverName: trip.driver?.name ?? '',
    driverPhone: trip.driver?.phone ?? '',
    plateNo: trip.plateNo,
    dispatchDate: trip.dispatchDate,
    deliveryDate: trip.deliveryDate,
    status: trip.status,
    remarks: trip.remarks,
  }
}

function Field({ label, action, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{label}</span>
        {action}
      </span>
      {children}
    </label>
  )
}

// Small "+" trigger shown beside a master-data dropdown's label (Phase 4 inline creation) --
// only rendered for admin/dispatcher, matching the create_* RPCs' own role check exactly.
function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={label}
      className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-accent-green-100 bg-accent-green-50 text-accent-green-600 hover:bg-accent-green-100"
    >
      <Icon name="plus" className="h-3 w-3" strokeWidth={2.5} />
    </button>
  )
}

const inputClass =
  'rounded-md border border-border-strong bg-white px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent-green-500'

export function TripPanel() {
  const { open, mode, tripId, tab, close, openView } = useTripPanel()
  const {
    trips,
    customers,
    transporters,
    warehouses,
    destinations,
    refreshMasterData,
    createTrip,
    updateTrip,
    isSalesNoTaken,
  } = useTrips()
  const whatsapp = useWhatsappModal()
  const deleteTrip = useDeleteTrip()
  const { currentUser } = useAuth()
  const editable = canEdit(currentUser?.role)
  const canAddMasterData = canManageMasterData(currentUser?.role)
  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId])
  const isEditing = mode === 'create' || mode === 'edit'
  const masterData = useMemo(() => ({ customers, transporters, warehouses }), [customers, transporters, warehouses])

  const [form, setForm] = useState(() => emptyForm(masterData))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [realEvents, setRealEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  // { entityType: 'customer'|'transporter'|'warehouse', field: <form key to auto-select> }
  const [addModal, setAddModal] = useState(null)

  useEffect(() => {
    if (!open) return
    setError('')
    if (mode === 'create') setForm(emptyForm(masterData))
    else if (trip) setForm(formFromTrip(trip, masterData))
    // Deliberately NOT depending on `masterData`: Phase 4's inline "+" creation refreshes
    // master data while this panel stays open, and re-seeding the whole form on that change
    // would wipe out whatever the user was mid-typing -- the very bug this omission avoids.
    // The form is seeded once when the panel opens / the target trip changes, using whatever
    // masterData was current at that moment; dropdown option lists still update live from
    // props independently of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, trip])

  const handleMasterDataCreated = async (row) => {
    if (!addModal) return
    const { entityType, field } = addModal
    await refreshMasterData()
    // destination has no *Id form field -- trips.destination stores the resolved name
    // directly (see tripsMapping.js), same as Destination Warehouse already does.
    const value = entityType === 'destination' ? row.destination_name : row.id
    setForm((f) => ({ ...f, [field]: value }))
    setAddModal(null)
  }

  // Phase 3: the durable Loaded/Reject audit trail lives in trip_events, not in the
  // synthetic/optimistic entries TripsContext builds locally -- fetched on demand only when
  // the Timeline tab is actually viewed, so viewing trip details/editing never pays for it.
  useEffect(() => {
    if (!open || tab !== 'timeline' || !trip) return
    let cancelled = false
    setEventsLoading(true)
    fetchTripEvents(trip.id)
      .then((rows) => {
        if (!cancelled) setRealEvents(rows.map(tripEventToTimelineItem))
      })
      .catch(() => {
        if (!cancelled) setRealEvents([])
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, tab, trip])

  // Merges the durable trip_events-backed entries with trip.timeline's existing synthetic
  // (created/updated) and optimistic (Delivered, WhatsApp) entries -- these never overlap in
  // event type, so no de-duplication is needed, just a combined chronological order.
  const mergedTimeline = useMemo(
    () =>
      [...(trip?.timeline ?? []), ...realEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    [trip, realEvents],
  )

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSave = async () => {
    const salesNo = form.salesNo.trim()
    if (!salesNo) {
      setError('Sales No is required.')
      return
    }
    if (isSalesNoTaken(salesNo, mode === 'edit' ? trip?.id : undefined)) {
      setError(`Sales No "${salesNo}" is already in use by another trip.`)
      return
    }
    if (form.tripType === 'internal' && !form.destinationWarehouseId) {
      setError('Destination Warehouse is required.')
      return
    }

    const destination =
      form.tripType === 'internal'
        ? warehouses.find((w) => w.id === form.destinationWarehouseId)?.name ?? ''
        : form.destination

    // Once a Customer Delivery trip has a Delivery Date, it's ready to be handed to the
    // transporter. Only fires forward from Planned -- never overrides a status the trip already
    // moved past Planned, and never applies to Internal Transfer trips.
    const autoReady = form.tripType === 'customer' && form.status === 'planned' && !!form.deliveryDate
    const status = autoReady ? 'ready_for_transporter' : form.status

    const payload = {
      salesNo,
      tripType: form.tripType,
      customerId: form.tripType === 'customer' ? form.customerId : null,
      sourceWarehouseId: form.sourceWarehouseId,
      destinationWarehouseId: form.tripType === 'internal' ? form.destinationWarehouseId : null,
      destination,
      deliveryContactMobile: form.tripType === 'customer' ? form.deliveryContactMobile : null,
      // loadTons is deliberately omitted -- there is no form control for it anymore (see
      // TripPanel's Load (Tons) removal), and including it here as 0 would silently zero out
      // any existing value (from Excel import or earlier entry) on every edit. Leaving the key
      // out entirely means tripPatchToDbRow's `if ('loadTons' in patch)` guard skips it, so
      // whatever is already stored is left untouched.
      transporterId: form.transporterId,
      driver: form.driverName ? { name: form.driverName, phone: form.driverPhone } : null,
      plateNo: form.plateNo,
      dispatchDate: form.dispatchDate,
      deliveryDate: form.deliveryDate,
      // actualDeliveryDate is deliberately omitted -- there is no form control for it anymore
      // (see TripPanel's Actual Delivery Date & Time removal). Leaving the key out entirely
      // means tripPatchToDbRow's `if ('actualDeliveryDate' in patch)` guard skips it, so
      // whatever is already stored (e.g. set by the Confirm Delivery button) is left untouched.
      status,
      remarks: form.remarks,
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createTrip(payload)
        openView(created.id, 'details')
      } else if (mode === 'edit' && trip) {
        await updateTrip(trip.id, payload)
        openView(trip.id, 'details')
      }
    } catch (err) {
      setError(err.message || 'Could not save this trip.')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'create' ? 'New Trip' : trip?.salesNo ?? ''
  // Only ever rendered for Customer Delivery trips (see the Details view below) -- there is no
  // meaningful "origin" to show for Internal Transfer under the Pilot's model (see
  // sourceWarehouseId's comment in emptyForm).
  const originName = customers.find((c) => c.id === form.customerId)?.name

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={close} />
      <div className="relative flex h-full w-full max-w-[460px] flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-text-primary">{title}</p>
            {trip && mode === 'view' && (
              <div className="mt-1">
                <TripStatusPill status={trip.status} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {mode === 'view' && trip && editable && (
              <button
                type="button"
                onClick={() => whatsapp.open(trip.id)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium text-[#1E9E6A] hover:bg-[#E1F5EC]"
              >
                <Icon name="whatsapp" className="h-3.5 w-3.5" />
                Send WhatsApp
              </button>
            )}
            <button type="button" onClick={close} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-secondary">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1 border-b border-border px-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => openView(tripId, t.key)}
                className={`relative px-2.5 py-2.5 text-[13px] font-medium transition-colors ${
                  tab === t.key ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {t.label}
                {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-text-primary" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <Field label="Sales No">
                <input
                  className={inputClass}
                  value={form.salesNo}
                  onChange={set('salesNo')}
                  placeholder="e.g. SO-24681"
                  autoFocus={mode === 'create'}
                />
              </Field>

              <Field label="Trip Type">
                <div className="flex rounded-md border border-border-strong p-0.5">
                  {[
                    { value: 'customer', label: 'Customer Delivery' },
                    { value: 'internal', label: 'Internal Transfer' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tripType: option.value }))}
                      className={`flex-1 rounded-[5px] px-2 py-1.5 text-[12.5px] font-medium transition-colors ${
                        form.tripType === option.value
                          ? 'bg-accent-green-500 text-white'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>

              {form.tripType === 'customer' ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Client"
                      action={canAddMasterData && (
                        <AddButton label="Add customer" onClick={() => setAddModal({ entityType: 'customer', field: 'customerId' })} />
                      )}
                    >
                      <select className={inputClass} value={form.customerId} onChange={set('customerId')}>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field
                      label="Destination (City)"
                      action={canAddMasterData && (
                        <AddButton label="Add destination" onClick={() => setAddModal({ entityType: 'destination', field: 'destination' })} />
                      )}
                    >
                      <select className={inputClass} value={form.destination} onChange={set('destination')}>
                        {!form.destination && (
                          <option value="" disabled>
                            Select destination…
                          </option>
                        )}
                        {/* Existing trips predate this table -- an unmatched current value is kept
                            selectable as itself, never silently swapped for the first list item. */}
                        {form.destination && !destinations.some((d) => d.name === form.destination) && (
                          <option value={form.destination}>{form.destination} (current, not in list)</option>
                        )}
                        {destinations.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </>
              ) : (
                // Pilot scope: origin is operationally understood to be the Sudair factory for
                // both trip types -- there is no Source Warehouse selection here.
                <Field
                  label="Destination Warehouse"
                  action={canAddMasterData && (
                    <AddButton
                      label="Add warehouse"
                      onClick={() => setAddModal({ entityType: 'warehouse', field: 'destinationWarehouseId' })}
                    />
                  )}
                >
                  <select
                    className={inputClass}
                    value={form.destinationWarehouseId}
                    onChange={set('destinationWarehouseId')}
                  >
                    {!form.destinationWarehouseId && (
                      <option value="" disabled>
                        Select warehouse…
                      </option>
                    )}
                    {/* "Name -- City" so future same-named warehouses in different cities stay
                        distinguishable (e.g. "Warehouse A -- Jeddah" vs "Warehouse A -- Riyadh"). */}
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.city ? `${w.name} — ${w.city}` : w.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field
                label="Transporter"
                action={canAddMasterData && (
                  <AddButton label="Add transporter" onClick={() => setAddModal({ entityType: 'transporter', field: 'transporterId' })} />
                )}
              >
                <select className={inputClass} value={form.transporterId} onChange={set('transporterId')}>
                  {transporters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Dispatch Date">
                <input type="date" className={inputClass} value={form.dispatchDate} onChange={set('dispatchDate')} />
              </Field>

              <Field label="Delivery Date">
                <input type="date" className={inputClass} value={form.deliveryDate} onChange={set('deliveryDate')} />
              </Field>

              {form.tripType === 'customer' && (
                <Field label="Receiver Mobile">
                  <input
                    className={inputClass}
                    value={form.deliveryContactMobile}
                    onChange={set('deliveryContactMobile')}
                    placeholder="Optional"
                  />
                </Field>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Driver Name">
                  <input className={inputClass} value={form.driverName} onChange={set('driverName')} placeholder="Optional" />
                </Field>
                <Field label="Driver Phone">
                  <input className={inputClass} value={form.driverPhone} onChange={set('driverPhone')} placeholder="Optional" />
                </Field>
                <Field label="Plate No">
                  <input className={inputClass} value={form.plateNo} onChange={set('plateNo')} placeholder="Optional" />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <select className={inputClass} value={form.status} onChange={set('status')}>
                    <option value="planned">Planned</option>
                    <option value="ready_for_transporter">Ready for Transporter</option>
                    <option value="waiting_driver">Waiting Driver</option>
                    <option value="loaded">Loaded</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </Field>
                <Field label="Remarks">
                  <textarea
                    className={`${inputClass} min-h-[38px] resize-none`}
                    value={form.remarks}
                    onChange={set('remarks')}
                    placeholder="Optional notes"
                  />
                </Field>
              </div>

              {error && <p className="rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}
            </div>
          ) : trip && tab === 'details' ? (
            <div className="flex flex-col gap-5">
              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Sales Information</p>
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <p className="text-text-muted">Sales No</p>
                    <p className="font-medium text-text-primary">{trip.salesNo}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Trip Type</p>
                    <p className="font-medium text-text-primary">
                      {trip.tripType === 'customer' ? 'Customer Delivery' : 'Internal Transfer'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-text-muted">Dispatch → Delivery</p>
                    <p className="font-medium text-text-primary">
                      {formatDate(trip.dispatchDate)} → {formatDate(trip.deliveryDate)}
                    </p>
                  </div>
                </div>
              </section>

              {trip.tripType === 'customer' && (
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Client</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{originName}</p>
                  </div>
                </section>
              )}

              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Destination</p>
                <div className="flex items-start gap-2 rounded-lg border border-border p-3 text-[13px]">
                  <Icon name="mapPin" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <p className="text-text-primary">{trip.destination}</p>
                </div>
              </section>

              {trip.tripType === 'customer' && trip.deliveryContactMobile && (
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Receiver Mobile</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{trip.deliveryContactMobile}</p>
                  </div>
                </section>
              )}

              {trip.actualDeliveryDate && (
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Actual Delivery</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{formatDateTime(trip.actualDeliveryDate)}</p>
                  </div>
                </section>
              )}

              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Transporter</p>
                <div className="rounded-lg border border-border p-3 text-[13px]">
                  <p className="font-medium text-text-primary">{transporters.find((t) => t.id === trip.transporterId)?.name}</p>
                  <p className="text-text-muted">{transporters.find((t) => t.id === trip.transporterId)?.phone}</p>
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Driver</p>
                <div className="rounded-lg border border-border p-3 text-[13px]">
                  {trip.driver ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={trip.driver.name} initials={getInitials(trip.driver.name)} size={26} />
                      <p className="font-medium text-text-primary">{trip.driver.name}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-text-faint">Driver not yet assigned</p>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => whatsapp.open(trip.id)}
                          className="flex items-center gap-1 rounded-md bg-[#1E9E6A] px-2 py-1 text-[12px] font-medium text-white hover:bg-[#188056]"
                        >
                          <Icon name="whatsapp" className="h-3 w-3" />
                          Request via WhatsApp
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Phone</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{trip.driver?.phone || <span className="font-normal text-text-faint">—</span>}</p>
                  </div>
                </section>
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Plate</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{trip.plateNo || <span className="font-normal text-text-faint">Not assigned</span>}</p>
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Vehicle</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{trip.vehicleType || <span className="font-normal text-text-faint">—</span>}</p>
                  </div>
                </section>
                <section>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Load (Tons)</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary tabular-nums">{trip.loadTons}</p>
                  </div>
                </section>
              </div>

              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Remarks</p>
                <p className="text-[13px] text-text-secondary">
                  {trip.remarks || <span className="text-text-faint">No remarks</span>}
                </p>
              </section>

              {editable && trip.status === 'in_transit' && (
                <button
                  type="button"
                  onClick={() =>
                    updateTrip(trip.id, {
                      status: 'delivered',
                      // Records the actual arrival timestamp at the moment of confirmation,
                      // separate from the planned deliveryDateTime -- see 0013.
                      actualDeliveryDate: new Date().toISOString(),
                    })
                  }
                  className="flex items-center justify-center gap-1.5 rounded-md bg-[#0F6B32] py-2.5 text-[13px] font-semibold text-white hover:bg-[#0B5227]"
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                  Confirm Delivery
                </button>
              )}
            </div>
          ) : trip && tab === 'timeline' ? (
            <div className="flex flex-col">
              {eventsLoading && <p className="pb-3 text-[12.5px] text-text-faint">Loading history…</p>}
              {mergedTimeline
                .slice()
                .reverse()
                .map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      {i < mergedTimeline.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-[13px] font-medium text-text-primary">{event.label}</p>
                      <p className="text-[12px] text-text-muted">
                        {formatDateTime(event.timestamp)} · {event.actor}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : null}
        </div>

        {isEditing && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
            {mode === 'edit' && trip ? (
              <button
                type="button"
                onClick={() => deleteTrip.open(trip.id)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-[#B42318] hover:bg-[#FBE7E5]"
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={mode === 'create' ? close : () => openView(trip.id, 'details')}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-accent-green-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-green-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving…' : mode === 'create' ? 'Create Trip' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      <AddMasterDataModal
        open={!!addModal}
        entityType={addModal?.entityType}
        onClose={() => setAddModal(null)}
        onCreated={handleMasterDataCreated}
      />
    </div>
  )
}
