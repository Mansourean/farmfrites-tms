import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { TopBar } from '../components/layout/Topbar'
import { TripPanelProvider } from '../context/TripPanelContext'
import { WhatsappModalProvider } from '../context/WhatsappModalContext'
import { DeleteTripProvider } from '../context/DeleteTripContext'
import { TripPanel } from '../components/trips/TripPanel'
import { WhatsappModal } from '../components/trips/WhatsappModal'
import { DeleteTripDialog } from '../components/trips/DeleteTripDialog'

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <TripPanelProvider>
      <WhatsappModalProvider>
        <DeleteTripProvider>
          <div className="flex h-screen bg-surface">
            <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopBar onMenuClick={() => setMobileNavOpen(true)} />
              <main className="flex flex-1 flex-col overflow-hidden bg-surface-canvas">
                <Outlet />
              </main>
            </div>
          </div>
          <TripPanel />
          <WhatsappModal />
          <DeleteTripDialog />
        </DeleteTripProvider>
      </WhatsappModalProvider>
    </TripPanelProvider>
  )
}
