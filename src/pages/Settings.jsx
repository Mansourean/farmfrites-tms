import { useState } from 'react'
import { Icon } from '../components/ui/Icon'
import { Customers } from './Customers'
import { Transporters } from './Transporters'
import { Warehouses } from './Warehouses'
import { UserManagement } from './settings/UserManagement'
import { useAuth } from '../context/AuthContext'

const tabs = [
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'customers', label: 'Customers', icon: 'userCircle' },
  { key: 'transporters', label: 'Transporters', icon: 'truck' },
  { key: 'warehouses', label: 'Warehouses', icon: 'building' },
  { key: 'general', label: 'General', icon: 'settings' },
]

const generalRows = [
  { label: 'Workspace', value: 'Farm Frites KSA' },
  { label: 'Environment', value: 'Production' },
  { label: 'App Version', value: '1.0.0' },
  { label: 'Default Currency', value: 'SAR' },
  { label: 'Time Zone', value: 'Asia/Riyadh (GMT+3)' },
]

function GeneralTab() {
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-xl">
        <div className="flex items-center gap-3 rounded-xl border border-border p-4">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-text-primary text-[14px] font-bold text-white">FF</span>
          <div>
            <p className="text-[14px] font-semibold text-text-primary">Farm Frites</p>
            <p className="text-[12.5px] text-text-muted">Transportation Management System</p>
          </div>
        </div>

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
      {activeTab === 'customers' && <Customers />}
      {activeTab === 'transporters' && <Transporters />}
      {activeTab === 'warehouses' && <Warehouses />}
      {activeTab === 'general' && <GeneralTab />}
    </div>
  )
}
