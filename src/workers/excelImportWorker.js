import * as XLSX from 'xlsx'
import { isRowBlank, mapExcelRow } from '../utils/excelMapper'
import { validateMappedRow } from '../utils/excelValidator'

// Runs entirely off the main thread so parsing/validating tens of thousands of rows
// never blocks the UI. Progress messages let the dialog show a live counter for large
// files; the final "done" message carries the full categorized result.
self.onmessage = (event) => {
  const { fileBuffer, existingSalesNos, masterData } = event.data

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      self.postMessage({ type: 'error', message: 'The workbook has no worksheets.' })
      return
    }

    const sheet = workbook.Sheets[firstSheetName]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })

    const totalRows = rawRows.length
    const seenSalesNos = new Set(existingSalesNos.map((s) => s.trim().toUpperCase()))

    const validRows = []
    const invalidRows = []
    const duplicateRows = []
    let skippedEmpty = 0

    for (let index = 0; index < rawRows.length; index += 1) {
      const rawRow = rawRows[index]
      const rowNumber = index + 2 // +1 for header row, +1 for 1-based numbering

      if (isRowBlank(rawRow)) {
        skippedEmpty += 1
        continue
      }

      const data = mapExcelRow(rawRow, masterData)
      const errors = validateMappedRow(data)

      if (errors.length > 0) {
        invalidRows.push({ rowNumber, data, errors })
      } else {
        const key = data.salesNo.trim().toUpperCase()
        if (seenSalesNos.has(key)) {
          duplicateRows.push({ rowNumber, data })
        } else {
          seenSalesNos.add(key)
          validRows.push({ rowNumber, data })
        }
      }

      if (index % 500 === 0 || index === rawRows.length - 1) {
        self.postMessage({ type: 'progress', processed: index + 1, total: totalRows })
      }
    }

    self.postMessage({
      type: 'done',
      result: { totalRows, skippedEmpty, validRows, invalidRows, duplicateRows },
    })
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || 'Could not read this file.' })
  }
}
