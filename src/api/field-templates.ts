import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import type { TablesInsert, TablesUpdate } from '../types'

const KEYS = queryKeys.fieldTemplates

export function useFieldTemplates(showInactive = false) {
  return useQuery({
    queryKey: [...KEYS.all, { showInactive }],
    queryFn: async () => {
      let q = supabase.from('step_field_templates').select('*').order('name')
      if (!showInactive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useCreateFieldTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (template: TablesInsert<'step_field_templates'>) => {
      const { data, error } = await supabase
        .from('step_field_templates')
        .insert(template)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateFieldTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'step_field_templates'> & { id: string }) => {
      const { data, error } = await supabase
        .from('step_field_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useDeleteFieldTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Null out template_id on formula_step_fields that reference this template
      // (the fields keep their own label/type/options, template_id is just a reference)
      await supabase.from('formula_step_fields').update({ template_id: null }).eq('template_id', id)
      const { error } = await supabase.from('step_field_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useToggleFieldTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('step_field_templates')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}
