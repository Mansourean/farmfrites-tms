import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

export function Popover({ button, children, align = 'left', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {button({ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) })}
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1.5 min-w-[180px] rounded-lg border border-border-strong bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.1)]',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  )
}
