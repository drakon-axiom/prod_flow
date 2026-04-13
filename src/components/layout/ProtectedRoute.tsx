import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { Role } from '../../types/constants'

interface ProtectedRouteProps {
  requiredRole?: Role
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner text="Loading..." className="h-screen" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
