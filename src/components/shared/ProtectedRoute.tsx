import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'distributor'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
   const { session, role, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  // Not logged in → go to login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Wrong role → redirect to their own dashboard
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/distributor'} replace />
  }

  return <>{children}</>
}