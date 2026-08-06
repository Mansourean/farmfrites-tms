import { useRef, useState } from 'react'
import { useTrips } from '../../context/TripsContext'
import { useToast } from '../../context/ToastContext'
import { parseExcelFile } from '../../utils/excelImporter'
import { Icon } from '../ui/Icon'
import { ExcelImportDialog } from './ExcelImportDialog'

export function ImportExcelButton() {
  const { importTrips, getSalesNumbers, customers, transporters, warehouses } = useTrips()
  const { notify } = useToast()
  const inputRef = useRef(null)

  const [stage, setStage] = useState(null) // null | 'preview' | 'importing' | 'success'
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [summary, setSummary] = useState(null)
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setStage(null)
    setFileName('')
    setResult(null)
    setSummary(null)
    setProgress(null)
    setBusy(false)
  }

  const handlePick = () => inputRef.current?.click()

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBusy(true)
    notify('Import started…', { type: 'info' })

    try {
      const parsed = await parseExcelFile(file, {
        existingSalesNos: getSalesNumbers(),
        masterData: { customers, transporters, warehouses },
      })
      setFileName(file.name)
      setResult(parsed)
      setStage('preview')
      notify('Import successful.', { type: 'success' })
    } catch (err) {
      notify(err.message || 'Could not read this file.', { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    if (!result) return
    setStage('importing')
    setProgress({ processed: 0, total: result.validRows.length })

    const created = await importTrips(
      result.validRows.map((row) => row.data),
      { onProgress: setProgress },
    )

    setSummary({
      imported: created.length,
      skippedEmpty: result.skippedEmpty,
      duplicates: result.duplicateRows.length,
      errors: result.invalidRows.length,
    })
    setStage('success')
    notify('Import completed.', { type: 'success' })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 md:px-3"
      >
        <Icon name="download" className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{busy ? 'Reading…' : 'Import Excel'}</span>
      </button>

      {stage && (
        <ExcelImportDialog
          stage={stage}
          fileName={fileName}
          result={result}
          summary={summary}
          progress={progress}
          onCancel={reset}
          onClose={reset}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
