import { NavLink } from 'react-router-dom'
import { navGroups } from '../../data/navigation'
import { useAuth } from '../../context/AuthContext'
import { ROLE_PAGE_ACCESS } from '../../data/roles'
import { cn } from '../../utils/cn'
import { Icon } from '../ui/Icon'

// Approved mobile nav cleanup: the desktop sidebar is permanently narrow/icon-only (no resize,
// no expand-to-labels) instead of the old drag-to-resize/collapse behavior -- the mobile
// off-canvas drawer below is untouched and still shows full labels.
const DESKTOP_WIDTH = 72

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div className="mx-2 mt-3 h-px bg-border" />
  return (
    <p className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-text-faint">
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
          'group relative flex items-center gap-2 rounded-lg text-[13px] transition-colors',
          collapsed ? 'justify-center px-0 py-2.5' : 'px-2 py-[5px]',
          isActive ? 'font-medium text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        )
      }
      style={({ isActive }) => (isActive ? { backgroundColor: `${color}14` } : undefined)}
    >
      {({ isActive }) => (
        <>
          {collapsed && (
            <span
              className={cn(
                'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
              style={{ backgroundColor: color }}
            />
          )}
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition-colors"
            style={{ backgroundColor: isActive ? `${color}22` : `${color}12` }}
          >
            <Icon name={icon} className="h-4 w-4" style={{ color }} />
          </span>
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({ onNavigate, collapsed = false, groups }) {
  return (
    <>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-3">
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

      <div className={cn('border-t border-border py-3', collapsed ? 'flex justify-center' : 'px-3')}>
        {collapsed ? (
          <span className="h-1.5 w-1.5 rounded-full bg-[#34B27B]" title="Farm Frites KSA · Production · v1.0" />
        ) : (
          <>
            <p className="text-[12.5px] font-semibold text-text-primary">Farm Frites KSA</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34B27B]" />
              Production
              <span className="text-text-faint">· Version 1.0</span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export function Sidebar({ open = false, onClose }) {
  const { currentUser } = useAuth()

  const allowedPaths = ROLE_PAGE_ACCESS[currentUser?.role] ?? []
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedPaths.includes(item.path)) }))
    .filter((group) => group.items.length > 0)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <aside className="relative flex h-full w-[248px] flex-col bg-surface-alt shadow-[8px_0_24px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between px-3 pt-3">
              <span className="text-[13px] font-semibold text-text-primary">Farm Frites</span>
              <button type="button" onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNavigate={onClose} groups={visibleGroups} />
          </aside>
        </div>
      )}

      <aside className="hidden shrink-0 flex-col border-r border-border bg-surface-alt md:flex" style={{ width: DESKTOP_WIDTH }}>
        <SidebarContent collapsed groups={visibleGroups} />
      </aside>
    </>
  )
}
