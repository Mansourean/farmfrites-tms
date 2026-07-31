import { getCustomer, getTransporter, getWarehouse } from '../data/lookup'

const TRIP_TYPE_LABELS = {
  customer: 'Customer Delivery',
  internal: 'Internal Transfer',
}

const STATUS_LABELS = {
  planned: 'Planned',
  in_transit: 'In Transit',
  delivered: 'Delivered',
}

// Mirrors the columns the importer recognizes (see excelMapper.js), so a file exported
// here can be re-imported without any manual re-mapping.
function tripToRow(trip) {
  return {
    'Sales No': trip.salesNo,
    'Trip Type': TRIP_TYPE_LABELS[trip.tripType] ?? trip.tripType,
    Customer: trip.tripType === 'customer' ? getCustomer(trip.customerId)?.name ?? '' : '',
    'Source Warehouse': getWarehouse(trip.sourceWarehouseId)?.name ?? '',
    Destination: trip.destination,
    Transporter: getTransporter(trip.transporterId)?.name ?? '',
    Driver: trip.driver?.name ?? '',
    'Driver Phone': trip.driver?.phone ?? '',
    'Plate No': trip.plateNo ?? '',
    'Dispatch Date': trip.dispatchDate ?? '',
    'Delivery Date': trip.deliveryDate ?? '',
    Status: STATUS_LABELS[trip.status] ?? trip.status,
    Remarks: trip.remarks ?? '',
  }
}

/**
 * Exports the given trips (typically the currently filtered/visible set) to an .xlsx
 * file and triggers a browser download. Sales No is written exactly as stored — never
 * reformatted or regenerated. `xlsx` is only fetched when an export actually happens,
 * so it doesn't add to the main app bundle.
 */
export async function exportTripsToExcel(trips, filename = 'transportation-log.xlsx') {
  const XLSX = await import('xlsx')
  const rows = trips.map(tripToRow)
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transportation Log')
  XLSX.writeFile(workbook, filename)
}
