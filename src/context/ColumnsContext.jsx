import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DEFAULT_COLUMNS } from '../data/columnRegistry'
import { generateId } from '../utils/id'

const ColumnsContext = createContext(null)

const MIN_WIDTH = 80

export function ColumnsProvider({ children }) {
  const [columns, setColumns] = useLocalStorage('ff-tms-columns-transportation-log', DEFAULT_COLUMNS)

  // System columns (order, label, icon, width, visibility) always mirror DEFAULT_COLUMNS on
  // load -- they're a product decision made in code, not a per-user preference, and earlier
  // versions of this reconcile only patched in missing columns / synced label+icon, which meant
  // every reorder, visibility change, or rename shipped in a release silently never reached
  // anyone who already had a saved layout (repeatedly confirmed in practice -- renames and
  // reordering kept needing a manual "Reset" to show up). Only genuinely custom (system: false)
  // columns a user actually created via "+" are preserved from the saved layout, appended after
  // the system columns in their existing order.
  useEffect(() => {
    setColumns((prev) => {
      const custom = prev.filter((c) => !c.system)
      const next = [...DEFAULT_COLUMNS, ...custom]
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleVisible = useCallback(
    (id) => setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))),
    [setColumns],
  )

  const renameColumn = useCallback(
    (id, label) => setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c))),
    [setColumns],
  )

  const resizeColumn = useCallback(
    (id, width) =>
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, width: Math.max(MIN_WIDTH, Math.round(width)) } : c))),
    [setColumns],
  )

  const reorderColumn = useCallback(
    (fromId, toId) => {
      if (fromId === toId) return
      setColumns((prev) => {
        const next = [...prev]
        const fromIndex = next.findIndex((c) => c.id === fromId)
        const toIndex = next.findIndex((c) => c.id === toId)
        if (fromIndex === -1 || toIndex === -1) return prev
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
    },
    [setColumns],
  )

  const addCustomColumn = useCallback(
    ({ label, fieldType, icon, options }) => {
      const id = generateId('col')
      setColumns((prev) => [
        ...prev,
        {
          id,
          label: label || 'New Column',
          icon: icon ?? 'fileText',
          width: 150,
          system: false,
          visible: true,
          fieldType,
          options: fieldType === 'dropdown' ? options ?? [] : undefined,
        },
      ])
      return id
    },
    [setColumns],
  )

  const deleteColumn = useCallback(
    (id) => setColumns((prev) => prev.filter((c) => c.id !== id || c.system)),
    [setColumns],
  )

  const resetColumns = useCallback(() => setColumns(DEFAULT_COLUMNS), [setColumns])

  const value = useMemo(
    () => ({
      columns,
      visibleColumns: columns.filter((c) => c.visible),
      toggleVisible,
      renameColumn,
      resizeColumn,
      reorderColumn,
      addCustomColumn,
      deleteColumn,
      resetColumns,
    }),
    [columns, toggleVisible, renameColumn, resizeColumn, reorderColumn, addCustomColumn, deleteColumn, resetColumns],
  )

  return <ColumnsContext.Provider value={value}>{children}</ColumnsContext.Provider>
}

export function useColumns() {
  const ctx = useContext(ColumnsContext)
  if (!ctx) throw new Error('useColumns must be used within ColumnsProvider')
  return ctx
}
