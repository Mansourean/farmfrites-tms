import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../context/TripsContext'
import { useAuth } from '../context/AuthContext'
import { originLabel, transporterName } from '../data/lookup'
import { formatDateTime } from '../utils/format'
import { Icon } from '../components/ui/Icon'

const DELAY_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

function canOperateGate(role) {
  return role === 'admin' || role === 'gate'
}

// A completed gate visit (both timestamps set) -- shown as a read-only "last visit" summary.
// Doesn't imply the trip can be checked in again: once gate_check_in has moved status to
// 'At Gate', it never reverts to 'Waiting for Loading' on its own (checkout, see 0021,
// deliberately never changes status), so canCheckIn below -- not this -- decides that.
function isCheckedOut(trip) {
  return !!trip.gateCheckInAt && !!trip.gateCheckOutAt
}
function isAtGate(trip) {
  return !!trip.gateCheckInAt && !trip.gateCheckOutAt
}
// Mirrors gate_check_in's own server-side guard exactly (see 0021): a trip can only be checked
// in while it's Confirmed. Kept as its own status check, not derived from the gate timestamps,
// so the button here never offers an action the RPC would just reject.
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

// Trips currently sitting at the gate (checked in, not yet checked out), longest-waiting first
// so the truck most likely to be overdue is always at the top of the list.
function atGateList(trips) {
  return trips
    .filter(isAtGate)
    .sort((a, b) => new Date(a.gateCheckInAt).getTime() - new Date(b.gateCheckInAt).getTime())
}

