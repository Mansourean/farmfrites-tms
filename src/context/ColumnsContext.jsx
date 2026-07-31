import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DEFAULT_COLUMNS } from '../data/columnRegistry'
import { generateId } from '../utils/id'

const ColumnsContext = createContext(null)

const MIN_WIDTH = 80

export function ColumnsProvider({ children }) {
  const [columns, setColumns] = useLocalStorage('ff-tms-columns-transportation-log', DEFAULT_COLUMNS)

  // Reconcile: if the app ships new system columns later, append any missing ones
  // to an already-saved layout instead of silently dropping them.
  useEffect(() => {
    const knownIds = new Set(columns.map((c) => c.id))
    const missing = DEFAULT_COLUMNS.filter((c) => !knownIds.has(c.id))
    if (missing.length > 0) setColumns((prev) => [...prev, ...missing])
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
