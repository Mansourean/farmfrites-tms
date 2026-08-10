/**
 * Validates one mapped row (see excelMapper.mapExcelRow). Returns a list of human-readable
 * error strings — empty when the row is clean. Never throws, so one bad row never stops
 * the rest of the sheet from being processed.
 */
export function validateMappedRow(mapped) {
  const errors = []

  if (!mapped.salesNo) {
    errors.push('Sales No is required')
  }

  if (mapped.tripType === 'internal') {
    if (!mapped.sourceWarehouseRaw) {
      errors.push('Source Warehouse is required for Internal Transfer trips')
    } else if (!mapped.sourceWarehouseId) {
      errors.push(`Unknown Source Warehouse "${mapped.sourceWarehouseRaw}"`)
    }
  } else if (!mapped.customerRaw) {
    errors.push('Client is required')
  } else if (!mapped.customerId) {
    errors.push(`Unknown Client "${mapped.customerRaw}"`)
  }

  if (!mapped.destination) {
    errors.push('Destination is required')
  }

  if (!mapped.dispatchDateRaw) {
    errors.push('Dispatch Date is required')
  } else if (!mapped.dispatchDate) {
    errors.push(`Invalid Dispatch Date "${mapped.dispatchDateRaw}"`)
  }

  return errors
}
