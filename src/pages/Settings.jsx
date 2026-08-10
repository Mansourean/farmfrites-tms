import { useState } from 'react'
import { Icon } from '../components/ui/Icon'
import { Destinations } from './settings/Destinations'
import { UserManagement } from './settings/UserManagement'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

// Customers/Transporters moved to the sidebar (approved) -- they're full pages of their own
// now, not Settings tabs. Warehouses isn't needed here. Destinations stays in Settings since
// it's an occasional admin task (Transit Days upkeep -- see 0018), not daily-use navigation.
const tabs = [
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'destinations', label: 'Destinations', icon: 'mapPin' },
  { key: 'general', label: 'General', icon: 'settings' },
]

const generalRows = [
  { label: 'Workspace', value: 'Farm Frites KSA' },
  { label: 'Environment', value: 'Production' },
  { label: 'App Version', value: '1.0.0' },
  { label: 'Default Currency', value: 'SAR' },
  { label: 'Time Zone', value: 'Asia/Riyadh (GMT+3)' },
]

function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ]
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div>
        <p className="text-[13px] font-medium text-text-primary">Appearance</p>
        <p className="text-[12.5px] text-text-muted">Choose how Farm Frites TMS looks on this device.</p>
      </div>
      <div className="flex shrink-0 rounded-md border border-border-strong bg-surface-alt p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              theme === option.value ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Icon name={option.icon} className="h-3.5 w-3.5" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function GeneralTab() {
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-xl">
        <div className="flex items-center gap-3 rounded-xl border border-border p-4">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--color-ink)] text-[14px] font-bold text-[var(--color-ink-text)]">FF</span>
          <div>
            <p className="text-[14px] font-semibold text-text-primary">Farm Frites</p>
            <p className="text-[12.5px] text-text-muted">Transportation Management System</p>
          </div>
        </div>

        <AppearanceCard />

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {generalRows.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-4 py-3 text-[13px] ${i !== generalRows.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="text-text-secondary">{row.label}</span>
              <span className="font-medium text-text-primary">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-surface-alt p-4 text-[12.5px] text-text-muted">
          <Icon name="checkSquare" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34B27B]" />
          Progressive Web App enabled — install Farm Frites TMS to your home screen for a native app experience.
        </div>
      </div>
    </div>
  )
}

export function Settings() {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-[13px] font-medium transition-colors ${
              activeTab === tab.key ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Icon name={tab.icon} className="h-3.5 w-3.5" />
            {tab.label}
            {activeTab === tab.key && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-text-primary" />}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UserManagement currentUserId={currentUser?.id} />}
      {activeTab === 'destinations' && <Destinations />}
      {activeTab === 'general' && <GeneralTab />}
    </div>
  )
}
