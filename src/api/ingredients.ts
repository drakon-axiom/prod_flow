import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import type { TablesInsert, TablesUpdate } from '../types'

const KEYS = queryKeys.ingredients

export function useIngredients(showInactive = false) {
  return useQuery({
    queryKey: [...KEYS.all, { showInactive }],
    queryFn: async () => {
      let q = supabase.from('ingredients').select('*').order('name')
      if (!showInactive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useIngredient(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useCreateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ingredient: TablesInsert<'ingredients'>) => {
      const { data, error } = await supabase
        .from('ingredients')
        .insert(ingredient)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'ingredients'> & { id: string }) => {
      const { data, error } = await supabase
        .from('ingredients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(data.id) })
    },
  })
}

export function useDeleteIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ingredients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useToggleIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ingredients')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}
