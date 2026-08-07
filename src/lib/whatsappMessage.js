import { formatDate } from '../utils/format'

// Single centralized place that knows what a "New Trip Assignment" WhatsApp message looks
// like -- nothing about its wording lives in any UI component. Trip-type-aware: Customer
// Delivery includes Client/Delivery Contact/Delivery Mobile; Internal Transfer does not (it
// has neither a client nor a delivery contact). Delivery Contact/Mobile lines are omitted
// entirely when blank, rather than printed as "Delivery Contact: -", to keep the message
// clean per the approved template -- not every Customer Delivery trip has one on file yet.
export function buildWhatsappMessage(trip, assignmentLink) {
  const lines = ['Farm Frites - Americana', '', 'New Trip Assignment', '', `Sales No: ${trip.salesNo}`]

  if (trip.tripType === 'customer') {
    lines.push('Trip Type: Client Delivery')
    lines.push(`Client: ${trip.customerName ?? '—'}`)
    lines.push(`Destination: ${trip.destination}`)
    if (trip.deliveryContactName) lines.push(`Delivery Contact: ${trip.deliveryContactName}`)
    if (trip.deliveryContactMobile) lines.push(`Delivery Mobile: ${trip.deliveryContactMobile}`)
  } else {
    lines.push('Trip Type: Internal Transfer')
    lines.push(`Destination: ${trip.destination}`)
  }

  lines.push(`Dispatch Date: ${formatDate(trip.dispatchDate)}`)
  lines.push('')
  lines.push('Please assign:')
  lines.push('')
  lines.push('• Driver Name')
  lines.push('• Driver Mobile')
  lines.push('• Truck Plate Number')
  lines.push('')
  lines.push('Assign Driver & Vehicle')
  lines.push(assignmentLink)

  return lines.join('\n')
}

// wa.me requires digits only (no +, spaces, or dashes).
export function toWhatsappDigits(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}
