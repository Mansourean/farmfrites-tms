import { formatDate } from '../utils/format'

// Single centralized place that knows what a "New Trip Assignment" WhatsApp message looks
// like -- nothing about its wording lives in any UI component. Trip-type-aware: Customer
// Delivery includes Client/Receiver Mobile; Internal Transfer does not (it has neither a
// client nor a receiver). Receiver Mobile is omitted entirely when blank, rather than printed
// as "Receiver Mobile: -", to keep the message clean -- not every Customer Delivery trip has
// one on file yet. (Internally this is still the deliveryContactMobile field/column -- only
// the displayed label changed to "Receiver Mobile".)
export function buildWhatsappMessage(trip, assignmentLink) {
  const lines = ['Farm Frites - Americana', '', 'New Trip Assignment', '', `Sales No: ${trip.salesNo}`]

  if (trip.tripType === 'customer') {
    lines.push('Trip Type: Client Delivery')
    lines.push(`Client: ${trip.customerName ?? '—'}`)
    lines.push(`Destination: ${trip.destination}`)
    if (trip.deliveryContactMobile) lines.push(`Receiver Mobile: ${trip.deliveryContactMobile}`)
  } else {
    lines.push('Trip Type: Internal Transfer')
    lines.push(`Destination: ${trip.destination}`)
  }

  // Two distinct, clearly labeled dates -- never just "Date", so the transporter can never
  // confuse when the truck must be at the factory with when the goods must reach the client.
  lines.push(`LOADING DATE: ${formatDate(trip.dispatchDate)}`)
  lines.push(`REQUESTED DELIVERY: ${formatDate(trip.deliveryDate)}`)
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
