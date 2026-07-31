import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const TripPanelContext = createContext(null)

export function TripPanelProvider({ children }) {
  const [state, setState] = useState({ open: false, mode: 'view', tripId: null, tab: 'details' })

  const openCreate = useCallback(() => setState({ open: true, mode: 'create', tripId: null, tab: 'details' }), [])
  const openView = useCallback(
    (tripId, tab = 'details') => setState({ open: true, mode: 'view', tripId, tab }),
    [],
  )
  const openEdit = useCallback((tripId) => setState({ open: true, mode: 'edit', tripId, tab: 'details' }), [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const value = useMemo(
    () => ({ ...state, openCreate, openView, openEdit, close }),
    [state, openCreate, openView, openEdit, close],
  )

  return <TripPanelContext.Provider value={value}>{children}</TripPanelContext.Provider>
}

export function useTripPanel() {
  const ctx = useContext(TripPanelContext)
  if (!ctx) throw new Error('useTripPanel must be used within TripPanelProvider')
  return ctx
}
