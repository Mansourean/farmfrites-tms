import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { ROLE_LABELS, ROLE_OPTIONS } from '../../data/roles'
import { Avatar } from '../../components/ui/Avatar'
import { Icon } from '../../components/ui/Icon'
import { getInitials } from '../../utils/initials'

const inputClass =
  'rounded-md border border-border-strong bg-white px-2.5 py-[7px] text-[13px] text-text-primary outline-none focus:border-brand-400'

// Must match the Edge Function's validation (supabase/functions/admin-users/index.ts) exactly.
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{label}</span>
      {children}
    </label>
  )
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[14px] font-semibold text-text-primary">{title}</p>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      </div>
    </div>
  )
}

function UserFormModal({ user, isUsernameTaken, onSave, onClose }) {
  const isEdit = Boolean(user)
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role ?? ROLE_OPTIONS[0])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !username.trim() || !email.trim() || (!isEdit && !password.trim())) {
      setError('Please fill in every field.')
      return
    }
    if (!USERNAME_RE.test(username.trim().toLowerCase())) {
      setError('Username must be 3-32 characters: lowercase letters, numbers, dots, underscores, or hyphens.')
      return
    }
    if (!EMAIL_RE.test(email.trim().toLowerCase())) {
      setError('Please enter a valid email address.')
      return
    }
    if (isUsernameTaken(username, user?.id)) {
      setError('That username is already in use.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSave({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        role,
        ...(isEdit ? {} : { password: password.trim() }),
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title={isEdit ? 'Edit User' : 'Create User'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={submitting}
            className="rounded-md bg-text-primary px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Full Name">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Faisal Al-Harbi" />
        </Field>
        <Field label="Username">
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. faisal" />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. faisal@farmfrites.com"
          />
        </Field>
        {!isEdit && (
          <Field label="Password">
            <input
              type="text"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary password"
            />
          </Field>
        )}
        <Field label="Role">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}
      </form>
    </ModalShell>
  )
}

function ResetPasswordModal({ user, onSave, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Enter a new password.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSave(password.trim())
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title={`Reset Password — ${user.fullName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            Cancel
          </button>
          <button
            type="submit"
            form="reset-password-form"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md bg-text-primary px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="key" className="h-3.5 w-3.5" />
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="New Password">
          <input
            autoFocus
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a new password"
          />
        </Field>
        {error && <p className="rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}
      </form>
    </ModalShell>
  )
}

function ConfirmDeleteModal({ user, onConfirm, onClose }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Delete User"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="rounded-md bg-[#B42318] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#98190F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Deleting…' : 'Delete User'}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-text-secondary">
        Are you sure you want to permanently delete <span className="font-medium text-text-primary">{user.fullName}</span>{' '}
        (@{user.username})? This cannot be undone.
      </p>
      {error && <p className="mt-3 rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}
    </ModalShell>
  )
}

const roleBadgeColors = {
  admin: { bg: '#EDE7FE', color: '#7C5CFC' },
  dispatcher: { bg: '#DDEBFF', color: '#3B82F6' },
  warehouse: { bg: '#DAF3E3', color: '#0F6B32' },
  viewer: { bg: '#E4E4E1', color: '#6F6F6D' },
}

function RoleBadge({ role }) {
  const config = roleBadgeColors[role] ?? roleBadgeColors.viewer
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function StatusBadge({ status }) {
  const active = status === 'active'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-semibold"
      style={{ backgroundColor: active ? '#DAF3E3' : '#FBE7E5', color: active ? '#0F6B32' : '#B42318' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? '#0F6B32' : '#B42318' }} />
      {active ? 'Active' : 'Disabled'}
    </span>
  )
}

export function UserManagement({ currentUserId }) {
  const { users, createUser, updateUser, toggleUserStatus, resetPassword, deleteUser, isUsernameTaken } = useAuth()
  const { notify } = useToast()
  const [modal, setModal] = useState(null) // { type: 'create' | 'edit' | 'reset' | 'delete', user? }

  const closeModal = () => setModal(null)

  const handleToggleStatus = async (id) => {
    try {
      await toggleUserStatus(id)
    } catch (err) {
      notify(err.message, { type: 'error' })
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-text-muted">{users.length} users</p>
        <button
          type="button"
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-1.5 rounded-md bg-text-primary px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331]"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          Create User
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {users.map((user, i) => {
          const isSelf = user.id === currentUserId
          return (
            <div
              key={user.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] ${i !== users.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={user.fullName} initials={getInitials(user.fullName)} color="#DDEBFF" size={30} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">
                    {user.fullName}
                    {isSelf && <span className="ml-1.5 text-[11px] font-normal text-text-faint">(you)</span>}
                  </p>
                  <p className="truncate text-[12px] text-text-muted">@{user.username}</p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />

                <div className="ml-1 flex items-center gap-0.5">
                  <button
                    type="button"
                    title="Edit User"
                    onClick={() => setModal({ type: 'edit', user })}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  >
                    <Icon name="edit" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Reset Password"
                    onClick={() => setModal({ type: 'reset', user })}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  >
                    <Icon name="key" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={user.status === 'active' ? 'Disable User' : 'Enable User'}
                    onClick={() => handleToggleStatus(user.id)}
                    disabled={isSelf}
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon name={user.status === 'active' ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete User"
                    onClick={() => setModal({ type: 'delete', user })}
                    disabled={isSelf}
                    className="rounded-md p-1.5 text-text-muted hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <UserFormModal
          user={modal.user}
          isUsernameTaken={isUsernameTaken}
          onClose={closeModal}
          onSave={(data) => (modal.type === 'create' ? createUser(data) : updateUser(modal.user.id, data))}
        />
      )}

      {modal?.type === 'reset' && (
        <ResetPasswordModal user={modal.user} onClose={closeModal} onSave={(password) => resetPassword(modal.user.id, password)} />
      )}

      {modal?.type === 'delete' && (
        <ConfirmDeleteModal user={modal.user} onClose={closeModal} onConfirm={() => deleteUser(modal.user.id)} />
      )}
    </div>
  )
}
