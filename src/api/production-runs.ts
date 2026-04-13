import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEYS = {
  all: ['production-runs'] as const,
  detail: (id: string) => ['production-runs', id] as const,
}

export function useRuns(statusFilter?: string) {
  return useQuery({
    queryKey: [...KEYS.all, { statusFilter }],
    queryFn: async () => {
      let q = supabase
        .from('production_runs')
        .select('*, steps:run_steps(id)')
        .order('started_at', { ascending: false })
      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_runs')
        .select(`
          *,
          materials:run_materials(*),
          steps:run_steps(
            *,
            inputs:run_step_inputs(*)
          )
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      // Sort
      data.materials?.sort((a, b) => a.sort_order - b.sort_order)
      data.steps?.sort((a, b) => a.sort_order - b.sort_order)
      data.steps?.forEach((s) => s.inputs?.sort((a, b) => a.sort_order - b.sort_order))
      return data
    },
  })
}

export function useCompleteStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { run_id: string; step_id: string; user_id: string; inputs: { id: string; value: string }[] }) => {
      const { data, error } = await supabase.rpc('complete_run_step', {
        p_run_id: args.run_id,
        p_step_id: args.step_id,
        p_user_id: args.user_id,
        p_inputs: args.inputs,
      })
      if (error) throw error
      return data as { step_id: string; status: string; run_completed: boolean; next_step_index: number }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.run_id) })
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: ['production-queue'] })
    },
  })
}

export function usePauseRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'paused' | 'in_progress' | 'cancelled' }) => {
      const { error } = await supabase.from('production_runs').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}
