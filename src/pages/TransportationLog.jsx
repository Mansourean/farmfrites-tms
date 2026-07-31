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
  const { trips } = useTrips()
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
