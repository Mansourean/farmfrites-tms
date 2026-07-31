import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTrips } from '../context/TripsContext'
import { vehicleTypes } from '../data/transporters'
import { originLabel } from '../data/lookup'
import { Icon } from '../components/ui/Icon'

const inputClass =
  'w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-brand-400'

export function WhatsappUpdate() {
  const { token } = useParams()
  const { getTripByToken, submitWhatsappUpdate } = useTrips()
  const trip = getTripByToken(token)
  const [form, setForm] = useState({ driverName: '', phone: '', plateNo: '', vehicleType: vehicleTypes[0] })
  const [submitted, setSubmitted] = useState(Boolean(trip?.whatsapp?.filledAt))

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 text-center shadow-sm">
          <p className="text-[15px] font-semibold text-text-primary">Link not found</p>
          <p className="mt-1 text-[13px] text-text-muted">This link is invalid or has expired. Please contact Farm Frites logistics.</p>
        </div>
      </div>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.driverName || !form.phone || !form.plateNo) return
    submitWhatsappUpdate(token, form)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-surface-alt px-4 py-8">
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[6px] bg-text-primary text-[12px] font-bold text-white">FF</span>
          <div className="leading-[1.15]">
            <p className="text-[14px] font-semibold text-text-primary">Farm Frites</p>
            <p className="text-[11px] text-text-muted">Transportation Management System</p>
          </div>
        </div>

        <div className="mt-6 w-full rounded-xl border border-border bg-white p-5 shadow-sm">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#E1F5EC] text-[#1E9E6A]">
                <Icon name="check" className="h-5 w-5" />
              </span>
              <p className="text-[15px] font-semibold text-text-primary">Details submitted</p>
              <p className="text-[13px] text-text-muted">
                Thank you. Trip {trip.salesNo} has been updated and the Farm Frites logistics team has been notified.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-medium text-text-muted">Trip {trip.salesNo}</p>
              <p className="mt-0.5 text-[15px] font-semibold text-text-primary">
                {originLabel(trip)} → {trip.destination}
              </p>
              <p className="mt-1 text-[12.5px] text-text-muted">
                Please confirm the driver and vehicle assigned to this trip.
              </p>

              <form className="mt-5 flex flex-col gap-3.5" onSubmit={handleSubmit}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-text-secondary">Driver Name</span>
                  <input required className={inputClass} value={form.driverName} onChange={set('driverName')} placeholder="e.g. Faisal Al-Harbi" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-text-secondary">Phone Number</span>
                  <input required className={inputClass} value={form.phone} onChange={set('phone')} placeholder="+966 5X XXX XXXX" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-text-secondary">Plate Number</span>
                  <input required className={inputClass} value={form.plateNo} onChange={set('plateNo')} placeholder="e.g. 4521 KTB" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-text-secondary">Vehicle Type</span>
                  <select className={inputClass} value={form.vehicleType} onChange={set('vehicleType')}>
                    {vehicleTypes.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#1E9E6A] py-2.5 text-[14px] font-semibold text-white hover:bg-[#188056]"
                >
                  <Icon name="whatsapp" className="h-4 w-4" />
                  Submit Details
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-[11.5px] text-text-faint">Secured link · Farm Frites KSA</p>
      </div>
    </div>
  )
}
