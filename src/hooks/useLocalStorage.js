import { useEffect, useState } from 'react'
import { storage } from '../services/storage'

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => storage.read(key, initialValue))

  useEffect(() => {
    storage.write(key, value)
  }, [key, value])

  // Real-time sync: pick up changes written by other tabs/windows for the same key
  // (e.g. a transporter submitting the WhatsApp form in a separate tab).
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== key || event.newValue === null) return
      try {
        setValue(JSON.parse(event.newValue))
      } catch {
        // ignore malformed payloads from other contexts
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [value, setValue]
}
