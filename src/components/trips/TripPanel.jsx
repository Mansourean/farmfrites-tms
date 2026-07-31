import { useEffect, useMemo, useState } from 'react'
import { useTripPanel } from '../../context/TripPanelContext'
import { useTrips } from '../../context/TripsContext'
import { useWhatsappModal } from '../../context/WhatsappModalContext'
import { useDeleteTrip } from '../../context/DeleteTripContext'
import { useAuth } from '../../context/AuthContext'
import { canEdit } from '../../data/roles'
import { customers } from '../../data/customers'
import { transporters, vehicleTypes } from '../../data/transporters'
import { warehouses } from '../../data/warehouses'
import { getWarehouse } from '../../data/lookup'
import { Icon } from '../ui/Icon'
import { Avatar } from '../ui/Avatar'
import { TripStatusPill } from './TripStatusPill'
import { formatDate, formatDateTime } from '../../utils/format'
import { getInitials } from '../../utils/initials'

const tabs = [
  { key: 'details', label: 'Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
]

function emptyForm() {
  return {
    salesNo: '',
    tripType: 'customer',
    customerId: customers[0].id,
    sourceWarehouseId: warehouses[0].id,
    destinationWarehouseId: warehouses[1].id,
    destination: '',
    loadTons: '',
    transporterId: transporters[0].id,
    driverName: '',
    driverPhone: '',
    plateNo: '',
    vehicleType: vehicleTypes[0],
    dispatchDate: '',
    deliveryDate: '',
    status: 'planned',
    remarks: '',
  }
}

function formFromTrip(trip) {
  return {
    salesNo: trip.salesNo,
    tripType: trip.tripType,
    customerId: trip.customerId ?? customers[0].id,
    sourceWarehouseId: trip.sourceWarehouseId,
    destinationWarehouseId: trip.destinationWarehouseId ?? warehouses[1].id,
    destination: trip.destination,
    loadTons: trip.loadTons,
    transporterId: trip.transporterId,
    driverName: trip.driver?.name ?? '',
    driverPhone: trip.driver?.phone ?? '',
    plateNo: trip.plateNo,
    vehicleType: trip.vehicleType || vehicleTypes[0],
    dispatchDate: trip.dispatchDate,
    deliveryDate: trip.deliveryDate,
    status: trip.status,
    remarks: trip.remarks,
  }
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'rounded-md border border-border-strong bg-white px-2.5 py-[7px] text-[13px] text-text-primary outline-none focus:border-brand-400'

export function TripPanel() {
  const { open, mode, tripId, tab, close, openView } = useTripPanel()
  const { trips, createTrip, updateTrip, isSalesNoTaken } = useTrips()
  const whatsapp = useWhatsappModal()
  const deleteTrip = useDeleteTrip()
  const { currentUser } = useAuth()
  const editable = canEdit(currentUser?.role)
  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId])
  const isEditing = mode === 'create' || mode === 'edit'

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (mode === 'create') setForm(emptyForm())
    else if (trip) setForm(formFromTrip(trip))
  }, [open, mode, trip])

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

  const handleSave = () => {
    const salesNo = form.salesNo.trim()
    if (!salesNo) {
      setError('Sales No is required.')
      return
    }
    if (isSalesNoTaken(salesNo, mode === 'edit' ? trip?.id : undefined)) {
      setError(`Sales No "${salesNo}" is already in use by another trip.`)
      return
    }

    const destination =
      form.tripType === 'internal'
        ? warehouses.find((w) => w.id === form.destinationWarehouseId)?.name ?? ''
        : form.destination

    const payload = {
      salesNo,
      tripType: form.tripType,
      customerId: form.tripType === 'customer' ? form.customerId : null,
      sourceWarehouseId: form.sourceWarehouseId,
      destinationWarehouseId: form.tripType === 'internal' ? form.destinationWarehouseId : null,
      destination,
      loadTons: Number(form.loadTons) || 0,
      transporterId: form.transporterId,
      driver: form.driverName ? { name: form.driverName, phone: form.driverPhone } : null,
      plateNo: form.plateNo,
      vehicleType: form.vehicleType,
      dispatchDate: form.dispatchDate,
      deliveryDate: form.deliveryDate,
      remarks: form.remarks,
    }

    if (mode === 'create') {
      const created = createTrip(payload)
      openView(created.id, 'details')
    } else if (mode === 'edit' && trip) {
      updateTrip(trip.id, { ...payload, status: form.status })
      openView(trip.id, 'details')
    }
  }

  const title = mode === 'create' ? 'New Trip' : trip?.salesNo ?? ''
  const originName =
    form.tripType === 'customer'
      ? customers.find((c) => c.id === form.customerId)?.name
      : warehouses.find((w) => w.id === form.sourceWarehouseId)?.name

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
            <div className="flex flex-col gap-4">
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
                          ? 'bg-text-primary text-white'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.tripType === 'customer' ? (
                  <Field label="Customer">
                    <select className={inputClass} value={form.customerId} onChange={set('customerId')}>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Source Warehouse">
                    <select className={inputClass} value={form.sourceWarehouseId} onChange={set('sourceWarehouseId')}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {form.tripType === 'customer' ? (
                  <Field label="Source Warehouse">
                    <select className={inputClass} value={form.sourceWarehouseId} onChange={set('sourceWarehouseId')}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Destination Warehouse">
                    <select
                      className={inputClass}
                      value={form.destinationWarehouseId}
                      onChange={set('destinationWarehouseId')}
                    >
                      {warehouses
                        .filter((w) => w.id !== form.sourceWarehouseId)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
              </div>

              {form.tripType === 'customer' && (
                <Field label="Destination">
                  <input
                    className={inputClass}
                    value={form.destination}
                    onChange={set('destination')}
                    placeholder="e.g. Panda DC, Jeddah Industrial Area"
                  />
                </Field>
              )}

              <Field label="Transporter">
                <select className={inputClass} value={form.transporterId} onChange={set('transporterId')}>
                  {transporters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Dispatch Date">
                  <input type="date" className={inputClass} value={form.dispatchDate} onChange={set('dispatchDate')} />
                </Field>
                <Field label="Delivery Date">
                  <input type="date" className={inputClass} value={form.deliveryDate} onChange={set('deliveryDate')} />
                </Field>
              </div>

              {mode === 'edit' && (
                <>
                  <Field label="Load (Tons)">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className={inputClass}
                      value={form.loadTons}
                      onChange={set('loadTons')}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Driver Name">
                      <input className={inputClass} value={form.driverName} onChange={set('driverName')} placeholder="Optional" />
                    </Field>
                    <Field label="Driver Phone">
                      <input className={inputClass} value={form.driverPhone} onChange={set('driverPhone')} placeholder="Optional" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Plate No">
                      <input className={inputClass} value={form.plateNo} onChange={set('plateNo')} placeholder="Optional" />
                    </Field>
                    <Field label="Vehicle Type">
                      <select className={inputClass} value={form.vehicleType} onChange={set('vehicleType')}>
                        {vehicleTypes.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Status">
                    <select className={inputClass} value={form.status} onChange={set('status')}>
                      <option value="planned">Planned</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </Field>
                </>
              )}

              <Field label="Remarks">
                <textarea
                  className={`${inputClass} min-h-[72px] resize-none`}
                  value={form.remarks}
                  onChange={set('remarks')}
                  placeholder="Optional notes for this trip"
                />
              </Field>

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
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Customer</p>
                  <div className="rounded-lg border border-border p-3 text-[13px]">
                    <p className="font-medium text-text-primary">{originName}</p>
                  </div>
                </section>
              )}

              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Warehouse</p>
                <div className="rounded-lg border border-border p-3 text-[13px]">
                  <p className="font-medium text-text-primary">{getWarehouse(trip.sourceWarehouseId)?.name ?? '—'}</p>
                  <p className="text-text-muted">Dispatch warehouse</p>
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Destination</p>
                <div className="flex items-start gap-2 rounded-lg border border-border p-3 text-[13px]">
                  <Icon name="mapPin" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <p className="text-text-primary">{trip.destination}</p>
                </div>
              </section>

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
                  onClick={() => updateTrip(trip.id, { status: 'delivered' })}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-[#0F6B32] py-2.5 text-[13px] font-semibold text-white hover:bg-[#0B5227]"
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                  Confirm Delivery
                </button>
              )}
            </div>
          ) : trip && tab === 'documents' ? (
            <div className="flex flex-col gap-2">
              {trip.documents.length === 0 && (
                <p className="text-[13px] text-text-faint">No documents uploaded for this trip yet.</p>
              )}
              {trip.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-alt">
                    <Icon name="fileText" className="h-4 w-4 text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text-primary">{doc.name}</p>
                    <p className="text-[11.5px] text-text-muted">{doc.kind}</p>
                  </div>
                  <button type="button" className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-secondary">
                    <Icon name="download" className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong py-2.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover"
              >
                <Icon name="paperclip" className="h-3.5 w-3.5" />
                Upload document
              </button>
            </div>
          ) : trip && tab === 'timeline' ? (
            <div className="flex flex-col">
              {trip.timeline
                .slice()
                .reverse()
                .map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      {i < trip.timeline.length - 1 && <span className="w-px flex-1 bg-border" />}
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
                className="rounded-md bg-text-primary px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331]"
              >
                {mode === 'create' ? 'Create Trip' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
