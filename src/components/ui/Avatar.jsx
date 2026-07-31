import { getInitials } from '../../utils/initials'
import { cn } from '../../utils/cn'

export function Avatar({ name, initials, color = '#D9D9D6', size = 18, className }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-medium', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: 'rgba(0,0,0,0.55)',
        fontSize: size * 0.42,
      }}
    >
      {initials ?? getInitials(name)}
    </span>
  )
}
