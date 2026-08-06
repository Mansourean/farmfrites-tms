export const ROLES = {
  ADMIN: 'admin',
  DISPATCHER: 'dispatcher',
  WAREHOUSE: 'warehouse',
  VIEWER: 'viewer',
}

export const ROLE_OPTIONS = [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE, ROLES.VIEWER]

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.DISPATCHER]: 'Dispatcher',
  [ROLES.WAREHOUSE]: 'Warehouse',
  [ROLES.VIEWER]: 'Viewer',
}

// Single source of truth for page access — both the sidebar and RoleGuard read from this,
// so permissions can never drift between "what's shown" and "what's actually reachable".
export const ROLE_PAGE_ACCESS = {
  [ROLES.ADMIN]: ['/', '/customers', '/transporters', '/warehouses', '/documents', '/settings'],
  [ROLES.DISPATCHER]: ['/', '/customers', '/transporters'],
  [ROLES.WAREHOUSE]: ['/warehouses'],
  [ROLES.VIEWER]: ['/', '/customers', '/transporters', '/warehouses', '/documents'],
}

export function canAccessPath(role, path) {
  return (ROLE_PAGE_ACCESS[role] ?? []).includes(path)
}

export function getDefaultRoute(role) {
  return ROLE_PAGE_ACCESS[role]?.[0] ?? '/login'
}

// Viewer is read-only: creation/import actions stay hidden even on pages it can see.
export function canEdit(role) {
  return role === ROLES.ADMIN || role === ROLES.DISPATCHER || role === ROLES.WAREHOUSE
}

// Narrower than canEdit() on purpose: matches trips_insert/trips_update's existing role
// restriction (0004) and the create_customer/create_transporter/create_warehouse RPCs'
// own server-side check (0009) exactly -- warehouse can edit trip data via canEdit() but,
// like viewer, cannot create master-data records.
export function canManageMasterData(role) {
  return role === ROLES.ADMIN || role === ROLES.DISPATCHER
}

export function isAdmin(role) {
  return role === ROLES.ADMIN
}
