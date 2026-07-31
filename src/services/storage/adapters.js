export function createWebStorageAdapter(webStorage) {
  return {
    getItem: (key) => webStorage.getItem(key),
    setItem: (key, value) => webStorage.setItem(key, value),
    removeItem: (key) => webStorage.removeItem(key),
  }
}

export function createMemoryAdapter() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  }
}
