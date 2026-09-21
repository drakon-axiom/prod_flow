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

  if (!profile?.is_active) {
    return <div className="p-8"><h1 className="text-xl font-semibold">Staff access is unavailable</h1>
      <p className="mt-2">Ask an administrator to confirm that your staff account is active.</p></div>
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
