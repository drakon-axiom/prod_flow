import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueue, useCreateQueueItem, useUpdateQueueItem } from '../../api/production-queue'
import { useFormulas } from '../../api/formulas'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { PlusIcon, PlayIcon } from '@heroicons/react/24/outline'
import { QUEUE_STATUS_COLORS, type QueueStatus } from '../../types/constants'
import { supabase } from '../../lib/supabase'

const STATUS_TABS = ['all', 'queued', 'ready', 'in_progress', 'completed', 'cancelled'] as const

export default function QueuePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [addModalOpen, setAddModalOpen] = useState(false)

  const { data: queue, isLoading } = useQueue(statusFilter)
  const { data: formulas } = useFormulas()
  const createItem = useCreateQueueItem()
  const updateItem = useUpdateQueueItem()

  const [form, setForm] = useState({ formula_id: '', batch_size: '', priority: '0', due_date: '', notes: '' })

  const selectedFormula = formulas?.find((f) => f.id === form.formula_id)
  const currentVersion = selectedFormula
    ? (Array.isArray(selectedFormula.current_version) ? selectedFormula.current_version[0] : selectedFormula.current_version)
    : null

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!form.formula_id || !form.batch_size) {
      toast('error', 'Please select a formula and enter a batch size')
      return
    }
    // Resolve version — handle both object and array shapes from Supabase join
    const ver = currentVersion as { id: string; base_batch_unit: string } | null
    if (!ver || !user) {
      toast('error', 'Could not resolve formula version')
      return
    }
    createItem.mutate(
      {
        formula_id: form.formula_id,
        formula_version_id: ver.id,
        batch_size: Number(form.batch_size),
        batch_unit: ver.base_batch_unit,
        priority: Number(form.priority),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        notes: form.notes || null,
        requested_by: user.id,
      },
      {
        onSuccess: () => { toast('success', 'Added to queue'); setAddModalOpen(false); setForm({ formula_id: '', batch_size: '', priority: '0', due_date: '', notes: '' }) },
        onError: (err) => toast('error', err.message),
      },
    )
  }

  async function handleStartRun(queueItemId: string) {
    if (!user) return
    try {
      const { data, error } = await supabase.rpc('start_production_run', {
        p_queue_item_id: queueItemId,
        p_user_id: user.id,
      })
      if (error) throw error
      toast('success', 'Run started')
      navigate(`/runs/${data}/execute`)
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Failed to start run')
    }
  }

  if (isLoading) return <LoadingSpinner text="Loading queue..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Production Queue</h1>
        <Button onClick={() => setAddModalOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add to Queue
        </Button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
              statusFilter === tab
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab === 'all' ? 'All' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <DataTable
          keyExtractor={(r) => r.id}
          emptyMessage="Queue is empty"
          data={queue ?? []}
          columns={[
            {
              key: 'formula',
              header: 'Formula',
              render: (r) => {
                const f = Array.isArray(r.formula) ? r.formula[0] : r.formula
                return <span className="font-medium">{f?.name ?? '-'}</span>
              },
            },
            { key: 'batch_size', header: 'Batch', render: (r) => `${r.batch_size} ${r.batch_unit}` },
            { key: 'priority', header: 'Priority' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge className={QUEUE_STATUS_COLORS[r.status as QueueStatus] ?? 'bg-gray-100 text-gray-700'}>
                  {r.status.replace('_', ' ')}
                </Badge>
              ),
            },
            {
              key: 'due_date',
              header: 'Due',
              render: (r) => r.due_date ? new Date(r.due_date).toLocaleDateString() : '-',
            },
            {
              key: 'actions',
              header: '',
              render: (r) =>
                (r.status === 'queued' || r.status === 'ready') ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleStartRun(r.id) }}>
                      <PlayIcon className="h-3.5 w-3.5 mr-1" />
                      Start
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation()
                      updateItem.mutate({ id: r.id, status: 'cancelled' }, { onSuccess: () => toast('success', 'Cancelled') })
                    }}>
                      Cancel
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      {/* Add to Queue Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add to Queue">
        <form onSubmit={handleAdd} className="space-y-4">
          <Select
            label="Formula"
            value={form.formula_id}
            onChange={(e) => setForm((f) => ({ ...f, formula_id: e.target.value }))}
            placeholder="Select formula..."
            options={(formulas ?? []).map((f) => ({ value: f.id, label: `${f.name} (${f.product_name})` }))}
          />
          {currentVersion && (
            <p className="text-xs text-gray-500">
              v{currentVersion.version_number} — base batch {currentVersion.base_batch_size} {currentVersion.base_batch_unit}
            </p>
          )}
          <Input label="Batch Size" type="number" step="0.0001" value={form.batch_size} onChange={(e) => setForm((f) => ({ ...f, batch_size: e.target.value }))} required />
          <Input label="Priority (higher = first)" type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
          <Input label="Due Date" type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createItem.isPending}>Add to Queue</Button>
            <Button type="button" variant="secondary" onClick={() => setAddModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
