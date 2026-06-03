import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import Login from './login'
import AdminDashboard from './admin/Dashboard'
import AdminInventory from './admin/Inventory'
import AdminDistributors from './admin/Distributors'
import AdminDispatch from './admin/Dispatch'
import AdminClaims from './admin/Claims'
import AdminOrders from './admin/Orders'
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
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/inventory" element={
          <ProtectedRoute requiredRole="admin">
            <AdminInventory />
          </ProtectedRoute>
        } />
        <Route path="/admin/distributors" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDistributors />
          </ProtectedRoute>
        } />
        <Route path="/admin/dispatch" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDispatch />
          </ProtectedRoute>
        } />
        <Route path="/admin/claims" element={
          <ProtectedRoute requiredRole="admin">
            <AdminClaims />
          </ProtectedRoute>
        } />
        <Route path="/admin/orders" element={
          <ProtectedRoute requiredRole="admin">
            <AdminOrders />
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