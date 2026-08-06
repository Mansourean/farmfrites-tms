import { useState } from 'react'
import { createCustomer, createTransporter, createWarehouse, createDestination } from '../../services/masterDataActions'
import { Icon } from '../ui/Icon'

// One small reusable dialog for the inline "+" master-data creation, rather than one
// near-identical component per entity -- entityType selects which RPC/labels apply. Only Name
// is collected: it's the only NOT NULL field on customers/transporters/warehouses/destinations
// beyond code (server-generated) and id -- city/contact/phone/email/address are left for a
// future proper master-data management UI, not built here.
const ENTITY_CONFIG = {
  customer: { title: 'Add Customer', label: 'Customer Name', placeholder: 'e.g. Panda Retail Co.', create: createCustomer },
  transporter: { title: 'Add Transporter', label: 'Transporter Name', placeholder: 'e.g. Almajdouie Logistics', create: createTransporter },
  warehouse: { title: 'Add Warehouse', label: 'Warehouse Name', placeholder: 'e.g. Jeddah DC', create: createWarehouse },
  destination: {
    title: 'Add Destination',
    label: 'Destination Name',
    placeholder: 'e.g. Panda DC, Jeddah Industrial Area',
    create: createDestination,
  },
}

export function AddMasterDataModal({ open, entityType, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null
  const config = ENTITY_CONFIG[entityType]

  const handleClose = () => {
    if (saving) return
    setName('')
    setError('')
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const row = await config.create(trimmed)
      setName('')
      onCreated(row)
    } catch (err) {
      setError(err.message || 'Could not create this record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative w-full max-w-[380px] rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[14px] font-semibold text-text-primary">{config.title}</p>
          <button type="button" onClick={handleClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{config.label}</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={config.placeholder}
                className="rounded-md border border-border-strong bg-white px-2.5 py-[7px] text-[13px] text-text-primary outline-none focus:border-accent-green-500"
              />
            </label>
            {error && <p className="mt-3 rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent-green-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-accent-green-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
