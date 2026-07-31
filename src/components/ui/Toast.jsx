import { useToast } from '../../context/ToastContext'
import { Icon } from './Icon'
import { cn } from '../../utils/cn'

const typeStyles = {
  info: { icon: 'bell', color: '#4F7CFF', bg: '#EAF0FF' },
  success: { icon: 'check', color: '#0F6B32', bg: '#DAF3E3' },
  error: { icon: 'x', color: '#B42318', bg: '#FBE7E5' },
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-[360px] flex-col gap-2">
      {toasts.map((toast) => {
        const style = typeStyles[toast.type] ?? typeStyles.info
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border-strong bg-white px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.12)]',
              'animate-[toast-in_180ms_ease-out]',
            )}
          >
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              <Icon name={style.icon} className="h-3 w-3" strokeWidth={2.4} />
            </span>
            <p className="flex-1 text-[13px] leading-snug text-text-primary">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-text-faint hover:bg-surface-hover hover:text-text-secondary"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
