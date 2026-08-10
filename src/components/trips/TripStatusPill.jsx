// New Order (DB value 'Planned') is a calm teal-blue -- deliberately a different hue from In
// Transit's indigo-blue below (not just a lighter/darker version of the same color), so the
// two stay clearly distinguishable at a glance, alongside Rejected/Delivered/Cancelled's reds
// and green. Labels below are the approved naming (New Order / Transportation Assignment /
// Confirmed) -- only display text, DB values are unchanged (still 'Waiting for Loading' in the
// database -- see 0016 -- since the DB status string itself was never renamed for any status,
// only what the UI displays).
// `color` is each status's one accent hue -- also read directly by TripsTable.jsx/TripCard.jsx
// for the row's left accent border, so it stays a plain hex, not a computed value. The pill's
// own background/text below are *derived* from that single hue via color-mix rather than a
// second hand-picked pastel per status, so both light and dark mode come from one definition:
// mixing against the current theme's surface/text-primary tokens automatically produces a pale
// tint in light mode and a muted dark tint in dark mode, with text that darkens or lightens to
// match -- see the same technique in UserManagement.jsx's RoleBadge/StatusBadge.
const statusConfig = {
  planned: { label: 'New Order', color: '#0E7490' },
  ready_for_transporter: { label: 'Transportation Assignment', color: '#C2410C' },
  waiting_for_loading: { label: 'Confirmed', color: '#A16207' },
  waiting_driver: { label: 'Waiting Driver', color: '#8A5A00' },
  loaded: { label: 'Loaded', color: '#6B3FA0' },
  in_transit: { label: 'In Transit', color: '#1743C4' },
  delivered: { label: 'Delivered', color: '#0F6B32' },
  cancelled: { label: 'Cancelled', color: '#B42318' },
  rejected: { label: 'Rejected', color: '#D92D20' },
}

export function TripStatusPill({ status }) {
  const config = statusConfig[status] ?? statusConfig.planned
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[12.5px] font-semibold"
      style={{
        backgroundColor: `color-mix(in srgb, ${config.color} 14%, var(--color-surface))`,
        color: `color-mix(in srgb, ${config.color} 55%, var(--color-text-primary))`,
      }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  )
}

export { statusConfig }
