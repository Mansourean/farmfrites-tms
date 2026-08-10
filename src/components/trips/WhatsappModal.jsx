import { useEffect, useMemo, useState } from 'react'
import { useWhatsappModal } from '../../context/WhatsappModalContext'
import { useTrips } from '../../context/TripsContext'
import { createAssignmentLink } from '../../services/tripAssignment'
import { buildWhatsappMessage, toWhatsappDigits } from '../../lib/whatsappMessage'
import { transporterName } from '../../data/lookup'
import { Icon } from '../ui/Icon'

export function WhatsappModal() {
  const { tripId, close } = useWhatsappModal()
  const { trips, transporters } = useTrips()
  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId])
  const transporter = useMemo(
    () => transporters.find((t) => t.id === trip?.transporterId) ?? null,
    [transporters, trip],
  )

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleClose = () => {
    setMessage('')
    setError('')
    setCopied(false)
    close()
  }

  // The assignment link is idempotent server-side (see 0011) -- reopening this modal for the
  // same trip always resurfaces the same still-valid link, so preparing it on open (rather
  // than behind an extra "Generate" click) is safe and fast.
  useEffect(() => {
    if (!trip) return
    let cancelled = false
    setLoading(true)
    setError('')
    createAssignmentLink(trip.id)
      .then((link) => {
        if (cancelled) return
        const assignmentUrl = `${window.location.origin}/assign/${link.token}`
        setMessage(buildWhatsappMessage(trip, assignmentUrl))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not prepare the assignment link.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id])

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

  const phoneDigits = toWhatsappDigits(transporter?.phone)
  const waHref = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — message is still visible for manual copy
    }
  }

  // Feature-detected, not just try/caught -- devices without the Web Share API (most desktop
  // browsers) never render a Share button at all, so Copy is the only action shown there,
  // rather than a button that would always fail.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleShare = async () => {
    try {
      await navigator.share({ text: message })
    } catch {
      // AbortError (user cancelled the native share sheet) or any other failure -- the message
      // is still visible with Copy right next to it, nothing more to do here.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative w-full max-w-[420px] rounded-xl bg-surface shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
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
          {loading && <p className="text-[13px] text-text-muted">Preparing assignment link…</p>}

          {error && <p className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-danger-text)]">{error}</p>}

          {!loading && !error && (
            <>
              {!phoneDigits && (
                <p className="mb-3 rounded-md bg-[var(--color-warning-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-warning-text)]">
                  No mobile number on file for this transporter — WhatsApp will open without a pre-filled recipient.
                </p>
              )}
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-text-faint">Message preview</p>
              <p className="whitespace-pre-line rounded-lg bg-[var(--color-success-bg)] px-3 py-2.5 text-[12.5px] text-[#0F5132]">{message}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-strong py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover"
                >
                  <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy message'}
                </button>
                {canShare && (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-strong py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover"
                  >
                    <Icon name="share" className="h-3.5 w-3.5" />
                    Share
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={handleClose} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            Cancel
          </button>
          {!loading && !error && (
            <a
              href={waHref}
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
