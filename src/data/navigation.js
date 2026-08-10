// Mobile nav cleanup (approved): the sidebar now only surfaces the two pages actually in use.
// Customers/Transporters/Warehouses/Documents/Settings are unchanged as pages/routes/RPCs --
// this only removes them from visible navigation (see App.jsx, which still routes to all of
// them directly). Dashboard is a placeholder -- see pages/Dashboard.jsx -- not built yet.
export const navGroups = [
  {
    label: 'Operations',
    items: [
      { label: 'Transportation Log', path: '/', icon: 'truck', color: '#4F7CFF' },
      { label: 'Dashboard', path: '/dashboard', icon: 'grid', color: '#93A0AD' },
    ],
  },
]
