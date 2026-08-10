import { cn } from '../../utils/cn'
import { Popover } from '../ui/Popover'
import { Icon } from '../ui/Icon'

export function DateFilter({ from, to, onChange }) {
  const isActive = Boolean(from || to)

  const label = () => {
    if (from && to) return `${from} → ${to}`
    if (from) return `From ${from}`
    if (to) return `Until ${to}`
    return 'Date'
  }

  return (
    <Popover
      align="right"
      button={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            open && !isActive && 'bg-surface-hover text-text-primary',
          )}
        >
          <Icon name="calendar" className="h-3.5 w-3.5" />
          {label()}
          <Icon name="chevronDown" className="h-3 w-3 text-text-muted" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-64 p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Dispatch date range</p>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-text-secondary">
              From
              <input
                type="date"
                value={from ?? ''}
                onChange={(e) => onChange({ from: e.target.value || null, to })}
                className="rounded-md border border-border-strong px-2 py-1 text-[13px] text-text-primary outline-none focus:border-brand-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-text-secondary">
              To
              <input
                type="date"
                value={to ?? ''}
                onChange={(e) => onChange({ from, to: e.target.value || null })}
                className="rounded-md border border-border-strong px-2 py-1 text-[13px] text-text-primary outline-none focus:border-brand-400"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange({ from: null, to: null })
              }}
              className="text-[12.5px] text-text-muted hover:text-text-secondary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-md bg-[var(--color-ink)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--color-ink-text)] hover:bg-[var(--color-ink-hover)]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}
