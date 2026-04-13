import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'

const KEYS = queryKeys.users

async function invokeUserFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('create-user', { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export function useUsers() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; password: string; name: string; role: string }) =>
      invokeUserFn({ action: 'create', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { user_id: string; name?: string; role?: string; is_active?: boolean; email?: string }) =>
      invokeUserFn({ action: 'update', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useSetPassword() {
  return useMutation({
    mutationFn: (input: { user_id: string; password: string }) =>
      invokeUserFn({ action: 'set_password', ...input }),
  })
}

export function useSendResetEmail() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      invokeUserFn({ action: 'send_reset_email', ...input }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { user_id: string }) =>
      invokeUserFn({ action: 'delete', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}