export function GateCheck() {
  const { trips, findTripByPlateForGate, findTripBySalesNoForGate, checkInGate, checkOutGate } = useTrips()
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const editable = canOperateGate(currentUser?.role)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const [plate, setPlate] = useState('')
  const [salesNoInput, setSalesNoInput] = useState('')
  const [trip, setTrip] = useState(null)
  const [notFoundQuery, setNotFoundQuery] = useState('')
  const [delayReason, setDelayReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [result, setResult] = useState(null) // { type: 'checked-in' | 'checked-out', trip }
  // Ticks every 30s purely to force a re-render so elapsed durations / the delay alert stay
  // live without the user needing to touch anything -- no state is derived from the tick value
  // itself, it just makes `Date.now()` reads below re-evaluate.
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Live updates across gate terminals/sessions come from TripsContext's own global Realtime
  // subscription (see 0020/0021) -- `trips` here already reflects other sessions' check-ins/
  // outs without this page needing a subscription of its own; the effect below just keeps the
  // currently-selected trip in sync with that shared state.

  const selectTrip = (found, query) => {
    setActionError('')
    setDelayReason('')
    if (found) {
      setTrip(found)
      setNotFoundQuery('')
    } else {
      setTrip(null)
      setNotFoundQuery(query)
    }
  }

  // Re-reads the freshest copy of the currently selected trip from context (e.g. after a
  // realtime-triggered reload changed it out from under the page).
  useEffect(() => {
    if (!trip) return
    const fresh = trips.find((t) => t.id === trip.id)
    if (fresh) setTrip(fresh)
  }, [trips, trip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMatchPlate = (e) => {
    e?.preventDefault()
    if (!plate.trim()) return
    selectTrip(findTripByPlateForGate(plate), plate)
  }

  const handleMatchSalesNo = (e) => {
    e?.preventDefault()
    if (!salesNoInput.trim()) return
    selectTrip(findTripBySalesNoForGate(salesNoInput), salesNoInput)
  }

  const elapsedMs = trip?.gateCheckInAt ? Date.now() - new Date(trip.gateCheckInAt).getTime() : 0
  const isDelayed = isAtGate(trip ?? {}) && elapsedMs > DELAY_THRESHOLD_MS

  const handleCheckIn = async () => {
    setActionError('')
    setSubmitting(true)
    try {
      const updated = await checkInGate(trip.id)
      setResult({ type: 'checked-in', trip: updated })
    } catch (err) {
      setActionError(err.message || 'Could not check in this trip.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckOut = async (e) => {
    e.preventDefault()
    setActionError('')
    setSubmitting(true)
    try {
      const updated = await checkOutGate(trip.id, delayReason)
      setResult({ type: 'checked-out', trip: updated })
    } catch (err) {
      setActionError(err.message || 'Could not check out this trip.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setPlate('')
    setSalesNoInput('')
    setTrip(null)
    setNotFoundQuery('')
    setDelayReason('')
    setResult(null)
    setActionError('')
  }

  const waiting = useMemo(() => atGateList(trips), [trips])

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b0a] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-white text-[11px] font-bold text-[#0b0b0a]">FF</span>
        <div className="min-w-0 flex-1 leading-[1.15]">
          <p className="truncate text-[13px] font-semibold">Farm Frites — Gate Check-In / Check-Out</p>
          <p className="truncate text-[10.5px] text-white/50">Search a truck by Plate Number or Sales No</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          <Icon name="logOut" className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>

      {result ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#1E9E6A]">
            <Icon name="check" className="h-8 w-8" strokeWidth={2.5} />
          </span>
          <p className="text-[17px] font-semibold">{result.type === 'checked-in' ? 'Checked In' : 'Checked Out'}</p>
          <p className="text-[13px] text-white/60">
            {result.trip.salesNo} · {originLabel(result.trip)} → {result.trip.destination}
          </p>
          {result.type === 'checked-out' && (
            <p className="text-[13px] text-white/60">
              Gate duration: {formatDuration(new Date(result.trip.gateCheckOutAt) - new Date(result.trip.gateCheckInAt))}
            </p>
          )}
          <button type="button" onClick={reset} className="mt-4 rounded-lg bg-white px-5 py-2.5 text-[14px] font-semibold text-[#0b0b0a]">
            Next Truck
          </button>
          <Link to="/" className="mt-2 text-[13px] font-medium text-white/60 hover:text-white/80">
            Back to Transportation Log
          </Link>
        </div>
      ) : trip ? (
        <div className="flex flex-1 flex-col px-5 py-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Matched Trip</p>
          <div className="mt-2 rounded-xl border border-white/15 bg-white/5 p-4">
            <p className="text-[16px] font-semibold">{trip.salesNo}</p>
            <p className="mt-1 text-[13.5px] text-white/70">
              {originLabel(trip)} → {trip.destination}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] text-white/60">
              <p>
                Plate: <span className="text-white">{trip.plateNo || '—'}</span>
              </p>
              <p>
                Driver: <span className="text-white">{trip.driver?.name || '—'}</span>
              </p>
              <p className="col-span-2">
                Transporter: <span className="text-white">{transporterName(trip)}</span>
              </p>
            </div>
          </div>

          {isAtGate(trip) && (
            <div className={`mt-3 rounded-xl border p-4 ${isDelayed ? 'border-[#E5484D]/40 bg-[#E5484D]/10' : 'border-white/15 bg-white/5'}`}>
              {isDelayed && (
                <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#FF8A80]">
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  Delay Alert — over 2 hours at the gate
                </p>
              )}
              <p className="text-[12px] text-white/50">Checked in {formatDateTime(trip.gateCheckInAt)}</p>
              <p className="text-[22px] font-semibold tabular-nums">{formatDuration(elapsedMs)}</p>
              <p className="text-[11.5px] text-white/40">at the gate so far</p>
            </div>
          )}

          {isCheckedOut(trip) && (
            <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-4 text-[12.5px] text-white/70">
              <p>
                Last visit: {formatDateTime(trip.gateCheckInAt)} → {formatDateTime(trip.gateCheckOutAt)} (
                {formatDuration(new Date(trip.gateCheckOutAt) - new Date(trip.gateCheckInAt))})
              </p>
              {trip.gateDelayReason && <p className="mt-1 text-[#FF8A80]">Delay reason: {trip.gateDelayReason}</p>}
            </div>
          )}

          {actionError && <p className="mt-4 rounded-lg bg-[#4A1412] px-3 py-2 text-[12.5px] font-medium text-[#FF8A80]">{actionError}</p>}

          {!editable ? (
            <p className="mt-auto pt-8 text-center text-[13px] text-white/50">Your role does not have permission to perform gate actions.</p>
          ) : isAtGate(trip) ? (
            <form onSubmit={handleCheckOut} className="mt-auto flex flex-col gap-3 pt-8">
              {isDelayed && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-white/60">Delay Reason (required — over 2 hours)</span>
                  <textarea
                    autoFocus
                    required
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="e.g. Waiting on loading, paperwork delay, driver break..."
                    className="min-h-[80px] resize-none rounded-lg border border-white/20 bg-white/5 p-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#1E9E6A] py-8 text-[16px] font-semibold disabled:opacity-60"
              >
                <Icon name="check" className="h-7 w-7" strokeWidth={2.5} />
                {submitting ? 'Checking Out…' : 'Check Out'}
              </button>
            </form>
          ) : canCheckIn(trip) ? (
            <div className="mt-auto pt-8">
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={submitting}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[#4F7CFF] py-8 text-[16px] font-semibold disabled:opacity-60"
              >
                <Icon name="truck" className="h-7 w-7" strokeWidth={2.5} />
                {submitting ? 'Checking In…' : 'Check In'}
              </button>
            </div>
          ) : (
            <p className="mt-auto pt-8 text-center text-[13px] text-white/50">
              This trip must be Confirmed before it can be checked in at the gate (current status: {trip.status.replace(/_/g, ' ')}).
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-5 py-6">
          <form onSubmit={handleMatchPlate} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-white/60">Plate Number</span>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="e.g. 4521 KTB"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-[15px] tracking-wide text-white outline-none placeholder:text-white/30 focus:border-white/40"
              />
            </label>
            <button type="submit" className="rounded-lg bg-[#4F7CFF] py-2.5 text-[14px] font-semibold">
              Search
            </button>
          </form>

          <form onSubmit={handleMatchSalesNo} className="mt-4 flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-white/60">Sales No</span>
              <input
                value={salesNoInput}
                onChange={(e) => setSalesNoInput(e.target.value)}
                placeholder="e.g. SO-24681"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-[15px] tracking-wide text-white outline-none placeholder:text-white/30 focus:border-white/40"
              />
            </label>
            <button type="submit" className="rounded-lg border border-white/20 py-2.5 text-[14px] font-semibold">
              Search
            </button>
          </form>

          {notFoundQuery && (
            <p className="mt-3 text-[12.5px] text-[#FF8A80]">No trip matches “{notFoundQuery}”. Check the value and try again.</p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Currently at Gate ({waiting.length})</p>
            {waiting.length === 0 ? (
              <p className="text-[12.5px] text-white/40">No trucks currently at the gate.</p>
            ) : (
              waiting.map((t) => {
                const overdue = Date.now() - new Date(t.gateCheckInAt).getTime() > DELAY_THRESHOLD_MS
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTrip(t)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left ${
                      overdue ? 'border-[#E5484D]/40 bg-[#E5484D]/10' : 'border-white/15 bg-white/5'
                    }`}
                  >
                    <span>
                      <span className="block text-[13.5px] font-medium">{t.salesNo}</span>
                      <span className="block text-[12px] text-white/50">
                        {originLabel(t)} → {t.destination}
                      </span>
                    </span>
                    <span className={`text-[11px] font-medium uppercase tracking-wide ${overdue ? 'text-[#FF8A80]' : 'text-white/40'}`}>
                      {overdue ? 'Delayed' : formatDuration(Date.now() - new Date(t.gateCheckInAt).getTime())}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
