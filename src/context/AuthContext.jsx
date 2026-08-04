import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Fixed synthetic email domain for username -> Supabase Auth email mapping.
// Must match EMAIL_DOMAIN in supabase/functions/admin-users/index.ts exactly.
const EMAIL_DOMAIN = 'tms.farmfrites.internal'

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`
}

function mapProfile(row) {
  return { id: row.id, fullName: row.full_name, username: row.username, role: row.role, status: row.status }
}

async function invokeAdminUsers(action, payload) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...payload } })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      // fall back to the generic supabase-js message
    }
    throw new Error(message)
  }
  return data
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const signingOutRef = useRef(false)

  const applySession = useCallback(async (session) => {
    if (!session) {
      setProfile(null)
      return
    }
    const { data: row } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!row || row.status === 'disabled') {
      if (!signingOutRef.current) {
        signingOutRef.current = true
        await supabase.auth.signOut()
        signingOutRef.current = false
      }
      setProfile(null)
      return
    }
    setProfile(mapProfile(row))
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      await applySession(data.session)
      if (active) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return

      // A Supabase recovery-link session is not a normal login — send the user straight to
      // the password-reset form instead of letting ProtectedRoute wave them into the app.
      // AuthProvider renders above BrowserRouter (see App.jsx), so useNavigate isn't
      // available here; a hard navigation is the only router-agnostic option.
      if (event === 'PASSWORD_RECOVERY') {
        if (window.location.pathname !== '/reset-password') {
          window.location.replace('/reset-password')
        }
        return
      }

      setLoading(true)
      await applySession(session)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [applySession])

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers((data ?? []).map(mapProfile))
  }, [])

  useEffect(() => {
    if (profile?.role === 'admin') fetchUsers()
    else setUsers([])
  }, [profile?.role, fetchUsers])

  const login = useCallback(async (username, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (error || !data.session) {
      return { ok: false, error: 'Incorrect username or password.' }
    }

    const { data: row } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!row) {
      await supabase.auth.signOut()
      return { ok: false, error: 'Incorrect username or password.' }
    }
    if (row.status === 'disabled') {
      await supabase.auth.signOut()
      return { ok: false, error: 'This account has been disabled. Contact an administrator.' }
    }

    const user = mapProfile(row)
    setProfile(user)
    return { ok: true, user }
  }, [])

  const logout = useCallback(() => {
    supabase.auth.signOut()
  }, [])

  const createUser = useCallback(
    async (data) => {
      const result = await invokeAdminUsers('create', {
        fullName: data.fullName,
        username: data.username,
        password: data.password,
        role: data.role,
      })
      await fetchUsers()
      return result.user
    },
    [fetchUsers],
  )

  const updateUser = useCallback(
    async (id, patch) => {
      await invokeAdminUsers('update', { id, fullName: patch.fullName, username: patch.username, role: patch.role })
      await fetchUsers()
    },
    [fetchUsers],
  )

  const toggleUserStatus = useCallback(
    async (id) => {
      const target = users.find((u) => u.id === id)
      if (!target) return
      const nextStatus = target.status === 'active' ? 'disabled' : 'active'
      const { error } = await supabase.from('profiles').update({ status: nextStatus }).eq('id', id)
      if (error) throw new Error(error.message)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)))
    },
    [users],
  )

  const resetPassword = useCallback(async (id, newPassword) => {
    await invokeAdminUsers('resetPassword', { id, password: newPassword })
  }, [])

  const deleteUser = useCallback(async (id) => {
    await invokeAdminUsers('delete', { id })
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const isUsernameTaken = useCallback(
    (username, excludeId) =>
      users.some((u) => u.id !== excludeId && u.username.trim().toLowerCase() === username.trim().toLowerCase()),
    [users],
  )

  const value = useMemo(
    () => ({
      currentUser: profile,
      loading,
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
    [profile, loading, users, login, logout, createUser, updateUser, toggleUserStatus, resetPassword, deleteUser, isUsernameTaken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
