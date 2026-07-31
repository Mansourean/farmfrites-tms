import { useEffect, useState } from 'react'
import { Checkbox } from '../ui/Checkbox'

export function CustomCell({ column, value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  if (column.fieldType === 'checkbox') {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={Boolean(value)} onChange={(next) => onChange(next)} />
      </div>
    )
  }

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onChange(draft)
  }

  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (!editing) {
    const display =
      column.fieldType === 'date' && value
        ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : value

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        className="w-full truncate rounded px-1 py-0.5 text-left text-text-secondary hover:bg-surface-hover"
      >
        {display || <span className="text-text-faint">—</span>}
      </button>
    )
  }

  const inputProps = {
    autoFocus: true,
    value: draft,
    onClick: (e) => e.stopPropagation(),
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === 'Enter') commit()
      if (e.key === 'Escape') cancel()
    },
    className: 'w-full rounded border border-brand-400 bg-white px-1.5 py-0.5 text-[13px] text-text-primary outline-none',
  }

  if (column.fieldType === 'dropdown') {
    return (
      <select {...inputProps}>
        <option value="">—</option>
        {(column.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  return <input type={column.fieldType === 'number' ? 'number' : column.fieldType === 'date' ? 'date' : 'text'} {...inputProps} />
}
