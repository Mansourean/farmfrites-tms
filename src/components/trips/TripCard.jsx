import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { TripStatusPill, statusConfig } from './TripStatusPill'
import { RowMenu } from './RowMenu'
import { useTripPanel } from '../../context/TripPanelContext'
import { useTrips } from '../../context/TripsContext'
import { originLabel, transporterName } from '../../data/lookup'
import { formatDate } from '../../utils/format'
import { getInitials } from '../../utils/initials'
import { cn } from '../../utils/cn'

export function TripCard({ trip }) {
  const { openView } = useTripPanel()
  const { justUpdated } = useTrips()
  const isFresh = justUpdated.has(trip.id)
  const accentColor = statusConfig[trip.status]?.color ?? statusConfig.planned.color

  return (
    <div
      onClick={() => openView(trip.id, 'details')}
      style={{ borderLeft: `3px solid ${accentColor}` }}
      className={cn(
        'flex flex-col gap-2 border-b border-border p-2.5 pl-[13px] transition-colors duration-700 active:bg-surface-hover',
        isFresh && 'bg-[var(--color-success-bg)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-text-primary">{originLabel(trip)}</p>
          <p className="truncate text-[12.5px] text-text-muted">
            <span className="font-semibold text-text-secondary">{trip.salesNo}</span> · {trip.destination}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TripStatusPill status={trip.status} />
          <RowMenu tripId={trip.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-surface-alt p-2 text-[12.5px]">
        <div className="flex items-center gap-1.5 text-text-secondary">
          <Icon name="truck" className="h-3.5 w-3.5 text-text-muted" />
          <span className="truncate">{transporterName(trip)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary tabular-nums">
          <Icon name="link" className="h-3.5 w-3.5 text-text-muted" />
          {trip.plateNo || '—'}
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          {trip.driver ? (
            <>
              <Avatar name={trip.driver.name} initials={getInitials(trip.driver.name)} size={16} />
              <span className="truncate">{trip.driver.name}</span>
            </>
          ) : (
            <span className="text-text-faint">—</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <Icon name="calendar" className="h-3.5 w-3.5 text-text-muted" />
          Dispatch {formatDate(trip.dispatchDate)}
        </div>
        <div className="col-span-2 flex items-center gap-1.5 text-text-secondary">
          <Icon name="calendar" className="h-3.5 w-3.5 text-text-muted" />
          Delivery {formatDate(trip.deliveryDate)}
        </div>
      </div>

      {trip.remarks && <p className="truncate text-[12px] text-text-muted">{trip.remarks}</p>}
    </div>
  )
}
