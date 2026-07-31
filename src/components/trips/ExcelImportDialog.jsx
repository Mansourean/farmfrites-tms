import { Icon } from '../ui/Icon'
import { formatDate } from '../../utils/format'

const PREVIEW_LIMIT = 100

function StatChip({ label, value, color }) {
  return (
    <div className="min-w-[calc(50%-0.25rem)] flex-1 rounded-lg border border-border px-3 py-2.5 sm:min-w-0">
      <p className="text-[20px] font-semibold tabular-nums" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </p>
      <p className="text-[11.5px] text-text-muted">{label}</p>
    </div>
  )
}

function RowStatusBadge({ kind }) {
  const config = {
    valid: { label: 'Valid', color: '#0F6B32', bg: '#DAF3E3' },
    invalid: { label: 'Invalid', color: '#B42318', bg: '#FBE7E5' },
    duplicate: { label: 'Duplicate', color: '#8A4B00', bg: '#FBE7C2' },
  }[kind]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}

function PreviewTable({ result }) {
  const rows = [
    ...result.invalidRows.map((r) => ({ ...r, kind: 'invalid' })),
    ...result.duplicateRows.map((r) => ({ ...r, kind: 'duplicate' })),
    ...result.validRows.map((r) => ({ ...r, kind: 'valid' })),
  ]
  const shown = rows.slice(0, PREVIEW_LIMIT)

  return (
    <div className="rounded-lg border border-border">
      <div className="max-h-[280px] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
          <thead className="sticky top-0 bg-surface-alt text-text-secondary">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Row</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Sales No</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Customer / Warehouse</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Destination</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Dispatch Date</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Status</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={`${row.kind}-${row.rowNumber}`} className="border-b border-border/60 last:border-b-0">
                <td className="px-3 py-2 text-text-muted">{row.rowNumber}</td>
                <td className="px-3 py-2 font-medium text-text-primary">{row.data.salesNo || '—'}</td>
                <td className="max-w-[160px] truncate px-3 py-2 text-text-secondary">
                  {row.data.tripType === 'internal' ? row.data.sourceWarehouseRaw : row.data.customerRaw || '—'}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 text-text-secondary">{row.data.destination || '—'}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {row.data.dispatchDate ? formatDate(row.data.dispatchDate) : row.data.dispatchDateRaw || '—'}
                </td>
                <td className="px-3 py-2">
                  <RowStatusBadge kind={row.kind} />
                </td>
                <td className="max-w-[220px] px-3 py-2 text-text-muted">
                  {row.kind === 'invalid' && row.errors.join('; ')}
                  {row.kind === 'duplicate' && 'Sales No already exists'}
                  {row.kind === 'valid' && '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PREVIEW_LIMIT && (
        <p className="border-t border-border px-3 py-2 text-[11.5px] text-text-muted">
          Showing {PREVIEW_LIMIT} of {rows.length} rows — every row will still be processed on import.
        </p>
      )}
    </div>
  )
}

const stageMeta = {
  preview: { title: 'Import Preview', icon: 'download' },
  importing: { title: 'Importing…', icon: 'download' },
  success: { title: 'Import Complete', icon: 'check' },
}

export function ExcelImportDialog({ stage, fileName, result, summary, progress, onCancel, onConfirm, onClose }) {
  const dismissible = stage === 'preview' ? onCancel : stage === 'success' ? onClose : null
  const meta = stageMeta[stage]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={dismissible ?? undefined} />
      <div className="relative flex max-h-[85vh] w-full max-w-[640px] flex-col rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EAF0FF] text-[#4F7CFF]">
              <Icon name={meta.icon} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-text-primary">{meta.title}</p>
              {fileName && <p className="truncate text-[12px] text-text-muted">{fileName}</p>}
            </div>
          </div>
          {dismissible && (
            <button type="button" onClick={dismissible} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stage === 'preview' && result && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <StatChip label="Total Rows" value={result.totalRows} />
                <StatChip label="Valid" value={result.validRows.length} color="#0F6B32" />
                <StatChip label="Duplicates" value={result.duplicateRows.length} color="#8A4B00" />
                <StatChip label="Invalid" value={result.invalidRows.length} color="#B42318" />
              </div>
              {result.skippedEmpty > 0 && (
                <p className="text-[12.5px] text-text-muted">
                  {result.skippedEmpty} completely empty row{result.skippedEmpty === 1 ? '' : 's'} will be skipped
                  automatically.
                </p>
              )}
              <PreviewTable result={result} />
            </div>
          )}

          {stage === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-1.5 w-full max-w-[360px] overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full rounded-full bg-brand-500 transition-[width] duration-150 ease-out"
                  style={{
                    width: progress && progress.total > 0 ? `${Math.round((progress.processed / progress.total) * 100)}%` : '10%',
                  }}
                />
              </div>
              <p className="text-[13px] text-text-secondary">
                {progress ? `Importing ${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} trips…` : 'Starting import…'}
              </p>
            </div>
          )}

          {stage === 'success' && summary && (
            <div className="grid grid-cols-2 gap-3">
              <StatChip label="Imported" value={summary.imported} color="#0F6B32" />
              <StatChip label="Skipped (empty)" value={summary.skippedEmpty} />
              <StatChip label="Duplicates" value={summary.duplicates} color="#8A4B00" />
              <StatChip label="Errors" value={summary.errors} color="#B42318" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {stage === 'preview' && (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={result.validRows.length === 0}
                className="flex items-center gap-1.5 rounded-md bg-text-primary px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                Import {result.validRows.length} Trip{result.validRows.length === 1 ? '' : 's'}
              </button>
            </>
          )}
          {stage === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-text-primary px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#333331]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
