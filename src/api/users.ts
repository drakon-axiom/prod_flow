import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'

const KEYS = queryKeys.users

async function invokeUserFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('create-user', { body })
  if (error) {
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        const detail = await error.context.json()
        if (typeof detail?.error === 'string') message = detail.error
      } catch { /* Keep the original error if no JSON response is available. */ }
    }
    throw new Error(message)
  }
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
    mutationFn: async (input: { user_id: string; name?: string; role?: string; is_active?: boolean }) => {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_user_id: input.user_id,
        p_name: input.name,
        p_role: input.role,
        p_is_active: input.is_active,
      })
      if (error) throw error
    },
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
