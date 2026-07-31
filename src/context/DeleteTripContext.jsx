import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const DeleteTripContext = createContext(null)

export function DeleteTripProvider({ children }) {
  const [tripId, setTripId] = useState(null)

  const open = useCallback((id) => setTripId(id), [])
  const close = useCallback(() => setTripId(null), [])

  const value = useMemo(() => ({ tripId, open, close }), [tripId, open, close])

  return <DeleteTripContext.Provider value={value}>{children}</DeleteTripContext.Provider>
}

export function useDeleteTrip() {
  const ctx = useContext(DeleteTripContext)
  if (!ctx) throw new Error('useDeleteTrip must be used within DeleteTripProvider')
  return ctx
}
