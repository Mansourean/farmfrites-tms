// New Order (DB value 'Planned') is a calm teal-blue -- deliberately a different hue from In
// Transit's indigo-blue below (not just a lighter/darker version of the same color), so the
// two stay clearly distinguishable at a glance, alongside Rejected/Delivered/Cancelled's reds
// and green. Labels below are the approved naming (New Order / Transportation Assignment /
// Confirmed) -- only display text, DB values are unchanged (still 'Waiting for Loading' in the
// database -- see 0016 -- since the DB status string itself was never renamed for any status,
// only what the UI displays).
const statusConfig = {
  planned: { label: 'New Order', color: '#0E7490', bg: '#CFFAFE' },
  ready_for_transporter: { label: 'Transportation Assignment', color: '#C2410C', bg: '#FFEDD5' },
  waiting_for_loading: { label: 'Confirmed', color: '#A16207', bg: '#FEF3C7' },
  waiting_driver: { label: 'Waiting Driver', color: '#8A5A00', bg: '#FCEFC7' },
  loaded: { label: 'Loaded', color: '#6B3FA0', bg: '#EAE0F8' },
  in_transit: { label: 'In Transit', color: '#1743C4', bg: '#D3E3FC' },
  delivered: { label: 'Delivered', color: '#0F6B32', bg: '#CBF1DA' },
  cancelled: { label: 'Cancelled', color: '#B42318', bg: '#FBE7E5' },
  rejected: { label: 'Rejected', color: '#D92D20', bg: '#FEE4E2' },
}

export function TripStatusPill({ status }) {
  const config = statusConfig[status] ?? statusConfig.planned
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[12.5px] font-semibold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  )
}

export { statusConfig }
