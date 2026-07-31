import { customers } from '../data/customers'
import { transporters } from '../data/transporters'
import { warehouses } from '../data/warehouses'

// The column headers the importer recognizes. Extra columns in the sheet are ignored.
export const EXPECTED_HEADERS = [
  'Sales No',
  'Trip Type',
  'Customer',
  'Source Warehouse',
  'Destination',
  'Transporter',
  'Driver',
  'Driver Phone',
  'Plate No',
  'Dispatch Date',
  'Delivery Date',
  'Status',
  'Remarks',
]

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function findByName(list, name) {
  if (!name) return null
  const target = name.trim().toLowerCase()
  return list.find((item) => item.name.trim().toLowerCase() === target) ?? null
}

export const findCustomerByName = (name) => findByName(customers, name)
export const findWarehouseByName = (name) => findByName(warehouses, name)
export const findTransporterByName = (name) => findByName(transporters, name)

// Defaults to "Customer Delivery" when the column is blank or unrecognized.
export function resolveTripType(text) {
  const value = String(text ?? '').trim().toLowerCase()
  if (value.includes('internal')) return 'internal'
  return 'customer'
}

// Defaults to "Planned" when the column is blank or unrecognized.
export function resolveStatus(text) {
  const value = String(text ?? '').trim().toLowerCase()
  if (value.includes('deliver')) return 'delivered'
  if (value.includes('transit')) return 'in_transit'
  return 'planned'
}

// Accepts ISO strings, common written dates, and Excel's own date formatting
// (sheet_to_json is asked to format date cells as yyyy-mm-dd — see excelImporter.js).
export function parseExcelDate(value) {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isRowBlank(rawRow) {
  return Object.values(rawRow).every((value) => String(value ?? '').trim() === '')
}

/**
 * Converts one raw sheet row (keyed by whatever headers the workbook used) into the
 * normalized shape the rest of the importer and TripsContext.importTrips understand.
 */
export function mapExcelRow(rawRow) {
  const lookup = new Map(Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value]))
  const get = (field) => {
    const raw = lookup.get(normalizeHeader(field))
    return raw === undefined || raw === null ? '' : String(raw).trim()
  }

  const tripType = resolveTripType(get('Trip Type'))
  const customerRaw = get('Customer')
  const sourceWarehouseRaw = get('Source Warehouse')
  const destination = get('Destination')
  const transporterRaw = get('Transporter')
  const dispatchDateRaw = get('Dispatch Date')
  const deliveryDateRaw = get('Delivery Date')

  const customerMatch = findCustomerByName(customerRaw)
  const warehouseMatch = findWarehouseByName(sourceWarehouseRaw)
  const transporterMatch = findTransporterByName(transporterRaw)
  // Soft, best-effort match: the sheet only has a free-text "Destination" column, but
  // when it happens to name a known warehouse (typical for internal transfers) we can
  // still link it so the app's warehouse filters pick the trip up.
  const destinationWarehouseMatch = tripType === 'internal' ? findWarehouseByName(destination) : null

  return {
    salesNo: get('Sales No'),
    tripType,
    customerRaw,
    customerId: customerMatch?.id ?? null,
    sourceWarehouseRaw,
    sourceWarehouseId: warehouseMatch?.id ?? null,
    destination,
    destinationWarehouseId: destinationWarehouseMatch?.id ?? null,
    transporterRaw,
    transporterId: transporterMatch?.id ?? null,
    driverName: get('Driver'),
    driverPhone: get('Driver Phone'),
    plateNo: get('Plate No'),
    dispatchDateRaw,
    dispatchDate: parseExcelDate(dispatchDateRaw),
    deliveryDateRaw,
    deliveryDate: parseExcelDate(deliveryDateRaw),
    status: resolveStatus(get('Status')),
    remarks: get('Remarks'),
  }
}
