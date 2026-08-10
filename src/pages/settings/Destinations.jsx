import { useState } from 'react'
import { useTrips } from '../../context/TripsContext'
import { useToast } from '../../context/ToastContext'
import { updateDestinationTransitDays } from '../../services/masterDataActions'

// The only place Transit Days can be corrected/added after a destination already exists (see
// 0018) -- the inline "+" dialog in TripPanel only ever sets it at creation time. Every
// destination in production predates 0017, so this is the actual place someone needs to visit
// to make the New Trip "suggested Loading Date" feature do anything at all.
export function Destinations() {
  const { destinations, refreshMasterData } = useTrips()
  const { notify } = useToast()
  const [savingId, setSavingId] = useState(null)

  const handleChange = async (destination, rawValue) => {
    const trimmed = rawValue.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      notify('Enter a valid number of days.', { type: 'error' })
      return
    }
    if (value === (destination.transitDays ?? null)) return

    setSavingId(destination.id)
    try {
      await updateDestinationTransitDays(destination.id, value)
      await refreshMasterData()
      notify('Transit Days updated.', { type: 'success' })
    } catch (err) {
      notify(err.message || 'Could not update Transit Days.', { type: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <p className="mb-3 text-[13px] text-text-muted">
        {destinations.length} destinations · Transit Days is the realistic travel time from Sudair to that city
        (including a safety buffer) -- it drives the Loading Date suggestion on New Trip.
      </p>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-2 border-b border-border bg-surface-alt px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
          <span className="flex-1">Destination</span>
          <span className="w-28 shrink-0">Transit Days</span>
        </div>
        {destinations.map((destination, i) => (
          <div
            key={destination.id}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] ${i !== destinations.length - 1 ? 'border-b border-border' : ''}`}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{destination.name}</span>
            <input
              type="number"
              min={0}
              defaultValue={destination.transitDays ?? ''}
              placeholder="Not set"
              disabled={savingId === destination.id}
              onBlur={(e) => handleChange(destination, e.target.value)}
              className="w-28 shrink-0 rounded-md border border-border-strong bg-white px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-brand-400 disabled:opacity-60"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
