import { Popover } from '../ui/Popover'
import { Icon } from '../ui/Icon'
import { useTripPanel } from '../../context/TripPanelContext'
import { useWhatsappModal } from '../../context/WhatsappModalContext'
import { useDeleteTrip } from '../../context/DeleteTripContext'
import { useAuth } from '../../context/AuthContext'
import { canEdit } from '../../data/roles'

const editItems = [
  { key: 'edit', label: 'Edit Trip', icon: 'edit' },
  { key: 'whatsapp', label: 'Send WhatsApp', icon: 'whatsapp' },
]

const readItems = [
  { key: 'print', label: 'Print', icon: 'printer' },
  { key: 'timeline', label: 'Timeline', icon: 'clock' },
]

const deleteItem = { key: 'delete', label: 'Delete Trip', icon: 'trash', danger: true }

export function RowMenu({ tripId }) {
  const { openEdit, openView } = useTripPanel()
  const whatsapp = useWhatsappModal()
  const deleteTrip = useDeleteTrip()
  const { currentUser } = useAuth()
  const editable = canEdit(currentUser?.role)

  const handlers = {
    edit: () => openEdit(tripId),
    whatsapp: () => whatsapp.open(tripId),
    print: () => window.open(`/print/trip/${tripId}`, '_blank', 'noopener,noreferrer'),
    timeline: () => openView(tripId, 'timeline'),
    delete: () => deleteTrip.open(tripId),
  }

  const items = editable ? [...editItems, ...readItems, deleteItem] : readItems

  return (
    <Popover
      align="right"
      button={({ open, toggle }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          className={`rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary ${open ? 'bg-surface-hover text-text-secondary' : ''}`}
        >
          <Icon name="moreHorizontal" className="h-4 w-4" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="min-w-[168px] py-1">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handlers[item.key]()
                close()
              }}
              className={`flex w-full items-center gap-2 px-3 py-[7px] text-left text-[13px] hover:bg-surface-hover ${
                item.danger ? 'text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon name={item.icon} className={`h-3.5 w-3.5 ${item.danger ? '' : 'text-text-muted'}`} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}
