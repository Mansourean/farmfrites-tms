import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { seedUsers } from '../data/users'
import { generateId } from '../utils/id'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [users, setUsers] = useLocalStorage('ff-tms-users', seedUsers)
  // Session persists across refresh (until Logout) by storing just the logged-in user's id.
  const [sessionUserId, setSessionUserId] = useLocalStorage('ff-tms-session', null)

  const currentUser = useMemo(
    () => users.find((user) => user.id === sessionUserId) ?? null,
    [users, sessionUserId],
  )

  const login = useCallback(
    (username, password) => {
      const match = users.find(
        (user) => user.username.trim().toLowerCase() === username.trim().toLowerCase() && user.password === password,
      )
      if (!match) return { ok: false, error: 'Incorrect username or password.' }
      if (match.status === 'disabled') return { ok: false, error: 'This account has been disabled. Contact an administrator.' }
      setSessionUserId(match.id)
      return { ok: true, user: match }
    },
    [users, setSessionUserId],
  )

  const logout = useCallback(() => setSessionUserId(null), [setSessionUserId])

  const createUser = useCallback(
    (data) => {
      const user = {
        id: generateId('usr'),
        fullName: data.fullName,
        username: data.username,
        password: data.password,
        role: data.role,
        status: 'active',
      }
      setUsers((prev) => [...prev, user])
      return user
    },
    [setUsers],
  )

  const updateUser = useCallback(
    (id, patch) => {
      setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, ...patch } : user)))
    },
    [setUsers],
  )

  const toggleUserStatus = useCallback(
    (id) => {
      setUsers((prev) =>
        prev.map((user) => (user.id === id ? { ...user, status: user.status === 'active' ? 'disabled' : 'active' } : user)),
      )
    },
    [setUsers],
  )

  const resetPassword = useCallback(
    (id, newPassword) => {
      setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, password: newPassword } : user)))
    },
    [setUsers],
  )

  const deleteUser = useCallback(
    (id) => {
      setUsers((prev) => prev.filter((user) => user.id !== id))
      setSessionUserId((prev) => (prev === id ? null : prev))
    },
    [setUsers, setSessionUserId],
  )

  const isUsernameTaken = useCallback(
    (username, excludeId) =>
      users.some((user) => user.id !== excludeId && user.username.trim().toLowerCase() === username.trim().toLowerCase()),
    [users],
  )

  const value = useMemo(
    () => ({
      currentUser,
      users,
      login,
      logout,
      createUser,
      updateUser,
      toggleUserStatus,
      resetPassword,
      deleteUser,
      isUsernameTaken,
    }),
    [currentUser, users, login, logout, createUser, updateUser, toggleUserStatus, resetPassword, deleteUser, isUsernameTaken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
