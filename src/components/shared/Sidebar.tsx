import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

interface NavItem {
  label: string
  path: string
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Inventory', path: '/admin/inventory' },
  { label: 'Distributor', path: '/admin/distributors' },
  { label: 'Dispatch', path: '/admin/dispatch' },
  { label: 'Claims', path: '/admin/claims' },
  { label: 'Orders', path: '/admin/orders' },
]

const distributorNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/distributor' },
  { label: 'Inventory', path: '/distributor/inventory' },
  { label: 'Orders', path: '/distributor/orders' },
  { label: 'Claims', path: '/distributor/claims' },
  { label: 'Sales', path: '/distributor/sales' },
]

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const navItems = isAdmin ? adminNavItems : distributorNavItems

  // --- UPDATED handleLogout to use window.location for clean redirect ---
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
  // --- END ---

  return (
    <div className="flex flex-col h-full w-full bg-white border-r border-gray-200">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <span className="text-2xl font-black text-[#E8400C]">Oh!G</span>
        <span className="text-xs text-gray-400 ml-2">IMS</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin' || item.path === '/distributor'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* --- UPDATED bottom section with user info + sign out --- */}
      <div className="px-3 py-4 border-t border-gray-100 flex flex-col gap-1">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-900 truncate">
            {profile?.email ?? '—'}
          </p>
          <p className="text-xs text-gray-400 capitalize">
            {profile?.role ?? '—'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-sm text-left text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
      {/* --- END --- */}

    </div>
  )
}