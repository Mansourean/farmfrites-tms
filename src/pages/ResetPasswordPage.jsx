import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/ui/Icon'

// Reached via the link in a Supabase "reset password" email (?type=recovery). Supabase's
// client auto-detects the recovery token in the URL and establishes a short-lived recovery
// session before this component even mounts — we don't need to parse anything ourselves,
// just call auth.updateUser() while that session is active. Deliberately outside
// ProtectedRoute (no normal session exists yet) and doesn't redirect on an existing
// currentUser the way LoginPage does, so the recovery session can't bounce the user away
// before they set a new password.
const inputClass =
  'rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-brand-400'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setSubmitting(false)
      setError(
        /session/i.test(updateError.message)
          ? 'This reset link is invalid or has expired. Please request a new one.'
          : updateError.message,
      )
      return
    }

    await supabase.auth.signOut()
    setSubmitting(false)
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 1500)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[var(--color-ink)] text-[15px] font-bold text-[var(--color-ink-text)]">
            FF
          </span>
          <div className="text-center leading-[1.2]">
            <p className="text-[15px] font-semibold text-text-primary">Farm Frites</p>
            <p className="text-[12px] text-text-muted">Transportation Management System</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-[15px] font-semibold text-text-primary">Set a new password</p>

          {done ? (
            <p className="rounded-md bg-[var(--color-success-strong-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-success-strong-text)]">
              Password updated. Redirecting to login…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">New password</span>
                <div className="relative">
                  <input
                    autoFocus
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

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-text-secondary">Confirm password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </label>

              {error && <p className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-danger-text)]">{error}</p>}

              <button
                type="submit"
                disabled={!password || !confirmPassword || submitting}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-ink)] py-2.5 text-[14px] font-semibold text-[var(--color-ink-text)] transition-colors hover:bg-[var(--color-ink-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-text-faint">Farm Frites KSA · Production · v1.0</p>
      </div>
    </div>
  )
}
