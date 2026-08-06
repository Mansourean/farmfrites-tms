import { useMemo, useState } from 'react'
import { FilterBar } from '../components/toolbar/FilterBar'
import { TripsView } from '../components/trips/TripsView'
import { useTrips } from '../context/TripsContext'
import { ColumnsProvider } from '../context/ColumnsContext'
import { originLabel, transporterName } from '../data/lookup'
import { sortTrips } from '../utils/tripSort'
import { exportTripsToExcel } from '../utils/excelExporter'

const defaultFilters = {
  search: '',
  status: 'all',
  tripType: 'all',
  transporterId: 'all',
  warehouseId: 'all',
  dateFrom: null,
  dateTo: null,
}

export function TransportationLog() {
  const { trips, loading, error, reload } = useTrips()
  const [filters, setFilters] = useState(defaultFilters)

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const matches = trips.filter((trip) => {
      if (filters.status !== 'all' && trip.status !== filters.status) return false
      if (filters.tripType !== 'all' && trip.tripType !== filters.tripType) return false
      if (filters.transporterId !== 'all' && trip.transporterId !== filters.transporterId) return false
      if (
        filters.warehouseId !== 'all' &&
        trip.sourceWarehouseId !== filters.warehouseId &&
        trip.destinationWarehouseId !== filters.warehouseId
      )
        return false
      if (filters.dateFrom && trip.dispatchDate < filters.dateFrom) return false
      if (filters.dateTo && trip.dispatchDate > filters.dateTo) return false
      if (q) {
        const haystack = [
          trip.salesNo,
          originLabel(trip),
          transporterName(trip),
          trip.driver?.name,
          trip.plateNo,
          trip.destination,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    return sortTrips(matches)
  }, [trips, filters])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[13px] text-text-muted">Loading trips…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-[#B42318]">Could not load trips: {error}</p>
        <button
          type="button"
          onClick={reload}
          className="rounded-md bg-text-primary px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331]"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <ColumnsProvider>
      <div className="flex flex-1 flex-col overflow-hidden">
        <FilterBar
          title="Transportation Log"
          count={trips.length}
          filters={filters}
          onFilterChange={setFilters}
          onExport={() => exportTripsToExcel(filtered)}
        />
        <div className="flex-1 overflow-auto pt-5">
          <TripsView trips={filtered} />
        </div>
      </div>
    </ColumnsProvider>
  )
}
