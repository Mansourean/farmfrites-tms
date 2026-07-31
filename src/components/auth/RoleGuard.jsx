import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canAccessPath, getDefaultRoute } from '../../data/roles'

// Sits inside ProtectedRoute, so a currentUser is guaranteed here. Redirects to the
// role's own default page if the current path isn't in its permission list — this is the
// same check the Sidebar uses to decide what to render, so nothing shown is ever
// unreachable and nothing reachable is ever hidden.
export function RoleGuard() {
  const { currentUser } = useAuth()
  const location = useLocation()

  if (!canAccessPath(currentUser.role, location.pathname)) {
    return <Navigate to={getDefaultRoute(currentUser.role)} replace />
  }

  return <Outlet />
}
