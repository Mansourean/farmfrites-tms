import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrips } from '../context/TripsContext'
import { useAuth } from '../context/AuthContext'
import { canEdit } from '../data/roles'
import { originLabel, transporterName } from '../data/lookup'
import { Icon } from '../components/ui/Icon'

function normalizePlateGuess(rawText) {
  const cleaned = rawText.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/\b\d{3,4}\s?[A-Z]{2,3}\b/)
  return match ? match[0] : cleaned.slice(0, 12)
}

// Operational workflow (see 0016, extended by 0021): the trips a warehouse employee has any
// reason to act on -- eligible for Loaded/Reject ('waiting_for_loading', i.e. the transporter
// has already submitted driver/vehicle, or 'at_gate' once the truck has also been checked in)
// or In Transit ('loaded'). Newest first, matching the rest of the app's default ordering.
function upcomingTrips(trips) {
  return trips
    .filter((t) => t.status === 'waiting_for_loading' || t.status === 'at_gate' || t.status === 'loaded')
    .sort((a, b) => b.createdSeq - a.createdSeq)
}

export function WarehouseScan() {
  const { trips, findTripByPlate, findTripBySalesNo, markLoaded, rejectLoad, markInTransit } = useTrips()
  const { currentUser } = useAuth()
  const editable = canEdit(currentUser?.role)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraState, setCameraState] = useState('requesting') // requesting | ready | denied
  const [plate, setPlate] = useState('')
  const [salesNoInput, setSalesNoInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [trip, setTrip] = useState(null)
  const [notFoundQuery, setNotFoundQuery] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState(null) // { type: 'loaded' | 'in_transit' | 'rejected', trip }
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setCameraState('ready')
      } catch {
        if (!cancelled) setCameraState('denied')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  const handleCaptureAndScan = async () => {
    setScanError('')
    setScanning(true)
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video?.videoWidth || 640
      canvas.height = video?.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data } = await worker.recognize(dataUrl)
      await worker.terminate()

      const guess = normalizePlateGuess(data.text || '')
      if (guess) setPlate(guess)
      else setScanError('Could not read the plate clearly — please enter it manually.')
    } catch {
      setScanError('Scan failed — please enter the plate number manually.')
    } finally {
      setScanning(false)
    }
  }

  const selectTrip = (found, query) => {
    setActionError('')
    if (found) {
      setTrip(found)
      setNotFoundQuery('')
    } else {
      setTrip(null)
      setNotFoundQuery(query)
    }
  }

  const handleMatch = (e) => {
    e?.preventDefault()
    if (!plate.trim()) return
    selectTrip(findTripByPlate(plate), plate)
  }

  const handleMatchSalesNo = (e) => {
    e?.preventDefault()
    if (!salesNoInput.trim()) return
    selectTrip(findTripBySalesNo(salesNoInput), salesNoInput)
  }

  const handleLoaded = async () => {
    setActionError('')
    setSubmitting(true)
    try {
      const updated = await markLoaded(trip.id)
      setResult({ type: 'loaded', trip: updated })
    } catch (err) {
      setActionError(err.message || 'Could not confirm loading for this trip.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInTransit = async () => {
    setActionError('')
    setSubmitting(true)
    try {
      const updated = await markInTransit(trip.id)
      setResult({ type: 'in_transit', trip: updated })
    } catch (err) {
      setActionError(err.message || 'Could not update this trip to In Transit.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    setActionError('')
    setSubmitting(true)
    try {
      const updated = await rejectLoad(trip.id, reason.trim())
      setResult({ type: 'rejected', trip: updated })
    } catch (err) {
      setActionError(err.message || 'Could not reject this load.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setPlate('')
    setSalesNoInput('')
    setTrip(null)
    setNotFoundQuery('')
    setRejecting(false)
    setReason('')
    setResult(null)
    setScanError('')
    setActionError('')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0b0a] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-white text-[11px] font-bold text-[#0b0b0a]">FF</span>
        <div className="leading-[1.15]">
          <p className="text-[13px] font-semibold">Farm Frites — Warehouse Scan</p>
          <p className="text-[10.5px] text-white/50">Truck loading verification</p>
        </div>
      </div>

      {result ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span
            className={`grid h-16 w-16 place-items-center rounded-full ${
              result.type === 'loaded' ? 'bg-[#1E9E6A]' : result.type === 'in_transit' ? 'bg-[#4F7CFF]' : 'bg-[#E5484D]'
            }`}
          >
            <Icon name={result.type === 'rejected' ? 'x' : result.type === 'in_transit' ? 'truck' : 'check'} className="h-8 w-8" strokeWidth={2.5} />
          </span>
          <p className="text-[17px] font-semibold">
            {result.type === 'loaded' ? 'Marked as Loaded' : result.type === 'in_transit' ? 'Marked as In Transit' : 'Load Rejected'}
          </p>
          <p className="text-[13px] text-white/60">
            {result.trip.salesNo} · {originLabel(result.trip)} → {result.trip.destination}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-white px-5 py-2.5 text-[14px] font-semibold text-[#0b0b0a]"
          >
            Scan Next Truck
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
            <p className="mt-1 text-[13.5px] text-white/70">{originLabel(trip)} → {trip.destination}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] text-white/60">
              <p>Load: <span className="text-white">{trip.loadTons} tons</span></p>
              <p>Plate: <span className="text-white">{trip.plateNo}</span></p>
              <p className="col-span-2">Transporter: <span className="text-white">{transporterName(trip)}</span></p>
            </div>
          </div>

          {actionError && (
            <p className="mt-4 rounded-lg bg-[#4A1412] px-3 py-2 text-[12.5px] font-medium text-[#FF8A80]">{actionError}</p>
          )}

          {!editable ? (
            <p className="mt-auto pt-8 text-center text-[13px] text-white/50">
              Your role does not have permission to update this trip.
            </p>
          ) : trip.status === 'loaded' ? (
            <div className="mt-auto pt-8">
              <button
                type="button"
                onClick={handleInTransit}
                disabled={submitting}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-[#4F7CFF] py-8 text-[16px] font-semibold disabled:opacity-60"
              >
                <Icon name="truck" className="h-7 w-7" strokeWidth={2.5} />
                {submitting ? 'Updating…' : 'Mark In Transit'}
              </button>
            </div>
          ) : !rejecting ? (
            <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={submitting}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#E5484D] py-8 text-[16px] font-semibold disabled:opacity-60"
              >
                <Icon name="x" className="h-7 w-7" strokeWidth={2.5} />
                Reject
              </button>
              <button
                type="button"
                onClick={handleLoaded}
                disabled={submitting}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#1E9E6A] py-8 text-[16px] font-semibold disabled:opacity-60"
              >
                <Icon name="check" className="h-7 w-7" strokeWidth={2.5} />
                {submitting ? 'Confirming…' : 'Loaded'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRejectSubmit} className="mt-auto flex flex-col gap-3 pt-8">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-white/60">Reason for rejection</span>
                <textarea
                  autoFocus
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Truck not clean, temperature not reached, wrong vehicle..."
                  className="min-h-[90px] resize-none rounded-lg border border-white/20 bg-white/5 p-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  disabled={submitting}
                  className="rounded-lg border border-white/20 py-3 text-[14px] font-medium disabled:opacity-60"
                >
                  Back
                </button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-[#E5484D] py-3 text-[14px] font-semibold disabled:opacity-60">
                  {submitting ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-black">
            {cameraState !== 'denied' && (
              /* eslint-disable-next-line jsx-a11y/media-has-caption */
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            )}
            {cameraState === 'requesting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[13px] text-white/70">
                Requesting camera access…
              </div>
            )}
            {cameraState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 px-6 text-center">
                <Icon name="camera" className="h-6 w-6 text-white/40" />
                <p className="text-[13px] text-white/60">Camera unavailable — enter the plate number manually below.</p>
              </div>
            )}
            {cameraState === 'ready' && (
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/50" />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3 px-5 py-5">
            {cameraState === 'ready' && (
              <button
                type="button"
                onClick={handleCaptureAndScan}
                disabled={scanning}
                className="flex items-center justify-center gap-2 rounded-lg bg-white py-3 text-[14px] font-semibold text-[#0b0b0a] disabled:opacity-60"
              >
                <Icon name="camera" className="h-4 w-4" />
                {scanning ? 'Scanning…' : 'Capture & Scan Plate'}
              </button>
            )}
            {scanError && <p className="text-[12.5px] text-[#FF8A80]">{scanError}</p>}

            <form onSubmit={handleMatch} className="flex flex-col gap-2">
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
                Match Trip
              </button>
            </form>

            <form onSubmit={handleMatchSalesNo} className="flex flex-col gap-2">
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
                Match Trip
              </button>
            </form>

            {notFoundQuery && (
              <p className="text-[12.5px] text-[#FF8A80]">
                No trip ready for the warehouse matches “{notFoundQuery}”. Check the value and try again.
              </p>
            )}

            <div className="mt-2 flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Upcoming Trips</p>
              {upcomingTrips(trips).length === 0 ? (
                <p className="text-[12.5px] text-white/40">No trips waiting on the warehouse right now.</p>
              ) : (
                upcomingTrips(trips).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTrip(t)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-left"
                  >
                    <span>
                      <span className="block text-[13.5px] font-medium">{t.salesNo}</span>
                      <span className="block text-[12px] text-white/50">{originLabel(t)} → {t.destination}</span>
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                      {t.status === 'loaded' ? 'Loaded' : 'Ready'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
