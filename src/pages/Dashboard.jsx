import { Icon } from '../components/ui/Icon'

// Placeholder only -- the sidebar nav item and route need to exist (approved mobile nav
// cleanup), but the Dashboard page itself is a separate, not-yet-scoped task. No data, no
// logic -- just a clearly "coming later" state.
export function Dashboard() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-alt">
        <Icon name="grid" className="h-5 w-5 text-text-muted" />
      </div>
      <p className="text-[14px] font-medium text-text-primary">Dashboard coming soon</p>
      <p className="text-[13px] text-text-muted">This page isn't built yet.</p>
    </div>
  )
}
