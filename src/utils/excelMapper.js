// The column headers the importer recognizes. Extra columns in the sheet are ignored.
export const EXPECTED_HEADERS = [
  'Sales No',
  'Trip Type',
  'Client',
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

// customers/transporters/warehouses now come from live Supabase master data (see
// services/masterData.js) instead of the old static seed files -- findByName still just
// matches on `.name`, so this only changes *where* the list comes from, not how matching
// works. Every list item is `{id, code, name}`; a match's `.id` is a real Supabase UUID.
function findByName(list, name) {
  if (!name) return null
  const target = name.trim().toLowerCase()
  return list.find((item) => item.name.trim().toLowerCase() === target) ?? null
}

export const findCustomerByName = (name, customers) => findByName(customers, name)
export const findWarehouseByName = (name, warehouses) => findByName(warehouses, name)
export const findTransporterByName = (name, transporters) => findByName(transporters, name)

// Defaults to "Client Delivery" when the column is blank or unrecognized.
export function resolveTripType(text) {
  const value = String(text ?? '').trim().toLowerCase()
  if (value.includes('internal')) return 'internal'
  return 'customer'
}

// Defaults to "New Order" (DB value 'Planned') when the column is blank or unrecognized.
// Checked in a specific order since some values overlap as substrings (e.g. "driver" isn't in
// any other status, and "ready/waiting for loading" must be checked before both the plain
// "load" check and the plain "ready" check -- "Ready for Loading" contains "ready", so it must
// resolve here first or it would incorrectly match ready_for_transporter below).
export function resolveStatus(text) {
  const value = String(text ?? '').trim().toLowerCase()
  if (value.includes('reject')) return 'rejected'
  if (value.includes('cancel')) return 'cancelled'
  if (value.includes('deliver')) return 'delivered'
  if (value.includes('transit')) return 'in_transit'
  // Matches the current label ("Confirmed") and both earlier ones ("Ready for Loading",
  // "Waiting for Loading", still the literal DB value -- see 0016) so previously-exported files
  // of any vintage still import correctly.
  if (value.includes('confirm')) return 'waiting_for_loading'
  if ((value.includes('ready') || value.includes('waiting')) && value.includes('load')) return 'waiting_for_loading'
  if (value.includes('gate')) return 'at_gate'
  if (value.includes('load')) return 'loaded'
  if (value.includes('assignment') || value.includes('ready')) return 'ready_for_transporter'
  if (value.includes('driver')) return 'waiting_driver'
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
 * `masterData` ({customers, transporters, warehouses}, each live from Supabase) is required
 * so Customer/Transporter/Warehouse names in the sheet resolve to real UUIDs -- a name that
 * doesn't match any live record (e.g. an old demo-only name) simply won't match, surfacing
 * as "Unknown Customer/Warehouse" in excelValidator.js, same as any other unrecognized name.
 */
export function mapExcelRow(rawRow, masterData) {
  const lookup = new Map(Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value]))
  const get = (field) => {
    const raw = lookup.get(normalizeHeader(field))
    return raw === undefined || raw === null ? '' : String(raw).trim()
  }

  const tripType = resolveTripType(get('Trip Type'))
  // Accepts both the current header ("Client") and the earlier one ("Customer", still what
  // Sales' own template may use) -- whichever column is actually present in the sheet wins.
  const customerRaw = get('Client') || get('Customer')
  const sourceWarehouseRaw = get('Source Warehouse')
  const destination = get('Destination')
  const transporterRaw = get('Transporter')
  const dispatchDateRaw = get('Dispatch Date')
  const deliveryDateRaw = get('Delivery Date')

  const customerMatch = findCustomerByName(customerRaw, masterData.customers)
  const warehouseMatch = findWarehouseByName(sourceWarehouseRaw, masterData.warehouses)
  const transporterMatch = findTransporterByName(transporterRaw, masterData.transporters)
  // Soft, best-effort match: the sheet only has a free-text "Destination" column, but
  // when it happens to name a known warehouse (typical for internal transfers) we can
  // still link it so the app's warehouse filters pick the trip up.
  const destinationWarehouseMatch =
    tripType === 'internal' ? findWarehouseByName(destination, masterData.warehouses) : null

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
