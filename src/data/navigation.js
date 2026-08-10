// Dashboard removed (was a placeholder with no operational value -- see git history for
// pages/Dashboard.jsx before its removal; may come back once there's real data/purpose for it).
// Documents remains routed (App.jsx) but not linked in nav. Settings now lives here instead of
// the header UserMenu (approved) -- gated the same way as every other item, so it only shows
// for roles with '/settings' in ROLE_PAGE_ACCESS (currently admin only).
export const navGroups = [
  {
    label: 'Operations',
    items: [
      { label: 'Transportation Log', path: '/', icon: 'truck', color: '#4F7CFF' },
      { label: 'Warehouse', path: '/warehouses', icon: 'warehouse', color: '#34B27B' },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { label: 'Clients', path: '/customers', icon: 'users', color: '#7C5CFC' },
      { label: 'Transporters', path: '/transporters', icon: 'container', color: '#FF6A55' },
    ],
  },
  {
    label: 'Admin',
    items: [{ label: 'Settings', path: '/settings', icon: 'settings', color: '#93A0AD' }],
  },
]
