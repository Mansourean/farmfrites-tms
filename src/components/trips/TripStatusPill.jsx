const statusConfig = {
  planned: { label: 'Planned', color: '#8A4B00', bg: '#FBE7C2' },
  in_transit: { label: 'In Transit', color: '#1743C4', bg: '#D3E3FC' },
  delivered: { label: 'Delivered', color: '#0F6B32', bg: '#CBF1DA' },
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
