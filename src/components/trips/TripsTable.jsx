import { useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { Checkbox } from '../ui/Checkbox'
import { Icon } from '../ui/Icon'
import { SystemCell } from './SystemCell'
import { CustomCell } from './CustomCell'
import { RowQuickActions } from './RowQuickActions'
import { statusConfig } from './TripStatusPill'
import { useTripPanel } from '../../context/TripPanelContext'
import { useTrips } from '../../context/TripsContext'
import { useColumns } from '../../context/ColumnsContext'
import { useFlipList } from '../../hooks/useFlipList'

const CHECKBOX_COL = 40
const ACTIONS_COL = 168

function HeaderCell({ column, isLast }) {
  const { renameColumn, resizeColumn } = useColumns()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(column.label)
  const dragState = useRef(null)

  const commit = () => {
    setEditing(false)
    const trimmed = label.trim()
    if (trimmed && trimmed !== column.label) renameColumn(column.id, trimmed)
    else setLabel(column.label)
  }

  const onResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dragState.current = { startX: e.clientX, startWidth: column.width }
    const onMove = (moveEvent) => {
      if (!dragState.current) return
      const delta = moveEvent.clientX - dragState.current.startX
      resizeColumn(column.id, dragState.current.startWidth + delta)
    }
    const onUp = () => {
      dragState.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className={cn('group/head relative flex h-9 items-center gap-1.5 px-3', !isLast && 'border-r border-border/70')}>
      <Icon name={column.icon} className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setLabel(column.label)
              setEditing(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-brand-400 bg-white px-1 text-[12.5px] outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className="min-w-0 flex-1 truncate"
          title="Double-click to rename"
        >
          {column.label}
        </span>
      )}
      <div
        onMouseDown={onResizeStart}
        data-col-resize={column.id}
        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize select-none opacity-0 hover:bg-brand-400/40 group-hover/head:opacity-100"
      />
    </div>
  )
}

export function TripsTable({ trips }) {
  const [selected, setSelected] = useState(() => new Set())
  const { openView } = useTripPanel()
  const { justUpdated, setCustomFieldValue } = useTrips()
  const { visibleColumns } = useColumns()
  const setRowRef = useFlipList(trips.map((t) => t.id).join('|'))

  const allSelected = selected.size > 0 && selected.size === trips.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(trips.map((t) => t.id)))
  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const gridTemplate = `${CHECKBOX_COL}px ${visibleColumns.map((c) => `${c.width}px`).join(' ')} ${ACTIONS_COL}px`

  return (
    <div className="min-w-max">
      <div
        className="sticky top-0 z-20 grid border-b border-border border-l-[3px] border-l-transparent bg-white text-[12.5px] font-medium text-text-secondary"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="flex h-9 items-center justify-center border-r border-border/70">
          <Checkbox checked={allSelected} onChange={toggleAll} />
        </div>
        {visibleColumns.map((column) => (
          <HeaderCell key={column.id} column={column} isLast={false} />
        ))}
        <div className="flex h-9 items-center justify-center text-[11px] font-medium uppercase tracking-wide text-text-faint">Actions</div>
      </div>

      <div>
        {trips.map((trip) => {
          const isSelected = selected.has(trip.id)
          const isFresh = justUpdated.has(trip.id)
          const accentColor = statusConfig[trip.status]?.color ?? statusConfig.planned.color

          return (
            <div
              key={trip.id}
              ref={setRowRef(trip.id)}
              onClick={() => openView(trip.id, 'details')}
              className={cn(
                'group relative grid cursor-pointer border-b border-border/60 border-l-[3px] text-[13px] text-text-primary',
                'hover:z-10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
                isFresh ? 'bg-[#E1F5EC]' : isSelected ? 'bg-brand-50/40' : 'hover:bg-surface-hover',
              )}
              style={{
                gridTemplateColumns: gridTemplate,
                borderLeftColor: accentColor,
                transition: 'background-color 700ms ease, box-shadow 200ms ease',
              }}
            >
              <div className="flex h-11 items-center justify-center border-r border-border/70">
                <Checkbox checked={isSelected} onChange={() => toggleRow(trip.id)} />
              </div>

              {visibleColumns.map((column) => (
                <div key={column.id} className="flex h-11 min-w-0 items-center border-r border-border/70 px-3">
                  {column.system ? (
                    <SystemCell columnId={column.id} trip={trip} />
                  ) : (
                    <CustomCell
                      column={column}
                      value={trip.customFields?.[column.id]}
                      onChange={(value) => setCustomFieldValue(trip.id, column.id, value)}
                    />
                  )}
                </div>
              ))}

              <div className="flex h-11 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <RowQuickActions tripId={trip.id} />
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="grid border-l-[3px] border-l-transparent text-[12.5px] text-text-muted"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="h-9 border-r border-border/70" />
        <div className="flex h-9 items-center gap-1 border-r border-border/70 px-3" style={{ gridColumn: `span ${visibleColumns.length}` }}>
          {trips.length} trip{trips.length === 1 ? '' : 's'}
        </div>
        <div className="h-9" />
      </div>
    </div>
  )
}
