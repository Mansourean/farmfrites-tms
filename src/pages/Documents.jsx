import { useTrips } from '../context/TripsContext'
import { Icon } from '../components/ui/Icon'
import { useTripPanel } from '../context/TripPanelContext'

export function Documents() {
  const { trips } = useTrips()
  const { openView } = useTripPanel()
  const rows = trips.flatMap((trip) => trip.documents.map((doc) => ({ ...doc, trip })))

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <p className="mb-3 text-[13px] text-text-muted">{rows.length} documents across all trips</p>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong py-14 text-center text-[13px] text-text-faint">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {rows.map((doc, i) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => openView(doc.trip.id, 'documents')}
              className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] hover:bg-surface-hover ${i !== rows.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-alt">
                <Icon name="fileText" className="h-4 w-4 text-text-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text-primary">{doc.name}</p>
                <p className="text-[12px] text-text-muted">{doc.kind} · {doc.trip.salesNo}</p>
              </div>
              <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
