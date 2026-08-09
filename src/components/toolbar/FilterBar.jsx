import { useTrips } from '../../context/TripsContext'
import { Icon } from '../ui/Icon'
import { FilterDropdown } from './FilterDropdown'
import { DateFilter } from './DateFilter'
import { ColumnManager } from './ColumnManager'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'rejected', label: 'Rejected', dot: '#D92D20' },
  { value: 'planned', label: 'Planned', dot: '#0E7490' },
  { value: 'ready_for_transporter', label: 'Ready for Transporter', dot: '#C2410C' },
  { value: 'waiting_driver', label: 'Waiting Driver', dot: '#B08900' },
  { value: 'loaded', label: 'Loaded', dot: '#6B3FA0' },
  { value: 'in_transit', label: 'In Transit', dot: '#2F6FE4' },
  { value: 'delivered', label: 'Delivered', dot: '#1E9E6A' },
  { value: 'cancelled', label: 'Cancelled', dot: '#B42318' },
]

const tripTypeOptions = [
  { value: 'all', label: 'All trip types' },
  { value: 'customer', label: 'Customer Delivery' },
  { value: 'internal', label: 'Internal Transfer' },
]

export function FilterBar({ title, count, filters, onFilterChange, onExport }) {
  const { transporters, warehouses } = useTrips()
  const transporterOptions = [
    { value: 'all', label: 'All transporters' },
    ...transporters.map((t) => ({ value: t.id, label: t.name })),
  ]
  const warehouseOptions = [
    { value: 'all', label: 'All warehouses' },
    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
  ]

  const set = (key) => (value) => onFilterChange({ ...filters, [key]: value })

  return (
    <div className="flex min-h-toolbar shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2">
      <button
        type="button"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-text-primary hover:bg-surface-hover"
      >
        <Icon name="list" className="h-3.5 w-3.5 text-text-muted" />
        {title}
        <span className="text-text-muted">{count}</span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 text-text-muted" />
      </button>

      <div className="flex flex-wrap items-center gap-1">
        <div className="relative mr-1 w-full sm:w-64">
          <Icon name="search" className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set('search')(e.target.value)}
            placeholder="Search Sales No, Customer, Driver, Plate..."
            className="w-full rounded-md border border-border-strong bg-surface-alt py-1 pl-7 pr-2 text-[13px] text-text-primary outline-none placeholder:text-text-faint focus:border-brand-400 focus:bg-white"
          />
        </div>

        <FilterDropdown icon="flag" label="Status" value={filters.status} options={statusOptions} onChange={set('status')} />
        <FilterDropdown icon="grid" label="Trip Type" value={filters.tripType} options={tripTypeOptions} onChange={set('tripType')} />
        <FilterDropdown
          icon="truck"
          label="Transporter"
          value={filters.transporterId}
          options={transporterOptions}
          onChange={set('transporterId')}
        />
        <FilterDropdown
          icon="building"
          label="Warehouse"
          value={filters.warehouseId}
          options={warehouseOptions}
          onChange={set('warehouseId')}
        />
        <DateFilter from={filters.dateFrom} to={filters.dateTo} onChange={({ from, to }) => onFilterChange({ ...filters, dateFrom: from, dateTo: to })} />

        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <Icon name="upload" className="h-3.5 w-3.5" />
          Export
        </button>
        <ColumnManager />
      </div>
    </div>
  )
}
