import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { TripsProvider } from './context/TripsContext'
import { ToastProvider } from './context/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RoleGuard } from './components/auth/RoleGuard'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { TransportationLog } from './pages/TransportationLog'
import { Customers } from './pages/Customers'
import { Transporters } from './pages/Transporters'
import { Warehouses } from './pages/Warehouses'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'
import { WarehouseScan } from './pages/WarehouseScan'
import { DriverAssignment } from './pages/DriverAssignment'
import { PrintTrip } from './pages/PrintTrip'
import { NotFound } from './pages/NotFound'

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <TripsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route element={<RoleGuard />}>
                    <Route path="/" element={<TransportationLog />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/transporters" element={<Transporters />} />
                    <Route path="/warehouses" element={<Warehouses />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>
                {/* Outside AppLayout/RoleGuard (its own full-screen kiosk-style UI, not in
                    any role's ROLE_PAGE_ACCESS list), but still requires a real authenticated
                    active user -- see the Phase 3 report on why this moved under
                    ProtectedRoute (the mark_trip_loaded/reject_trip_load RPCs and even
                    reading trips both require an authenticated session under RLS). */}
                <Route path="/warehouse/scan" element={<WarehouseScan />} />
              </Route>
              <Route path="/assign/:token" element={<DriverAssignment />} />
              <Route path="/print/trip/:id" element={<PrintTrip />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <ToastContainer />
        </TripsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
