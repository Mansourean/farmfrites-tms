import { cn } from '../../utils/cn'
import { Popover } from '../ui/Popover'
import { Icon } from '../ui/Icon'

export function FilterDropdown({ icon, label, value, options, onChange, align = 'left' }) {
  const selected = options.find((o) => o.value === value)
  const isActive = value && value !== 'all'

  return (
    <Popover
      align={align}
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
          <Icon name={icon} className="h-3.5 w-3.5" />
          {isActive ? selected?.label ?? label : label}
          <Icon name="chevronDown" className="h-3 w-3 text-text-muted" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="max-h-72 min-w-[190px] overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                close()
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-[7px] text-left text-[13px] hover:bg-surface-hover',
                option.value === value ? 'text-text-primary font-medium' : 'text-text-secondary',
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {option.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.dot }} />}
                <span className="truncate">{option.label}</span>
              </span>
              {option.value === value && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}
