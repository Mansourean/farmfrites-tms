import { cn } from '../../utils/cn'
import { Icon } from './Icon'

export function Checkbox({ checked, onChange, className, ...props }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange?.(!checked)
      }}
      className={cn(
        'grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition-colors',
        checked
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)]'
          : 'border-border-strong bg-surface hover:border-text-muted',
        className,
      )}
      {...props}
    >
      {checked && <Icon name="check" className="h-[10px] w-[10px] text-[var(--color-ink-text)]" strokeWidth={3} />}
    </button>
  )
}
