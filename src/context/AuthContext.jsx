import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Detect a Supabase password-recovery link synchronously, at module load — before Supabase's
// client has a chance to process the URL. The PASSWORD_RECOVERY event fired inside
// supabase-js is deferred via setTimeout(0) and isn't queued for late subscribers the way
// other init-time events are, so it can arrive after AuthProvider's useEffect has registered
// its onAuthStateChange listener, or before — the event alone is a race, not a guarantee (see
// the PASSWORD_RECOVERY branch below, kept as a defense-in-depth backup). Reading the URL here
// runs deterministically before any of that, since it's plain synchronous parsing of data the
// browser already has. The hash/query is preserved on the redirect so Supabase can still
// exchange the token once the page reloads on /reset-password.
if (window.location.pathname !== '/reset-password') {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  if (hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery') {
    window.location.replace(`/reset-password${window.location.search}${window.location.hash}`)
  }
}

const AuthContext = createContext(null)

function mapProfile(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
  }
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
    // The Edge Function resolves username -> real email and checks the password entirely
    // server-side (via service_role, reading profiles.email) — the browser never learns any
    // employee's real email address, only the resulting session tokens on success.
    const { data, error } = await supabase.functions.invoke('login', { body: { username, password } })
    if (error || !data?.access_token || !data?.refresh_token) {
      return { ok: false, error: 'Incorrect username or password.' }
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
    if (sessionError || !sessionData.user) {
      return { ok: false, error: 'Incorrect username or password.' }
    }

    const { data: row } = await supabase.from('profiles').select('*').eq('id', sessionData.user.id).single()
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

  // Deliberately swallows any error — the forgot-password Edge Function already always
  // responds with the same generic message regardless of whether the username exists, and
  // surfacing a distinct failure here (e.g. network/5xx) would create a second way to tell
  // "no such account" apart from "something went wrong," which defeats the point.
  const requestPasswordReset = useCallback(async (username) => {
    try {
      await supabase.functions.invoke('forgot-password', { body: { username } })
    } catch {
      // ignored — caller always shows the same generic confirmation
    }
  }, [])

  const createUser = useCallback(
    async (data) => {
      const result = await invokeAdminUsers('create', {
        fullName: data.fullName,
        username: data.username,
        email: data.email,
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
      await invokeAdminUsers('update', {
        id,
        fullName: patch.fullName,
        username: patch.username,
        email: patch.email,
        role: patch.role,
      })
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
      requestPasswordReset,
      createUser,
      updateUser,
      toggleUserStatus,
      resetPassword,
      deleteUser,
      isUsernameTaken,
    }),
    [
      profile,
      loading,
      users,
      login,
      logout,
      requestPasswordReset,
      createUser,
      updateUser,
      toggleUserStatus,
      resetPassword,
      deleteUser,
      isUsernameTaken,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
