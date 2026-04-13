import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [runsRes, queueRes, completedRes, recentRes] = await Promise.all([
        supabase.from('production_runs').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('production_queue').select('id', { count: 'exact', head: true }).in('status', ['queued', 'ready']),
        supabase.from('production_runs').select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('completed_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('production_runs')
          .select('id, formula_name, product_name, status, started_at, completed_at, batch_size, base_batch_unit')
          .order('started_at', { ascending: false })
          .limit(5),
      ])

      return {
        activeRuns: runsRes.count ?? 0,
        queuedItems: queueRes.count ?? 0,
        completedToday: completedRes.count ?? 0,
        recentRuns: recentRes.data ?? [],
      }
    },
    refetchInterval: 30000,
  })
}
