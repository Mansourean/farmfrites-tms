import { useRef, useState } from 'react'
import { useColumns } from '../../context/ColumnsContext'
import { FIELD_TYPES } from '../../data/columnRegistry'
import { Popover } from '../ui/Popover'
import { Icon } from '../ui/Icon'
import { cn } from '../../utils/cn'

function ColumnRow({ column, onDragStart, onDragOver, onDrop, dragging }) {
  const { toggleVisible, renameColumn, deleteColumn } = useColumns()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(column.label)

  const commitRename = () => {
    setEditing(false)
    const trimmed = label.trim()
    if (trimmed && trimmed !== column.label) renameColumn(column.id, trimmed)
    else setLabel(column.label)
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(column.id)}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(column.id)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(column.id)
      }}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors',
        dragging ? 'opacity-40' : 'hover:bg-surface-hover',
      )}
    >
      <span className="cursor-grab text-text-faint active:cursor-grabbing">
        <Icon name="menu" className="h-3.5 w-3.5" />
      </span>

      <button
        type="button"
        onClick={() => toggleVisible(column.id)}
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded transition-colors',
          column.visible ? 'text-text-secondary hover:bg-surface-alt' : 'text-text-faint hover:bg-surface-alt',
        )}
        title={column.visible ? 'Hide column' : 'Show column'}
      >
        <Icon name={column.visible ? 'checkSquare' : 'x'} className="h-3.5 w-3.5" />
      </button>

      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setLabel(column.label)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded border border-brand-400 bg-white px-1.5 py-0.5 text-[13px] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[13px] hover:bg-surface-alt',
            column.visible ? 'text-text-primary' : 'text-text-faint',
          )}
        >
          {column.label}
        </button>
      )}

      {!column.system && (
        <span className="shrink-0 rounded-[4px] bg-surface-alt px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-wide text-text-muted">
          {column.fieldType}
        </span>
      )}

      {!column.system && (
        <button
          type="button"
          onClick={() => deleteColumn(column.id)}
          className="shrink-0 rounded p-1 text-text-faint hover:bg-red-50 hover:text-red-500"
          title="Delete column"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function AddColumnForm({ onAdd, onCancel }) {
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [optionsText, setOptionsText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!label.trim()) return
    const type = FIELD_TYPES.find((t) => t.value === fieldType)
    onAdd({
      label: label.trim(),
      fieldType,
      icon: type?.icon,
      options:
        fieldType === 'dropdown'
          ? optionsText
              .split('\n')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Column Name</span>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Container No"
          className="rounded-md border border-border-strong px-2 py-1.5 text-[13px] outline-none focus:border-brand-400"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Field Type</span>
        <select
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value)}
          className="rounded-md border border-border-strong px-2 py-1.5 text-[13px] outline-none focus:border-brand-400"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {fieldType === 'dropdown' && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Options (one per line)</span>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={'e.g.\nHigh\nMedium\nLow'}
            className="min-h-[64px] resize-none rounded-md border border-border-strong px-2 py-1.5 text-[13px] outline-none focus:border-brand-400"
          />
        </label>
      )}
      <div className="mt-1 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-text-primary px-2.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#333331]">
          Add Column
        </button>
      </div>
    </form>
  )
}

export function ColumnManager() {
  const { columns, reorderColumn, addCustomColumn, resetColumns } = useColumns()
  const [adding, setAdding] = useState(false)
  const dragId = useRef(null)
  const [dragging, setDragging] = useState(null)

  return (
    <Popover
      align="right"
      button={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium transition-colors',
            open ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          )}
        >
          <Icon name="sliders" className="h-3.5 w-3.5" />
          Columns
        </button>
      )}
    >
      {() => (
        <div className="w-[280px]">
          <div className="flex items-center justify-between px-3 pt-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-faint">Manage Columns</p>
            <button type="button" onClick={resetColumns} className="text-[11.5px] text-text-muted hover:text-text-secondary">
              Reset
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto px-1.5 py-1.5">
            {columns.map((column) => (
              <ColumnRow
                key={column.id}
                column={column}
                dragging={dragging === column.id}
                onDragStart={(id) => {
                  dragId.current = id
                  setDragging(id)
                }}
                onDragOver={() => {}}
                onDrop={(toId) => {
                  if (dragId.current) reorderColumn(dragId.current, toId)
                  dragId.current = null
                  setDragging(null)
                }}
              />
            ))}
          </div>

          {adding ? (
            <AddColumnForm
              onAdd={(def) => {
                addCustomColumn(def)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2.5 text-left text-[13px] font-medium text-text-secondary hover:bg-surface-hover"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              Add custom column
            </button>
          )}
        </div>
      )}
    </Popover>
  )
}
