import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTrips } from '../context/TripsContext'
import { originLabel, transporterName } from '../data/lookup'
import { formatDate, formatDateTime } from '../utils/format'

export function PrintTrip() {
  const { id } = useParams()
  const { trips } = useTrips()
  const trip = trips.find((t) => t.id === id)

  useEffect(() => {
    if (trip) {
      const timer = setTimeout(() => window.print(), 300)
      return () => clearTimeout(timer)
    }
  }, [trip])

  if (!trip) {
    return <div className="p-8 text-[14px] text-text-secondary">Trip not found.</div>
  }

  const row = (label, value) => (
    <div className="flex justify-between border-b border-[#e5e5e3] py-2 text-[13px]">
      <span className="text-[#6f6f6d]">{label}</span>
      <span className="font-medium text-[#1a1a19]">{value || '—'}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-8 py-10 text-[#1a1a19]">
      <div className="flex items-center justify-between border-b-2 border-[#1a1a19] pb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[6px] bg-[#1a1a19] text-[12px] font-bold text-white">FF</span>
          <div>
            <p className="text-[15px] font-semibold">Farm Frites</p>
            <p className="text-[11px] text-[#6f6f6d]">Transportation Management System</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[16px] font-semibold">Trip Sheet</p>
          <p className="text-[12px] text-[#6f6f6d]">{trip.salesNo}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9a9a97]">Sales Information</p>
        {row('Sales No', trip.salesNo)}
        {row('Trip Type', trip.tripType === 'customer' ? 'Client Delivery' : 'Internal Transfer')}
        {row(trip.tripType === 'customer' ? 'Client' : 'Source Warehouse', originLabel(trip))}
        {row('Destination', trip.destination)}
        {row('Load (Tons)', trip.loadTons)}
        {row('Status', trip.status.replace('_', ' '))}
      </div>

      <div className="mt-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9a9a97]">Transporter & Vehicle</p>
        {row('Transporter', transporterName(trip))}
        {row('Driver', trip.driver?.name)}
        {row('Driver Phone', trip.driver?.phone)}
        {row('Plate No', trip.plateNo)}
        {row('Vehicle Type', trip.vehicleType)}
      </div>

      <div className="mt-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9a9a97]">Schedule</p>
        {row('Loading Date', formatDate(trip.dispatchDate))}
        {row('Requested Delivery Date', formatDate(trip.deliveryDate))}
      </div>

      {trip.remarks && (
        <div className="mt-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9a9a97]">Remarks</p>
          <p className="text-[13px]">{trip.remarks}</p>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9a9a97]">Timeline</p>
        {trip.timeline.map((event) => (
          <div key={event.id} className="flex justify-between border-b border-[#e5e5e3] py-1.5 text-[12.5px]">
            <span>{event.label}</span>
            <span className="text-[#6f6f6d]">{formatDateTime(event.timestamp)}</span>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-between text-[12px] text-[#9a9a97]">
        <span>Printed {formatDateTime(new Date().toISOString())}</span>
        <span>Farm Frites KSA · Production</span>
      </div>
    </div>
  )
}
