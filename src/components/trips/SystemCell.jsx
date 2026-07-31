import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { TripStatusPill } from './TripStatusPill'
import { originLabel, transporterName } from '../../data/lookup'
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
      return <span className="truncate text-text-secondary">{transporterName(trip)}</span>

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
      return <span className="text-text-secondary">{formatDate(trip.deliveryDate)}</span>

    case 'status':
      return <TripStatusPill status={trip.status} />

    case 'remarks':
      return <span className="truncate text-text-secondary">{trip.remarks || <span className="text-text-faint">—</span>}</span>

    default:
      return null
  }
}
