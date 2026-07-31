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
          <div className="flex h-screen flex-col bg-surface">
            <TopBar onMenuClick={() => setMobileNavOpen(true)} />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
              <main className="flex flex-1 flex-col overflow-hidden bg-white">
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
