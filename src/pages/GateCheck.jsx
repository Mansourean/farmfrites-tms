import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrips } from '../context/TripsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { originLabel } from '../data/lookup'
import { formatDate } from '../utils/format'
import { Icon } from '../components/ui/Icon'
import { TripStatusPill } from '../components/trips/TripStatusPill'

const DELAY_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

function canOperateGate(role) {
  return role === 'admin' || role === 'gate'
}

function isCheckedOut(trip) {
  return !!trip.gateCheckInAt && !!trip.gateCheckOutAt
}
function isAtGate(trip) {
  return !!trip.gateCheckInAt && !trip.gateCheckOutAt
}
// Mirrors gate_check_in's own server-side guard exactly (see 0021/0022): a trip can only be
// checked in while it's Confirmed.
function canCheckIn(trip) {
  return trip.status === 'waiting_for_loading'
}

function formatDuration(ms) {
  if (ms < 0) ms = 0
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

// dispatchDate is a plain calendar date (YYYY-MM-DD, UTC-anchored -- see utils/format.js's own
// comment on why formatDate pins to UTC), so "today" is computed the same way here rather than
// through the viewer's local timezone -- comparing those two conventions against each other is
// exactly the class of bug already fixed once in this app (Loading Date showing a day early).
function isDispatchDateToday(dateStr) {
  if (!dateStr) return false
  return dateStr === new Date().toISOString().slice(0, 10)
}

// gate_check_out_at is a real timestamp (an actual moment), not a calendar-only date, so "today"
// here deliberately uses the viewer's local calendar day instead -- the gate employee thinks in
// terms of their own today, same reasoning formatDateTime already uses local time for real
// timestamps elsewhere in the app.
function isTimestampToday(iso) {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

// The table shows exactly what a gate employee needs today, with no search required: trucks
// confirmed and loading today (not yet checked in), anything currently at the gate regardless
// of date (it's physically present until it leaves), and anything checked out today (so the
// completed Gate Duration/status stays visible for the rest of the day).
function isRelevantToday(trip) {
  if (isAtGate(trip)) return true
  if (isCheckedOut(trip) && isTimestampToday(trip.gateCheckOutAt)) return true
  if (trip.status === 'waiting_for_loading' && isDispatchDateToday(trip.dispatchDate)) return true
  return false
}

function DelayReasonModal({ trip, onCancel, onConfirm, submitting }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-[400px] rounded-xl bg-surface shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[14px] font-semibold text-text-primary">Delay Reason Required</p>
          <p className="mt-1 text-[12.5px] text-text-muted">
            {trip.salesNo} · {trip.plateNo || '—'} has been at the gate over 2 hours. A reason is required to check out.
          </p>
        </div>
        <div className="px-5 py-4">
          <textarea
            autoFocus
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Waiting on loading, paperwork delay, driver break..."
            className="min-h-[90px] w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent-green-500"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-accent-green-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-green-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Checking Out…' : 'Confirm Check Out'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GateCheck() {
  const { trips, checkInGate, checkOutGate } = useTrips()
  const { currentUser, logout } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const editable = canOperateGate(currentUser?.role)

  const [search, setSearch] = useState('')
  const [submittingId, setSubmittingId] = useState(null)
  const [delayModalTrip, setDelayModalTrip] = useState(null)
  // Ticks every 30s purely to force a re-render so elapsed Gate Time / delay highlighting stay
  // live without anyone needing to touch anything -- see the same pattern used elsewhere in
  // this app for the same reason (e.g. TripsTable's justUpdated pulse).
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const normalizedSearch = search.trim().toUpperCase()
  const rows = trips
    .filter(isRelevantToday)
    .filter(
      (t) =>
        !normalizedSearch ||
        t.plateNo.toUpperCase().includes(normalizedSearch) ||
        t.salesNo.toUpperCase().includes(normalizedSearch),
    )
    .sort((a, b) => {
      // At-gate trucks first (longest-waiting first, most likely to need attention), then
      // not-yet-checked-in confirmed trucks, then completed ones at the bottom.
      const rank = (t) => (isAtGate(t) ? 0 : isCheckedOut(t) ? 2 : 1)
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      if (ra === 0) return new Date(a.gateCheckInAt) - new Date(b.gateCheckInAt)
      return b.createdSeq - a.createdSeq
    })

  const handleCheckIn = async (trip) => {
    setSubmittingId(trip.id)
    try {
      await checkInGate(trip.id)
      notify(`${trip.salesNo} checked in at the gate.`, { type: 'success' })
    } catch (err) {
      notify(err.message || 'Could not check in this trip.', { type: 'error' })
    } finally {
      setSubmittingId(null)
    }
  }

  const handleCheckOutClick = (trip) => {
    const elapsedMs = Date.now() - new Date(trip.gateCheckInAt).getTime()
    if (elapsedMs > DELAY_THRESHOLD_MS) {
      setDelayModalTrip(trip)
      return
    }
    submitCheckOut(trip, null)
  }

  const submitCheckOut = async (trip, reason) => {
    setSubmittingId(trip.id)
    try {
      await checkOutGate(trip.id, reason)
      notify(`${trip.salesNo} checked out at the gate.`, { type: 'success' })
      setDelayModalTrip(null)
    } catch (err) {
      notify(err.message || 'Could not check out this trip.', { type: 'error' })
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[var(--color-ink)] text-[11px] font-bold text-[var(--color-ink-text)]">
          FF
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-text-primary">Gate Check-In / Check-Out</p>
          <p className="truncate text-[12px] text-text-muted">Today's confirmed, at-gate, and completed trucks</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Icon name="search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by Plate No or Sales No..."
            className="w-full rounded-md border border-border-strong bg-surface-alt py-1.5 pl-7 pr-2 text-[13px] text-text-primary outline-none placeholder:text-text-faint focus:border-brand-400 focus:bg-surface"
          />
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <Icon name="logOut" className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>

      {!editable && (
        <p className="border-b border-border bg-[var(--color-warning-bg)] px-4 py-2 text-[12.5px] font-medium text-[var(--color-warning-text)] sm:px-6">
          Your role does not have permission to perform gate actions -- viewing only.
        </p>
      )}

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-16 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-alt">
              <Icon name="truck" className="h-5 w-5 text-text-muted" />
            </div>
            <p className="text-[14px] font-medium text-text-primary">
              {normalizedSearch ? 'No trucks match your filter' : 'No relevant trucks right now'}
            </p>
            <p className="text-[13px] text-text-muted">
              {normalizedSearch ? 'Try a different plate or sales number.' : "Confirmed trucks loading today will appear here automatically."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead className="bg-surface-alt text-[11px] font-medium uppercase tracking-wide text-text-faint">
                <tr>
                  <th className="border-b border-border px-3 py-2.5 text-left">Plate No</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Sales No</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Client</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Destination</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Driver</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Loading Date</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Status</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Gate Time</th>
                  <th className="border-b border-border px-3 py-2.5 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((trip, i) => {
                  const atGate = isAtGate(trip)
                  const checkedOut = isCheckedOut(trip)
                  const elapsedMs = trip.gateCheckInAt ? Date.now() - new Date(trip.gateCheckInAt).getTime() : 0
                  const delayed = atGate && elapsedMs > DELAY_THRESHOLD_MS
                  const submitting = submittingId === trip.id

                  return (
                    <tr key={trip.id} className={i !== rows.length - 1 ? 'border-b border-border/60' : ''}>
                      <td className="px-3 py-2.5 text-[14px] font-bold tabular-nums text-text-primary">{trip.plateNo || '—'}</td>
                      <td className="px-3 py-2.5 font-medium text-text-primary">{trip.salesNo}</td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-text-primary">{originLabel(trip)}</td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-text-primary">{trip.destination}</td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-text-primary">{trip.driver?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-text-primary">{formatDate(trip.dispatchDate)}</td>
                      <td className="px-3 py-2.5">
                        <TripStatusPill status={trip.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        {atGate ? (
                          <span className={`font-semibold tabular-nums ${delayed ? 'text-[var(--color-danger-text)]' : 'text-text-primary'}`}>
                            {delayed && <Icon name="clock" className="mr-1 inline h-3 w-3" />}
                            {formatDuration(elapsedMs)}
                          </span>
                        ) : checkedOut ? (
                          <span className="text-text-primary">
                            {formatDuration(new Date(trip.gateCheckOutAt) - new Date(trip.gateCheckInAt))}
                            {trip.gateDelayReason && <span className="ml-1 text-[11px] text-[var(--color-danger-text)]">(delayed)</span>}
                          </span>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {!editable ? (
                          <span className="text-text-faint">—</span>
                        ) : atGate ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleCheckOutClick(trip)}
                            className="rounded-md bg-[var(--color-danger-text)] px-2.5 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submitting ? 'Checking Out…' : 'Check Out'}
                          </button>
                        ) : canCheckIn(trip) ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleCheckIn(trip)}
                            className="rounded-md bg-accent-green-500 px-2.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-accent-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submitting ? 'Checking In…' : 'Check In'}
                          </button>
                        ) : (
                          <span className="text-text-faint">Completed</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {delayModalTrip && (
        <DelayReasonModal
          trip={delayModalTrip}
          submitting={submittingId === delayModalTrip.id}
          onCancel={() => setDelayModalTrip(null)}
          onConfirm={(reason) => submitCheckOut(delayModalTrip, reason)}
        />
      )}
    </div>
  )
}
