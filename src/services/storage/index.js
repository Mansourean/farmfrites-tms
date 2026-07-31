import { env } from '../../config/env'
import { createMemoryAdapter, createWebStorageAdapter } from './adapters'

const memoryAdapter = createMemoryAdapter()

// Falls back to an in-memory adapter (data lives for the tab's lifetime only) whenever
// real persistence isn't available or wanted: localStorage disabled/full (private
// browsing, quota), no window (non-browser render), or VITE_STORAGE_DRIVER=memory.
function resolveAdapter() {
  if (env.storageDriver === 'memory' || typeof window === 'undefined') return memoryAdapter

  try {
    const probeKey = '__ff_tms_storage_probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return createWebStorageAdapter(window.localStorage)
  } catch {
    return memoryAdapter
  }
}

const adapter = resolveAdapter()

// Single persistence entry point for the whole app — every feature (auth, trips,
// columns, layout prefs) reads and writes through this, never window.localStorage
// directly, so the backing store can be swapped (IndexedDB, a real API) without
// touching UI code.
export const storage = {
  read(key, fallback) {
    try {
      const raw = adapter.getItem(key)
      return raw !== null && raw !== undefined ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  },
  write(key, value) {
    try {
      adapter.setItem(key, JSON.stringify(value))
    } catch {
      // storage full/unavailable — value still holds for this session via React state
    }
  },
  remove(key) {
    try {
      adapter.removeItem(key)
    } catch {
      // ignore
    }
  },
}
