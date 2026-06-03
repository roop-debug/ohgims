import { useState } from 'react'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-52 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`fixed top-0 left-0 h-full w-52 z-30 md:hidden transition-transform duration-200 ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar — mobile and desktop */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          {/* Left — hamburger on mobile */}
          <div className="flex items-center gap-3">
           <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-gray-600 text-xl"
           >
               ☰
           </button>
           <span className="md:hidden text-lg font-black text-[#E8400C]">Oh!G</span>
          </div>

          {/* Right — notification bell */}
          <NotificationBell />
         </div>
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

      </div>
    </div>
  )
}