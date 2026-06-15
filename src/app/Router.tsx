// src/app/Router.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import Login from './login'
import AdminDashboard from './admin/Dashboard'
import AdminInventory from './admin/Inventory'
import AdminDistributors from './admin/Distributors'
import AdminDispatch from './admin/Dispatch'
import AdminOrders from './admin/Orders'
import AdminClaims from './admin/Claims'
import DistributorDashboard from './distributor/Dashboard'
import DistributorInventory from './distributor/Inventory'
import DistributorOrders from './distributor/Orders'
import DistributorOrderDetails from './distributor/OrderDetails'
import CreateOrder from './distributor/CreateOrder'
import DistributorClaims from './distributor/DistributorClaims'
import DistributorSales from './distributor/Sales'
import AdminOffers from './admin/offers'

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
        <Route path="/admin/orders" element={
           <ProtectedRoute requiredRole="admin">
           <AdminOrders />
           </ProtectedRoute>
        } />
        <Route path="/admin/claims" element={
          <ProtectedRoute requiredRole="admin">
            <AdminClaims />
          </ProtectedRoute>
        } />

        <Route path="/admin/offers" element={
          <ProtectedRoute requiredRole="admin">
            <AdminOffers />
          </ProtectedRoute>
        } />

        {/* Distributor routes */}
        <Route path="/distributor" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/distributor/inventory" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorInventory />
          </ProtectedRoute>
        } />
        {/* /distributor/orders/create must be before /distributor/orders/:poNo
            so React Router doesn't treat 'create' as a poNo param */}
        <Route path="/distributor/orders/create" element={
          <ProtectedRoute requiredRole="distributor">
            <CreateOrder />
          </ProtectedRoute>
        } />
        <Route path="/distributor/orders" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorOrders />
          </ProtectedRoute>
        } />
        <Route path="/distributor/orders/:poNo" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorOrderDetails />
          </ProtectedRoute>
        } />
        <Route path="/distributor/claims" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorClaims />
          </ProtectedRoute>
        } />
        <Route path="/distributor/sales" element={
          <ProtectedRoute requiredRole="distributor">
            <DistributorSales />
          </ProtectedRoute>
        } />

      </Routes>
    </BrowserRouter>
  )
}