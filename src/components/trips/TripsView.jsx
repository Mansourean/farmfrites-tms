import { TripsTable } from './TripsTable'
import { TripCard } from './TripCard'
import { Icon } from '../ui/Icon'
import { useFlipList } from '../../hooks/useFlipList'

export function TripsView({ trips }) {
  const setCardRef = useFlipList(trips.map((t) => t.id).join('|'))

  if (trips.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-alt">
          <Icon name="truck" className="h-5 w-5 text-text-muted" />
        </div>
        <p className="text-[14px] font-medium text-text-primary">No trips match your filters</p>
        <p className="text-[13px] text-text-muted">Try adjusting the filters or search above.</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <TripsTable trips={trips} />
      </div>
      <div className="md:hidden">
        {trips.map((trip) => (
          <div key={trip.id} ref={setCardRef(trip.id)}>
            <TripCard trip={trip} />
          </div>
        ))}
      </div>
    </>
  )
}
