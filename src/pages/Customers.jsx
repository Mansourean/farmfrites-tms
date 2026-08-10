import { useTrips } from '../context/TripsContext'
import { Avatar } from '../components/ui/Avatar'
import { getInitials } from '../utils/initials'

// Reads live Supabase master data (see TripsContext/services/masterData.js) -- this page used
// to render the old static demo dataset (src/data/customers.js), which meant it showed
// fictional customers instead of real ones. Fixed here rather than left stale now that this
// page is reachable from the sidebar again.
export function Customers() {
  const { trips, customers } = useTrips()

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <p className="mb-3 text-[13px] text-text-muted">{customers.length} clients</p>
      <div className="overflow-hidden rounded-xl border border-border">
        {customers.map((customer, i) => {
          const tripCount = trips.filter((t) => t.customerId === customer.id).length
          return (
            <div
              key={customer.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] ${i !== customers.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={customer.name} initials={getInitials(customer.name)} color="#DDEBFF" size={26} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{customer.name}</p>
                  <p className="truncate text-[12px] text-text-muted">{customer.code}</p>
                </div>
              </div>
              <span className="shrink-0 text-[12.5px] text-text-muted">{tripCount} trip{tripCount === 1 ? '' : 's'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
