import { useEffect, useRef, useState } from 'react'
import { useTrips } from '../context/TripsContext'
import { originLabel, transporterName } from '../data/lookup'
import { Icon } from '../components/ui/Icon'

function normalizePlateGuess(rawText) {
  const cleaned = rawText.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/\b\d{3,4}\s?[A-Z]{2,3}\b/)
  return match ? match[0] : cleaned.slice(0, 12)
}

export function WarehouseScan() {
  const { findTripByPlate, markLoaded, rejectLoad } = useTrips()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraState, setCameraState] = useState('requesting') // requesting | ready | denied
  const [plate, setPlate] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [trip, setTrip] = useState(null)
  const [notFoundPlate, setNotFoundPlate] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState(null) // { type: 'loaded' | 'rejected', trip }

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

  const handleMatch = (e) => {
    e?.preventDefault()
    if (!plate.trim()) return
    const found = findTripByPlate(plate)
    if (found) {
      setTrip(found)
      setNotFoundPlate('')
    } else {
      setTrip(null)
      setNotFoundPlate(plate)
    }
  }

  const handleLoaded = () => {
    markLoaded(trip.id)
    setResult({ type: 'loaded', trip })
  }

  const handleRejectSubmit = (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    rejectLoad(trip.id, reason.trim())
    setResult({ type: 'rejected', trip })
  }

  const reset = () => {
    setPlate('')
    setTrip(null)
    setNotFoundPlate('')
    setRejecting(false)
    setReason('')
    setResult(null)
    setScanError('')
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
            className={`grid h-16 w-16 place-items-center rounded-full ${result.type === 'loaded' ? 'bg-[#1E9E6A]' : 'bg-[#E5484D]'}`}
          >
            <Icon name={result.type === 'loaded' ? 'check' : 'x'} className="h-8 w-8" strokeWidth={2.5} />
          </span>
          <p className="text-[17px] font-semibold">{result.type === 'loaded' ? 'Marked as Loaded' : 'Load Rejected'}</p>
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

          {!rejecting ? (
            <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#E5484D] py-8 text-[16px] font-semibold"
              >
                <Icon name="x" className="h-7 w-7" strokeWidth={2.5} />
                Reject
              </button>
              <button
                type="button"
                onClick={handleLoaded}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#1E9E6A] py-8 text-[16px] font-semibold"
              >
                <Icon name="check" className="h-7 w-7" strokeWidth={2.5} />
                Loaded
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
                <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-white/20 py-3 text-[14px] font-medium">
                  Back
                </button>
                <button type="submit" className="rounded-lg bg-[#E5484D] py-3 text-[14px] font-semibold">
                  Confirm Reject
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

            {notFoundPlate && (
              <p className="text-[12.5px] text-[#FF8A80]">
                No planned or in-transit trip found for plate “{notFoundPlate}”. Check the number and try again.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
