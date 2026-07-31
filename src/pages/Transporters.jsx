import { transporters } from '../data/transporters'
import { useTrips } from '../context/TripsContext'
import { Icon } from '../components/ui/Icon'

export function Transporters() {
  const { trips } = useTrips()

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <p className="mb-3 text-[13px] text-text-muted">{transporters.length} transporters</p>
      <div className="overflow-hidden rounded-xl border border-border">
        {transporters.map((transporter, i) => {
          const active = trips.filter((t) => t.transporterId === transporter.id && t.status !== 'delivered').length
          return (
            <div
              key={transporter.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] ${i !== transporters.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#FFE8E4] text-[#FF6A55]">
                  <Icon name="truck" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{transporter.name}</p>
                  <p className="truncate text-[12px] text-text-muted">{transporter.phone}</p>
                </div>
              </div>
              <span className="shrink-0 text-[12.5px] text-text-muted">{active} active trip{active === 1 ? '' : 's'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
