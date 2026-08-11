// Solid rectangular badges (not pills) -- strong, saturated fills with white text, one hue per
// status family so each is recognizable at a glance: neutral gray (New Order), orange
// (Transportation Assignment), green (Confirmed/Delivered -- two different shades so the two
// "positive" stages stay distinguishable from each other), amber (the legacy Waiting Driver
// hold-type status), purple (Loaded -- its own stage, doesn't fit any of the above families),
// blue (In Transit), red (Rejected), dark slate (Cancelled -- neutral-negative/closed, distinct
// from Rejected's red). All shades are picked dark/saturated enough on their own for solid white
// text to stay readable -- no per-theme adjustment needed, unlike a pale tint would require.
// `color` is also read directly by TripsTable.jsx/TripCard.jsx for the row's left accent border,
// so it stays a plain hex, not a computed value -- labels only, DB values are unchanged (still
// 'Waiting for Loading' in the database -- see 0016 -- since the DB status string itself was
// never renamed for any status, only what the UI displays).
const statusConfig = {
  planned: { label: 'New Order', color: '#475569' },
  ready_for_transporter: { label: 'Transportation Assignment', color: '#C2410C' },
  waiting_for_loading: { label: 'Confirmed', color: '#15803D' },
  // Teal -- reuses the exact hue "New Order" used before the rectangular-badge redesign (now
  // free), sitting visually between Confirmed's green and Loaded's purple without being
  // confusable with any other existing status color (see 0021 -- At Gate is a real pipeline
  // stage now, set only by gate_check_in).
  at_gate: { label: 'At Gate', color: '#0E7490' },
  waiting_driver: { label: 'Waiting Driver', color: '#B45309' },
  loaded: { label: 'Loaded', color: '#6D28D9' },
  in_transit: { label: 'In Transit', color: '#1D4ED8' },
  delivered: { label: 'Delivered', color: '#166534' },
  cancelled: { label: 'Cancelled', color: '#334155' },
  rejected: { label: 'Rejected', color: '#B91C1C' },
}

export function TripStatusPill({ status }) {
  const config = statusConfig[status] ?? statusConfig.planned
  return (
    <span
      className="inline-flex items-center rounded-[4px] px-2 py-[3px] text-[11.5px] font-bold text-white"
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </span>
  )
}

export { statusConfig }
