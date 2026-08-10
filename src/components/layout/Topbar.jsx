import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { navGroups } from '../../data/navigation'
import { useAuth } from '../../context/AuthContext'
import { canEdit } from '../../data/roles'
import { Icon } from '../ui/Icon'
import { ImportExcelButton } from '../trips/ImportExcelButton'
import { UserMenu } from './UserMenu'
import { OperationalReportModal } from './OperationalReportModal'

const allItems = navGroups.flatMap((g) => g.items)

export function TopBar({ onMenuClick }) {
  const location = useLocation()
  const { currentUser } = useAuth()
  const [reportOpen, setReportOpen] = useState(false)
  const current = allItems.find((item) => item.path === location.pathname)
  const isTransportationLog = location.pathname === '/'
  const showCreateActions = isTransportationLog && canEdit(currentUser?.role)

  return (
    <>
    <header className="flex h-topbar shrink-0 items-center justify-between border-b border-border pl-2 pr-3 md:pl-3 md:pr-4">
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-secondary md:hidden"
        >
          <Icon name="menu" className="h-4.5 w-4.5" />
        </button>

        <div className="hidden items-center gap-1.5 rounded-md px-1.5 py-1 md:flex">
          <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-text-primary text-[11px] font-bold text-white">
            FF
          </span>
          <div className="flex flex-col leading-[1.15]">
            <span className="text-[13px] font-semibold text-text-primary">Farm Frites</span>
            <span className="text-[10px] text-text-muted">Transportation Management System</span>
          </div>
        </div>

        <div className="hidden items-center gap-0.5 text-text-muted md:flex">
          <button type="button" className="rounded-md p-1.5 hover:bg-surface-hover hover:text-text-secondary">
            <Icon name="search" className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-md p-1.5 hover:bg-surface-hover hover:text-text-secondary">
            <Icon name="panel" className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-1 hidden h-4 w-px bg-border md:block" />

        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-text-primary">
          <span
            className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px]"
            style={{ backgroundColor: '#4F7CFF1a' }}
          >
            <Icon name={current?.icon ?? 'truck'} className="h-3 w-3" style={{ color: current?.color ?? '#4F7CFF' }} />
          </span>
          <span className="truncate">{current?.label ?? 'Farm Frites'}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {showCreateActions && <ImportExcelButton />}
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <Icon name="fileText" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Operational Report</span>
        </button>
        <button className="hidden rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-secondary md:block">
          <Icon name="moreVertical" className="h-4 w-4" />
        </button>
        <span className="hidden text-[12px] text-text-faint md:inline">⌘K</span>
        <div className="mx-0.5 hidden h-4 w-px bg-border md:block" />
        <UserMenu />
      </div>
    </header>
    <OperationalReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  )
}
