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
import { WhatsappUpdate } from './pages/WhatsappUpdate'
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
              </Route>
              <Route path="/warehouse/scan" element={<WarehouseScan />} />
              <Route path="/whatsapp/:token" element={<WhatsappUpdate />} />
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
