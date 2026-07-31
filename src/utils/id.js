export function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function generateToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '').slice(0, 20)
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}
