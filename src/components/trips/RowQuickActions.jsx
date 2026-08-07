import { useTripPanel } from '../../context/TripPanelContext'
import { useWhatsappModal } from '../../context/WhatsappModalContext'
import { useDeleteTrip } from '../../context/DeleteTripContext'
import { useAuth } from '../../context/AuthContext'
import { canEdit } from '../../data/roles'
import { Icon } from '../ui/Icon'

const readActions = [
  { key: 'print', label: 'Print', icon: 'printer' },
  { key: 'timeline', label: 'Timeline', icon: 'clock' },
]

const editActions = [
  { key: 'edit', label: 'Edit Trip', icon: 'edit' },
  { key: 'whatsapp', label: 'Send WhatsApp', icon: 'whatsapp', activeColor: '#1E9E6A' },
]

const deleteAction = { key: 'delete', label: 'Delete Trip', icon: 'trash', activeColor: '#B42318' }

export function RowQuickActions({ tripId, className = '' }) {
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

  const actions = editable ? [...editActions, ...readActions, deleteAction] : readActions

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          title={action.label}
          onClick={(e) => {
            e.stopPropagation()
            handlers[action.key]()
          }}
          className="rounded-md p-1.5 text-text-muted transition-all duration-150 hover:scale-110 hover:bg-surface-hover hover:text-text-primary active:scale-95"
          onMouseEnter={(e) => action.activeColor && (e.currentTarget.style.color = action.activeColor)}
          onMouseLeave={(e) => (e.currentTarget.style.color = '')}
        >
          <Icon name={action.icon} className="h-[15px] w-[15px]" />
        </button>
      ))}
    </div>
  )
}
