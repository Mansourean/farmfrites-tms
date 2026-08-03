import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, canAccessPath, getDefaultRoute } from '../data/roles'
import { Icon } from '../components/ui/Icon'

// __ENABLE_DEMO_ACCOUNTS__ is a build-time constant (see vite.config.js), not a
// runtime env lookup, so that when it's false the minifier can eliminate this array
// — and the plaintext demo passwords with it — from the shipped bundle entirely.
const demoAccounts = __ENABLE_DEMO_ACCOUNTS__
  ? [
      { role: ROLE_LABELS.admin, username: 'admin', password: 'admin123' },
      { role: ROLE_LABELS.dispatcher, username: 'dispatcher', password: 'dispatcher123' },
      { role: ROLE_LABELS.warehouse, username: 'warehouse1', password: 'warehouse123' },
      { role: ROLE_LABELS.viewer, username: 'viewer', password: 'viewer123' },
    ]
  : []

const inputClass =
  'rounded-lg border border-border-strong bg-white px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-brand-400'

export function LoginPage() {
  const { currentUser, loading, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Avoid flashing the login form while a persisted session is still being restored.
  if (loading) return null

  if (currentUser) {
    const from = location.state?.from?.pathname
    const target = from && canAccessPath(currentUser.role, from) ? from : getDefaultRoute(currentUser.role)
    return <Navigate to={target} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const result = await login(username, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    const from = location.state?.from?.pathname
    const target = from && canAccessPath(result.user.role, from) ? from : getDefaultRoute(result.user.role)
    navigate(target, { replace: true })
  }

  const fillDemo = (account) => {
    setUsername(account.username)
    setPassword(account.password)
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-text-primary text-[15px] font-bold text-white">
            FF
          </span>
          <div className="text-center leading-[1.2]">
            <p className="text-[15px] font-semibold text-text-primary">Farm Frites</p>
            <p className="text-[12px] text-text-muted">Transportation Management System</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5 rounded-xl border border-border bg-white p-6 shadow-sm">
          <p className="text-[15px] font-semibold text-text-primary">Sign in</p>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-text-secondary">Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-text-secondary">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClass} w-full pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
          </label>

          {error && <p className="rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}

          <button
            type="submit"
            disabled={!username || !password || submitting}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-text-primary py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#333331] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Login'}
          </button>
        </form>

        {__ENABLE_DEMO_ACCOUNTS__ && (
          <div className="mt-4 rounded-xl border border-border bg-white p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">Demo Accounts</p>
            <div className="flex flex-col gap-0.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-hover"
                >
                  <span className="font-medium text-text-primary">{account.role}</span>
                  <span className="text-text-muted">
                    {account.username} / {account.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[11.5px] text-text-faint">Farm Frites KSA · Production · v1.0</p>
      </div>
    </div>
  )
}
