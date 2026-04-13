import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from '../types/constants'

export function useRequireRole(requiredRole: Role) {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && profile?.role !== requiredRole) {
      navigate('/', { replace: true })
    }
  }, [loading, profile, requiredRole, navigate])

  return { authorized: !loading && profile?.role === requiredRole }
}
