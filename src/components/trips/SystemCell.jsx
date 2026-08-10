import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { TripStatusPill } from './TripStatusPill'
import { useTrips } from '../../context/TripsContext'
import { originLabel, transporterName } from '../../data/lookup'
import { autoReadyStatus } from '../../lib/tripsMapping'
import { formatDate } from '../../utils/format'
import { getInitials } from '../../utils/initials'

function WaitingDriverBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE7C2] px-2 py-[2px] text-[11px] font-semibold text-[#8A4B00]">
      <Icon name="clock" className="h-3 w-3" />
      Waiting Driver
    </span>
  )
}

function NeedsDateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE7C2] px-2 py-[2px] text-[11px] font-semibold text-[#8A4B00]">
      <Icon name="clock" className="h-3 w-3" />
      Needs Date
    </span>
  )
}

// Click-to-edit: the "Needs Date" badge (and an already-filled date) both open a native date
// picker right in the cell -- no need to open the trip panel just to set this one field. Picking
// a date saves immediately and applies the same New-Order -> Transportation-Assignment
// auto-promotion rule TripPanel's own Requested Delivery Date field uses (see autoReadyStatus).
function DeliveryDateCell({ trip }) {
  const { updateTrip } = useTrips()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.showPicker?.()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        autoFocus
        defaultValue={trip.deliveryDate || ''}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const value = e.target.value
          setEditing(false)
          if (!value) return
          const status = autoReadyStatus(trip.tripType, trip.status, value)
          updateTrip(trip.id, { deliveryDate: value, ...(status ? { status } : {}) })
        }}
        className="w-full rounded border border-border-strong bg-white px-1.5 py-1 text-[12.5px] text-text-primary outline-none focus:border-accent-green-500"
      />
    )
  }

  const needsDate = !trip.deliveryDate && trip.tripType === 'customer' && trip.status === 'planned'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className="flex w-full items-center text-left"
    >
      {needsDate ? <NeedsDateBadge /> : <span className="text-text-secondary">{formatDate(trip.deliveryDate)}</span>}
    </button>
  )
}

// Click-to-edit, same interaction as DeliveryDateCell above: a transporter is no longer
// pre-selected at trip creation (per approved decision -- it's chosen once the customer's
// delivery date is confirmed, not before), so this is the fast way to assign/reassign one
// without opening the trip panel.
function TransporterCell({ trip }) {
  const { transporters, updateTrip } = useTrips()
  const [editing, setEditing] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => {
    if (editing) selectRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <select
        ref={selectRef}
        defaultValue={trip.transporterId || ''}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          setEditing(false)
          updateTrip(trip.id, { transporterId: e.target.value })
        }}
        className="w-full rounded border border-border-strong bg-white px-1.5 py-1 text-[12.5px] text-text-primary outline-none focus:border-accent-green-500"
      >
        <option value="">Not assigned yet</option>
        {transporters.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className="flex w-full items-center text-left"
    >
      <span className="truncate text-text-secondary">{transporterName(trip)}</span>
    </button>
  )
}

export function SystemCell({ columnId, trip }) {
  switch (columnId) {
    case 'salesNo':
      return <span className="truncate font-semibold text-text-primary hover:underline">{trip.salesNo}</span>

    case 'origin':
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          {trip.tripType === 'internal' && (
            <span className="shrink-0 rounded-[4px] bg-surface-alt px-1 text-[10px] font-semibold text-text-muted">
              INT
            </span>
          )}
          <span className="truncate">{originLabel(trip)}</span>
        </span>
      )

    case 'destination':
      return <span className="truncate text-text-secondary">{trip.destination}</span>

    case 'transporter':
      return <TransporterCell trip={trip} />

    case 'driver':
      return trip.driver ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={trip.driver.name} initials={getInitials(trip.driver.name)} size={18} />
          <span className="truncate text-text-secondary">{trip.driver.name}</span>
        </span>
      ) : (
        <WaitingDriverBadge />
      )

    case 'plateNo':
      return <span className="truncate tabular-nums text-text-secondary">{trip.plateNo || <span className="text-text-faint">—</span>}</span>

    case 'driverPhone':
      return <span className="truncate text-text-secondary">{trip.driver?.phone || <span className="text-text-faint">—</span>}</span>

    case 'vehicleType':
      return <span className="truncate text-text-secondary">{trip.vehicleType || <span className="text-text-faint">—</span>}</span>

    case 'dispatchDate':
      return <span className="text-text-secondary">{formatDate(trip.dispatchDate)}</span>

    case 'deliveryDate':
      return <DeliveryDateCell trip={trip} />

    case 'status':
      return <TripStatusPill status={trip.status} />

    case 'remarks':
      return <span className="truncate text-text-secondary">{trip.remarks || <span className="text-text-faint">—</span>}</span>

    default:
      return null
  }
}
