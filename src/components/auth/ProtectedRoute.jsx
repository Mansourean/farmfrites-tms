import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Gates every route nested under it behind a logged-in session. Unauthenticated visitors
// are bounced to /login, remembering where they were headed so LoginPage can send them
// back after a successful sign-in.
export function ProtectedRoute() {
  const { currentUser } = useAuth()
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
