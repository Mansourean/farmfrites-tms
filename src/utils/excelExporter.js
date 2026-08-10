const TRIP_TYPE_LABELS = {
  customer: 'Client Delivery',
  internal: 'Internal Transfer',
}

const STATUS_LABELS = {
  planned: 'New Order',
  ready_for_transporter: 'Transportation Assignment',
  waiting_for_loading: 'Confirmed',
  waiting_driver: 'Waiting Driver',
  loaded: 'Loaded',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

// Mirrors the columns the importer recognizes (see excelMapper.js), so a file exported
// here can be re-imported without any manual re-mapping. Reads the names TripsContext
// already resolved against live Supabase master data (see lib/tripsMapping.js) rather than
// looking them up again here.
function tripToRow(trip) {
  return {
    'Sales No': trip.salesNo,
    'Trip Type': TRIP_TYPE_LABELS[trip.tripType] ?? trip.tripType,
    Client: trip.tripType === 'customer' ? trip.customerName ?? '' : '',
    'Source Warehouse': trip.sourceWarehouseName ?? '',
    Destination: trip.destination,
    Transporter: trip.transporterName ?? '',
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
