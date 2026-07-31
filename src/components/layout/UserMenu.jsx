import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../data/roles'
import { Avatar } from '../ui/Avatar'
import { Popover } from '../ui/Popover'
import { Icon } from '../ui/Icon'
import { getInitials } from '../../utils/initials'

export function UserMenu() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  if (!currentUser) return null

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Popover
      align="right"
      button={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-surface-hover md:pr-2 ${open ? 'bg-surface-hover' : ''}`}
        >
          <Avatar name={currentUser.fullName} initials={getInitials(currentUser.fullName)} color="#DDEBFF" size={24} />
          <span className="hidden max-w-[110px] truncate text-[13px] font-medium text-text-primary sm:inline">
            {currentUser.fullName}
          </span>
          <Icon name="chevronDown" className="hidden h-3 w-3 shrink-0 text-text-muted sm:inline" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-56 py-1">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-text-primary">{currentUser.fullName}</p>
            <p className="text-[12px] text-text-muted">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              close()
              handleLogout()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <Icon name="logOut" className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      )}
    </Popover>
  )
}
