import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRuns, useDeleteRun } from '../../api/production-runs'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { RUN_STATUS_COLORS, type RunStatus } from '../../types/constants'

const STATUS_TABS = ['all', 'in_progress', 'paused', 'completed', 'cancelled'] as const

export default function RunsListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { data: runs, isLoading } = useRuns(statusFilter)
  const deleteRun = useDeleteRun()

  if (isLoading) return <LoadingSpinner text="Loading runs..." />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Production Runs</h1>

      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
              statusFilter === tab ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab === 'all' ? 'All' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <DataTable
          keyExtractor={(r) => r.id}
          onRowClick={(r) => navigate((r.status === 'in_progress' || r.status === 'paused') ? `/runs/${r.id}/execute` : `/runs/${r.id}`)}
          emptyMessage="No runs found"
          data={runs ?? []}
          columns={[
            { key: 'formula_name', header: 'Formula', render: (r) => <span className="font-medium">{r.formula_name}</span> },
            { key: 'product_name', header: 'Product' },
            { key: 'batch_size', header: 'Batch', render: (r) => `${r.batch_size} ${r.base_batch_unit}` },
            { key: 'scale_factor', header: 'Scale', render: (r) => `${Number(r.scale_factor).toFixed(2)}x` },
            {
              key: 'progress',
              header: 'Progress',
              render: (r) => {
                const total = r.steps?.length ?? 0
                return `${Math.min(r.current_step_index, total)}/${total}`
              },
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge className={RUN_STATUS_COLORS[r.status as RunStatus] ?? 'bg-gray-100 text-gray-700'}>
                  {r.status.replace('_', ' ')}
                </Badge>
              ),
            },
            {
              key: 'started_at',
              header: 'Started',
              render: (r) => new Date(r.started_at).toLocaleString(),
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={(e) => {
                  e.stopPropagation()
                  deleteRun.mutate(r.id, {
                    onSuccess: () => toast('success', 'Run deleted'),
                    onError: (err) => toast('error', err.message),
                  })
                }}>
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
