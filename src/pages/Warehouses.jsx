import { Link } from 'react-router-dom'
import { warehouses } from '../data/warehouses'
import { useTrips } from '../context/TripsContext'
import { Icon } from '../components/ui/Icon'

export function Warehouses() {
  const { trips } = useTrips()

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-alt p-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-primary">Warehouse Loading Scan</p>
          <p className="text-[12.5px] text-text-muted">Open on a phone to scan a truck plate and mark it loaded or rejected.</p>
        </div>
        <Link
          to="/warehouse/scan"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-text-primary px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331]"
        >
          <Icon name="camera" className="h-3.5 w-3.5" />
          Open Scanner
        </Link>
      </div>

      <p className="mb-3 text-[13px] text-text-muted">{warehouses.length} warehouses</p>
      <div className="overflow-hidden rounded-xl border border-border">
        {warehouses.map((warehouse, i) => {
          const outbound = trips.filter((t) => t.sourceWarehouseId === warehouse.id && t.status !== 'delivered').length
          return (
            <div
              key={warehouse.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] ${i !== warehouses.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#E1F5EC] text-[#34B27B]">
                  <Icon name="building" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{warehouse.name}</p>
                  <p className="truncate text-[12px] text-text-muted">{warehouse.city}</p>
                </div>
              </div>
              <span className="shrink-0 text-[12.5px] text-text-muted">{outbound} pending outbound</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
