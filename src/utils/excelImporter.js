export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']

export function hasAcceptedExtension(filename) {
  const lower = filename.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * Parses and validates an uploaded workbook in a Web Worker (see excelImportWorker.js)
 * so files with thousands of rows never freeze the UI. Resolves with:
 *   { totalRows, skippedEmpty, validRows, invalidRows, duplicateRows }
 * `onProgress({ processed, total })` fires periodically while large files are scanned.
 */
export function parseExcelFile(file, { existingSalesNos = [], masterData, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!hasAcceptedExtension(file.name)) {
      reject(new Error('Please select a .xlsx or .xls file.'))
      return
    }

    const worker = new Worker(new URL('../workers/excelImportWorker.js', import.meta.url), { type: 'module' })

    const cleanup = () => worker.terminate()

    worker.onmessage = (event) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message)
      } else if (message.type === 'done') {
        resolve(message.result)
        cleanup()
      } else if (message.type === 'error') {
        reject(new Error(message.message))
        cleanup()
      }
    }

    worker.onerror = (err) => {
      reject(new Error(err.message || 'Failed to process the file.'))
      cleanup()
    }

    const reader = new FileReader()
    reader.onload = () => {
      worker.postMessage({ fileBuffer: reader.result, existingSalesNos, masterData }, [reader.result])
    }
    reader.onerror = () => {
      reject(new Error('Could not read the file.'))
      cleanup()
    }
    reader.readAsArrayBuffer(file)
  })
}
