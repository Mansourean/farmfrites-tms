import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getAssignmentContext, submitDriverAssignment } from '../services/tripAssignment'
import { Icon } from '../components/ui/Icon'
import { formatDate } from '../utils/format'

const inputClass =
  'w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-brand-400'

// Public, unauthenticated page reached from the WhatsApp assignment link. Shows the trip's
// Sales No/Customer/Destination/Delivery Date & Time/Receiver Mobile as read-only context above
// the form -- get_trip_assignment_context (see 0014) is a read-only RPC, so there is no way for
// this page to edit any of it; the transporter can only ever submit Driver Name/Driver Mobile/
// Truck Plate Number, enforced server-side by submit_driver_assignment's fixed parameter list.
// Reusable: the link stays valid (and this page keeps prefilling from whatever was last
// submitted) until the trip reaches a terminal status server-side.
export function DriverAssignment() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading') // loading | not-found | load-error | closed | form | submitted
  const [context, setContext] = useState(null)
  const [form, setForm] = useState({ driverName: '', driverMobile: '', plateNo: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // 'not-found' (a genuine, correctly-resolved "no such token") and 'load-error' (the lookup
  // itself failed -- network, a stale cached bundle after a deploy, a transient Supabase error)
  // used to collapse into the exact same "Link not found" message, which made every failure of
  // this page look identical to a bad link and impossible to tell apart from the outside. They
  // now render distinctly, and the real error is logged so a report of "the link doesn't work"
  // is actually diagnosable instead of always pointing at the token. Retry re-runs the same
  // lookup in place rather than a full page reload, which also sidesteps a stale cached page
  // shell if that's what caused the failure the first time.
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getAssignmentContext(token)
      .then((ctx) => {
        if (cancelled) return
        if (!ctx) {
          setStatus('not-found')
          return
        }
        setContext(ctx)
        setForm({
          driverName: ctx.driver_name ?? '',
          driverMobile: ctx.driver_mobile ?? '',
          plateNo: ctx.plate_no ?? '',
        })
        setStatus(ctx.is_active ? 'form' : 'closed')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Assignment link failed to load:', err)
        setStatus('load-error')
      })
    return () => {
      cancelled = true
    }
  }, [token, retryCount])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.driverName.trim() || !form.driverMobile.trim() || !form.plateNo.trim()) return
    setError('')
    setSaving(true)
    try {
      await submitDriverAssignment(token, form)
      setStatus('submitted')
    } catch (err) {
      setError(err.message || 'Could not submit these details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt px-4 py-8">
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="text-center leading-[1.3]">
          <p className="text-[15px] font-semibold text-text-primary">Farm Frites - Americana</p>
          {context && (
            <p className="mt-1 text-[13px] text-text-muted">
              Transporter:
              <br />
              <span className="font-medium text-text-primary">{context.transporter_name}</span>
            </p>
          )}
        </div>

        <div className="mt-6 w-full rounded-xl border border-border bg-surface p-5 shadow-sm">
          {status === 'loading' && <p className="py-4 text-center text-[13px] text-text-muted">Loading…</p>}

          {status === 'not-found' && (
            <div className="py-2 text-center">
              <p className="text-[15px] font-semibold text-text-primary">Link not found</p>
              <p className="mt-1 text-[13px] text-text-muted">This link is invalid. Please contact Farm Frites logistics.</p>
            </div>
          )}

          {status === 'load-error' && (
            <div className="py-2 text-center">
              <p className="text-[15px] font-semibold text-text-primary">Could not load this link</p>
              <p className="mt-1 text-[13px] text-text-muted">Check your internet connection and try again.</p>
              <button
                type="button"
                onClick={() => setRetryCount((n) => n + 1)}
                className="mt-3 rounded-lg bg-[var(--color-ink)] px-4 py-2 text-[13px] font-medium text-[var(--color-ink-text)] hover:bg-[var(--color-ink-hover)]"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'closed' && (
            <div className="py-2 text-center">
              <p className="text-[15px] font-semibold text-text-primary">Assignment closed</p>
              <p className="mt-1 text-[13px] text-text-muted">This trip has already been completed.</p>
            </div>
          )}

          {status === 'submitted' && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                <Icon name="check" className="h-5 w-5" />
              </span>
              <p className="text-[15px] font-semibold text-text-primary">Thank you.</p>
              <p className="text-[13px] text-text-muted">Driver information has been updated successfully.</p>
              <p className="text-[13px] text-text-muted">You may now close this page.</p>
            </div>
          )}

          {status === 'form' && (
            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-alt p-3.5 text-[13px]">
                <p className="text-text-muted">
                  Sales No: <span className="font-medium text-text-primary">{context.sales_no}</span>
                </p>
                {context.customer_name && (
                  <p className="text-text-muted">
                    Client: <span className="font-medium text-text-primary">{context.customer_name}</span>
                  </p>
                )}
                <p className="text-text-muted">
                  Destination: <span className="font-medium text-text-primary">{context.destination}</span>
                </p>

                {/* Two distinct dates, deliberately not "Date"/labeled ambiguously -- confusing
                    Loading Date with the Client's requested delivery date is the exact mistake
                    this screen exists to prevent. */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[var(--color-date-loading)]/30 bg-[var(--color-success-bg)] px-2.5 py-2">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-date-loading)]">Loading Date</p>
                    <p className="text-[15px] font-semibold text-[var(--color-date-loading)]">{formatDate(context.dispatch_date)}</p>
                  </div>
                  <div className="rounded-md border border-[var(--color-date-requested)]/30 bg-[var(--color-info-bg)] px-2.5 py-2">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-date-requested)]">Requested Delivery</p>
                    <p className="text-[15px] font-semibold text-[var(--color-date-requested)]">{formatDate(context.delivery_date)}</p>
                  </div>
                </div>

                {context.delivery_contact_mobile && (
                  <p className="text-text-muted">
                    Receiver Mobile: <span className="font-medium text-text-primary">{context.delivery_contact_mobile}</span>
                  </p>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">Driver Name</span>
                <input required className={inputClass} value={form.driverName} onChange={set('driverName')} placeholder="e.g. Faisal Al-Harbi" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">Driver Mobile</span>
                <input required className={inputClass} value={form.driverMobile} onChange={set('driverMobile')} placeholder="+966 5X XXX XXXX" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">Truck Plate Number</span>
                <input required className={inputClass} value={form.plateNo} onChange={set('plateNo')} placeholder="e.g. 4521 KTB" />
              </label>

              {error && <p className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-danger-text)]">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#1E9E6A] py-2.5 text-[14px] font-semibold text-white hover:bg-[#188056] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
