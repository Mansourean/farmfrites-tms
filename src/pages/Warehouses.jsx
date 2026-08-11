import { Link } from 'react-router-dom'
import { useTrips } from '../context/TripsContext'
import { Icon } from '../components/ui/Icon'
import { TripStatusPill } from '../components/trips/TripStatusPill'
import { originLabel, transporterName } from '../data/lookup'
import { formatDate } from '../utils/format'

// Operational visibility for the warehouse: what's Confirmed (driver/vehicle already
// submitted, truck expected), what's At Gate (the truck has actually arrived), and what's
// already Loaded (waiting to depart) -- the same statuses WarehouseScan.jsx treats as "the
// warehouse's job right now" (see 0016, extended by 0021). Soonest Loading Date first (trips
// with no Loading Date yet sort last -- nothing to prepare for yet), so the warehouse can see
// what's coming today/tomorrow at a glance.
function upcomingTrips(trips) {
  return trips
    .filter((t) => t.status === 'waiting_for_loading' || t.status === 'at_gate' || t.status === 'loaded')
    .sort((a, b) => {
      if (!a.dispatchDate && !b.dispatchDate) return b.createdSeq - a.createdSeq
      if (!a.dispatchDate) return 1
      if (!b.dispatchDate) return -1
      return a.dispatchDate.localeCompare(b.dispatchDate)
    })
}

export function Warehouses() {
  const { trips } = useTrips()
  const rows = upcomingTrips(trips)

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-alt p-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-primary">Warehouse Loading Scan</p>
          <p className="text-[12.5px] text-text-muted">Open on a phone to scan a truck plate and mark it loaded or rejected.</p>
        </div>
        <Link
          to="/warehouse/scan"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink-text)] hover:bg-[var(--color-ink-hover)]"
        >
          <Icon name="camera" className="h-3.5 w-3.5" />
          Open Scanner
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-alt p-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-primary">Gate Check-In / Check-Out</p>
          <p className="text-[12.5px] text-text-muted">Open at the gate to see today's confirmed and at-gate trucks and record check-in/check-out.</p>
        </div>
        <Link
          to="/gate"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink-text)] hover:bg-[var(--color-ink-hover)]"
        >
          <Icon name="truck" className="h-3.5 w-3.5" />
          Open Gate
        </Link>
      </div>

      <p className="mb-3 text-[13px] text-text-muted">
        {rows.length} confirmed/upcoming trip{rows.length === 1 ? '' : 's'}
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border py-16 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-alt">
            <Icon name="warehouse" className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-[14px] font-medium text-text-primary">No confirmed trips coming up</p>
          <p className="text-[13px] text-text-muted">Trips appear here once a transporter submits driver/vehicle info.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead className="bg-surface-alt text-[11px] font-medium uppercase tracking-wide text-text-faint">
              <tr>
                <th className="border-b border-border px-3 py-2 text-left">Sales No</th>
                <th className="border-b border-border px-3 py-2 text-left">Client</th>
                <th className="border-b border-border px-3 py-2 text-left">Destination</th>
                <th className="border-b border-border px-3 py-2 text-left">Transporter</th>
                <th className="border-b border-border px-3 py-2 text-left">Loading Date</th>
                <th className="border-b border-border px-3 py-2 text-left">Driver / Vehicle</th>
                <th className="border-b border-border px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((trip, i) => (
                <tr key={trip.id} className={i !== rows.length - 1 ? 'border-b border-border/60' : ''}>
                  <td className="px-3 py-2.5 font-medium text-text-primary">{trip.salesNo}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-text-primary">{originLabel(trip)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-text-primary">{trip.destination}</td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-text-primary">{transporterName(trip)}</td>
                  <td className="px-3 py-2.5 text-text-primary">{formatDate(trip.dispatchDate)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-text-primary">
                    {trip.driver?.name ? `${trip.driver.name} · ${trip.plateNo || '—'}` : <span className="text-text-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <TripStatusPill status={trip.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
