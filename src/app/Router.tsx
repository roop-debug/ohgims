import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from '../components/shared/ProtectedRoute'

// Pages (we'll create these next)
import Login from './login'
import AdminDashboard from './admin/Dashboard'
import DistributorDashboard from './distributor/Dashboard'

function RootRedirect() {
  const { role, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>

  if (role === 'admin') return <Navigate to="/admin" replace />
  if (role === 'distributor') return <Navigate to="/distributor" replace />
  return <Navigate to="/login" replace />
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root → redirect based on role */}
        <Route path="/" element={<RootRedirect />} />

        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Admin routes */}
        <Route path="/admin/*" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Distributor routes */}
        <Route path="/distributor/*" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}