import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import type { TablesInsert } from '../types'

const KEYS = queryKeys.queue

export function useQueue(statusFilter?: string) {
  return useQuery({
    queryKey: [...KEYS.all, { statusFilter }],
    queryFn: async () => {
      let q = supabase
        .from('production_queue')
        .select(`
          *,
          formula:formulas(name, product_name),
          version:formula_versions(version_number, base_batch_size, base_batch_unit)
        `)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useCreateQueueItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: TablesInsert<'production_queue'>) => {
      const { data, error } = await supabase.from('production_queue').insert(item).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useDeleteQueueItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Null out queue_item_id on any runs referencing this queue item (runs are snapshots)
      await supabase.from('production_runs').update({ queue_item_id: null }).eq('queue_item_id', id)
      const { error } = await supabase.from('production_queue').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: queryKeys.runs.all })
    },
  })
}

export function useUpdateQueueItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; priority?: number }) => {
      const { error } = await supabase.from('production_queue').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}
