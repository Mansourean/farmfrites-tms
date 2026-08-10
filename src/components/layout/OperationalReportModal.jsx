import { Icon } from '../ui/Icon'

// UI-only placeholder for the approved Header "Operational Report" button -- opens/closes,
// nothing else. Report generation is a separate, not-yet-scoped task. Styled to match the
// existing modal pattern (see AddMasterDataModal).
export function OperationalReportModal({ open, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-[14px] font-semibold text-text-primary">Operational Report</p>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-alt">
            <Icon name="fileText" className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-[13.5px] font-medium text-text-primary">Report generation coming soon</p>
          <p className="text-[12.5px] text-text-muted">This isn't built yet.</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
