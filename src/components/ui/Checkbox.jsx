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
          ? 'border-text-primary bg-text-primary'
          : 'border-border-strong bg-white hover:border-text-muted',
        className,
      )}
      {...props}
    >
      {checked && <Icon name="check" className="h-[10px] w-[10px] text-white" strokeWidth={3} />}
    </button>
  )
}
