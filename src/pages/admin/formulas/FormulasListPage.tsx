import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormulas, useDeleteFormula } from '../../../api/formulas'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable } from '../../../components/ui/DataTable'
import { Modal } from '../../../components/ui/Modal'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { PlusIcon } from '@heroicons/react/24/outline'

export default function FormulasListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: formulas, isLoading } = useFormulas()
  const deleteMutation = useDeleteFormula()
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  function handleDelete() {
    if (!confirmDelete) return
    deleteMutation.mutate(confirmDelete.id, {
      onSuccess: () => { toast('success', `Deleted ${confirmDelete.name}`); setConfirmDelete(null) },
      onError: (err) => toast('error', err.message),
    })
  }

  if (isLoading) return <LoadingSpinner text="Loading formulas..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formulas</h1>
          <p className="mt-1 text-sm text-gray-500">{formulas?.length ?? 0} formula{(formulas?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/admin/formulas/new')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Formula
        </Button>
      </div>

      <Card padding={false}>
        <DataTable
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/formulas/${row.id}`)}
          emptyMessage="No formulas yet"
          data={formulas ?? []}
          columns={[
            { key: 'name', header: 'Formula Name' },
            { key: 'product_name', header: 'Product' },
            {
              key: 'version',
              header: 'Version',
              render: (r) => {
                const cv = Array.isArray(r.current_version) ? r.current_version[0] : r.current_version
                return cv ? `v${cv.version_number}` : '-'
              },
            },
            {
              key: 'batch',
              header: 'Base Batch',
              render: (r) => {
                const cv = Array.isArray(r.current_version) ? r.current_version[0] : r.current_version
                return cv ? `${cv.base_batch_size} ${cv.base_batch_unit}` : '-'
              },
            },
            {
              key: 'created_at',
              header: 'Created',
              render: (r) => new Date(r.created_at).toLocaleDateString(),
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: r.id, name: r.name }) }}>
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Formula">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to permanently delete <strong>{confirmDelete?.name}</strong> and all its versions? This will fail if the formula has active queue items or runs.
        </p>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>Delete</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  )
}
