import { useEffect, useMemo, useState } from 'react'
import { useWhatsappModal } from '../../context/WhatsappModalContext'
import { useTrips } from '../../context/TripsContext'
import { originLabel, transporterName } from '../../data/lookup'
import { formatDate } from '../../utils/format'
import { Icon } from '../ui/Icon'

export function WhatsappModal() {
  const { tripId, close } = useWhatsappModal()
  const { trips, requestWhatsapp } = useTrips()
  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId])
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleClose = () => {
    setLink(null)
    setCopied(false)
    close()
  }

  useEffect(() => {
    if (!trip) return
    function onKey(e) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip])

  if (!trip) return null

  const handleGenerate = () => {
    const token = requestWhatsapp(trip.id)
    setLink(`${window.location.origin}/whatsapp/${token}`)
  }

  const message = link
    ? [
        'Farm Frites Transportation',
        `Sales No: ${trip.salesNo}`,
        `Customer: ${originLabel(trip)}`,
        `Destination: ${trip.destination}`,
        `Dispatch Date: ${formatDate(trip.dispatchDate)}`,
        '',
        'Please confirm the driver and vehicle for this trip:',
        link,
      ].join('\n')
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — link is still visible for manual copy
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative w-full max-w-[420px] rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E1F5EC] text-[#1E9E6A]">
              <Icon name="whatsapp" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-text-primary">Send via WhatsApp</p>
              <p className="text-[12px] text-text-muted">{trip.salesNo} · {transporterName(trip)}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {!link ? (
            <>
              <p className="text-[13px] text-text-secondary">
                Generate a secure one-time link for the transporter. They'll be able to submit the driver name, phone
                number, plate number and vehicle type — no login required. The trip updates automatically once
                submitted.
              </p>
              <div className="mt-4 rounded-lg border border-border bg-surface-alt px-3 py-2.5 text-[13px] text-text-secondary">
                Requesting details for <span className="font-medium text-text-primary">{originLabel(trip)}</span> →{' '}
                <span className="font-medium text-text-primary">{trip.destination}</span>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-text-faint">Secure link</p>
              <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface-alt px-3 py-2">
                <Icon name="link" className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <span className="truncate text-[12.5px] text-text-secondary">{link}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border-strong py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover"
              >
                <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <p className="mt-3 text-[12px] text-text-muted">Preview message</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-[#E1F5EC] px-3 py-2.5 text-[12.5px] text-[#0F5132]">{message}</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={handleClose} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            {link ? 'Done' : 'Cancel'}
          </button>
          {!link && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                handleGenerate()
              }}
              className="flex items-center gap-1.5 rounded-md bg-[#1E9E6A] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#188056]"
            >
              <Icon name="whatsapp" className="h-3.5 w-3.5" />
              Generate & Send
            </a>
          )}
          {link && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-[#1E9E6A] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#188056]"
            >
              <Icon name="whatsapp" className="h-3.5 w-3.5" />
              Open WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
