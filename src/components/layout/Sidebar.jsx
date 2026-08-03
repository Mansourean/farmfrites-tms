import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { navGroups } from '../../data/navigation'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useAuth } from '../../context/AuthContext'
import { ROLE_PAGE_ACCESS } from '../../data/roles'
import { cn } from '../../utils/cn'
import { Icon } from '../ui/Icon'

const MIN_WIDTH = 190
const MAX_WIDTH = 360
const COLLAPSE_THRESHOLD = 150
const COLLAPSED_WIDTH = 72
const DEFAULT_WIDTH = 248

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="mx-2 mt-4 h-px bg-sidebar-border" />
  return (
    <p className="px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-sidebar-text-faint">
      {children}
    </p>
  )
}

function NavItem({ icon, color, label, path, end, onNavigate, collapsed }) {
  return (
    <NavLink
      to={path}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] transition-colors',
          collapsed && 'justify-center px-0 py-2',
          isActive
            ? 'bg-sidebar-active font-medium text-sidebar-text'
            : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text',
        )
      }
    >
      <Icon name={icon} className="h-6 w-6 shrink-0" style={{ color }} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </NavLink>
  )
}

function SidebarContent({ onNavigate, collapsed = false, groups }) {
  return (
    <>
      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden pb-3 pt-3', collapsed ? 'px-2' : 'px-2')}>
        {groups.map((group) => (
          <div key={group.label}>
            <SectionLabel collapsed={collapsed}>{group.label}</SectionLabel>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.path} {...item} end={item.path === '/'} onNavigate={onNavigate} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-sidebar-border py-3', collapsed ? 'flex justify-center' : 'px-3')}>
        {collapsed ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[#34B27B]" title="Farm Frites KSA · Production · v1.0" />
        ) : (
          <>
            <p className="text-[12.5px] font-semibold text-sidebar-text">Farm Frites KSA</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-sidebar-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34B27B]" />
              Production
              <span className="text-sidebar-text-faint">· Version 1.0</span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export function Sidebar({ open = false, onClose }) {
  const [width, setWidth] = useLocalStorage('ff-tms-sidebar-width', DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useLocalStorage('ff-tms-sidebar-collapsed', false)
  const [dragging, setDragging] = useState(false)
  const dragState = useRef(null)
  const { currentUser } = useAuth()

  const allowedPaths = ROLE_PAGE_ACCESS[currentUser?.role] ?? []
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedPaths.includes(item.path)) }))
    .filter((group) => group.items.length > 0)

  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : width

  const onResizeStart = (e) => {
    e.preventDefault()
    dragState.current = { startX: e.clientX, startWidth: effectiveWidth, moved: false }
    setDragging(true)

    const onMove = (moveEvent) => {
      if (!dragState.current) return
      const delta = moveEvent.clientX - dragState.current.startX
      if (Math.abs(delta) > 3) dragState.current.moved = true
      const proposed = dragState.current.startWidth + delta

      if (proposed <= COLLAPSE_THRESHOLD) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, proposed)))
      }
    }

    const onUp = () => {
      // A near-zero-movement press acts as a click: toggle collapsed state.
      if (dragState.current && !dragState.current.moved) {
        setCollapsed((c) => !c)
      }
      dragState.current = null
      setDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <aside className="relative flex h-full w-[248px] flex-col bg-sidebar shadow-[8px_0_24px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between px-3 pt-3">
              <span className="text-[13px] font-semibold text-sidebar-text">Farm Frites</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNavigate={onClose} groups={visibleGroups} />
          </aside>
        </div>
      )}

      <aside
        className={cn(
          'relative hidden shrink-0 flex-col bg-sidebar md:flex',
          !dragging && 'transition-[width] duration-150 ease-out',
        )}
        style={{ width: effectiveWidth }}
      >
        <SidebarContent collapsed={collapsed} groups={visibleGroups} />
        <div
          onMouseDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          title={collapsed ? 'Expand sidebar' : 'Drag to resize · drag left to collapse'}
          className={cn(
            'absolute -right-[3px] top-0 z-20 h-full w-[6px] cursor-col-resize select-none',
            dragging ? 'bg-brand-400/50' : 'hover:bg-brand-400/30',
          )}
        />
      </aside>
    </>
  )
}
