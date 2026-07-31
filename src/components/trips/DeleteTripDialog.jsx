import { useMemo } from 'react'
import { useDeleteTrip } from '../../context/DeleteTripContext'
import { useTripPanel } from '../../context/TripPanelContext'
import { useTrips } from '../../context/TripsContext'
import { originLabel } from '../../data/lookup'
import { Icon } from '../ui/Icon'

export function DeleteTripDialog() {
  const { tripId, close } = useDeleteTrip()
  const { tripId: panelTripId, close: closePanel } = useTripPanel()
  const { trips, deleteTrip } = useTrips()
  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId])

  if (!trip) return null

  const handleConfirm = () => {
    deleteTrip(trip.id)
    if (panelTripId === trip.id) closePanel()
    close()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={close} />
      <div className="relative w-full max-w-[420px] rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FBE7E5] text-[#B42318]">
              <Icon name="trash" className="h-4 w-4" />
            </span>
            <p className="text-[14px] font-semibold text-text-primary">Delete Trip</p>
          </div>
          <button type="button" onClick={close} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-[13px] text-text-secondary">
            Are you sure you want to permanently delete <span className="font-medium text-text-primary">{trip.salesNo}</span>{' '}
            ({originLabel(trip)} → {trip.destination})? This cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 rounded-md bg-[#B42318] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#98190F]"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            Delete Trip
          </button>
        </div>
      </div>
    </div>
  )
}
