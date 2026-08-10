// Customers/Transporters are back in the sidebar (approved) -- Warehouses/Documents/Settings
// stay out of visible navigation; Settings is reached from the header user menu instead (see
// UserMenu.jsx), and Warehouses/Documents remain routed (App.jsx) but not linked in nav.
// Dashboard is a placeholder -- see pages/Dashboard.jsx -- not built yet.
export const navGroups = [
  {
    label: 'Operations',
    items: [
      { label: 'Transportation Log', path: '/', icon: 'truck', color: '#4F7CFF' },
      { label: 'Dashboard', path: '/dashboard', icon: 'grid', color: '#93A0AD' },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { label: 'Customers', path: '/customers', icon: 'users', color: '#7C5CFC' },
      { label: 'Transporters', path: '/transporters', icon: 'container', color: '#FF6A55' },
    ],
  },
]
