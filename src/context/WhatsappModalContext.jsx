import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const WhatsappModalContext = createContext(null)

export function WhatsappModalProvider({ children }) {
  const [tripId, setTripId] = useState(null)

  const open = useCallback((id) => setTripId(id), [])
  const close = useCallback(() => setTripId(null), [])

  const value = useMemo(() => ({ tripId, open, close }), [tripId, open, close])

  return <WhatsappModalContext.Provider value={value}>{children}</WhatsappModalContext.Provider>
}

export function useWhatsappModal() {
  const ctx = useContext(WhatsappModalContext)
  if (!ctx) throw new Error('useWhatsappModal must be used within WhatsappModalProvider')
  return ctx
}
