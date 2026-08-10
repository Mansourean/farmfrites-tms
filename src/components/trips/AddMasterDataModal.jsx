import { useEffect, useState } from 'react'
import { createCustomer, createTransporter, createWarehouse, createDestination } from '../../services/masterDataActions'
import { Icon } from '../ui/Icon'

// One small reusable dialog for the inline "+" master-data creation, rather than one
// near-identical component per entity -- entityType selects which RPC/labels apply. Only Name
// is collected for every entity: it's the only NOT NULL field on customers/transporters/
// warehouses/destinations beyond code (server-generated) and id -- city/contact/phone/email/
// address are left for a future proper master-data management UI, not built here. Transporter
// mobile number is deliberately not collected here (see 0015) -- a transporter can be created
// name-only and its phone added later via a proper edit UI when one exists; `extraField` is kept
// as a generic mechanism below in case a future entity genuinely needs a second required input.
const ENTITY_CONFIG = {
  customer: { title: 'Add Customer', label: 'Customer Name', placeholder: 'e.g. Panda Retail Co.', create: createCustomer },
  transporter: {
    title: 'Add Transporter',
    label: 'Transporter Name',
    placeholder: 'e.g. Almajdouie Logistics',
    create: createTransporter,
  },
  warehouse: { title: 'Add Warehouse', label: 'Warehouse Name', placeholder: 'e.g. Jeddah DC', create: createWarehouse },
  destination: {
    title: 'Add Destination',
    label: 'Destination Name',
    placeholder: 'e.g. Panda DC, Jeddah Industrial Area',
    // Optional (see 0017) -- powers the New Trip Dispatch Date suggestion once known, but a
    // destination can always be created without it and filled in later.
    extraField: {
      key: 'transitDays',
      label: 'Transit Days (optional)',
      placeholder: 'e.g. 2',
      type: 'number',
      required: false,
    },
    create: createDestination,
  },
}

export function AddMasterDataModal({ open, entityType, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [extra, setExtra] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const config = ENTITY_CONFIG[entityType]

  useEffect(() => {
    if (!open) return
    setName('')
    setExtra('')
    setError('')
  }, [open, entityType])

  if (!open) return null

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }

    let extraValue
    if (config.extraField) {
      const trimmedExtra = extra.trim()
      if (!trimmedExtra) {
        if (config.extraField.required !== false) {
          setError(`${config.extraField.label} is required.`)
          return
        }
        extraValue = null
      } else if (config.extraField.type === 'number') {
        const parsed = Number(trimmedExtra)
        if (!Number.isFinite(parsed) || parsed < 0) {
          setError(`Enter a valid number for ${config.extraField.label}.`)
          return
        }
        extraValue = parsed
      } else if (config.extraField.normalize) {
        extraValue = config.extraField.normalize(trimmedExtra)
        if (!extraValue) {
          setError(config.extraField.invalidMessage ?? `Enter a valid ${config.extraField.label}.`)
          return
        }
      } else {
        extraValue = trimmedExtra
      }
    }

    setError('')
    setSaving(true)
    try {
      const row = config.extraField ? await config.create(trimmedName, extraValue) : await config.create(trimmedName)
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
          <div className="flex flex-col gap-3.5 px-5 py-5">
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

            {config.extraField && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-faint">{config.extraField.label}</span>
                <input
                  type={config.extraField.type === 'number' ? 'number' : 'text'}
                  min={config.extraField.type === 'number' ? 0 : undefined}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={config.extraField.placeholder}
                  className="rounded-md border border-border-strong bg-white px-2.5 py-[7px] text-[13px] text-text-primary outline-none focus:border-accent-green-500"
                />
              </label>
            )}

            {error && <p className="rounded-md bg-[#FBE7E5] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">{error}</p>}
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
