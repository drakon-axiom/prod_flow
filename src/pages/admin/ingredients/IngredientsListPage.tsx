import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIngredients, useToggleIngredient, useDeleteIngredient, useBulkDeleteIngredients, useBulkUpdateIngredients } from '../../../api/ingredients'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable } from '../../../components/ui/DataTable'
import { Badge } from '../../../components/ui/Badge'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { PlusIcon } from '@heroicons/react/24/outline'
import { UNIT_OPTIONS } from '../../../types/constants'

export default function IngredientsListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const { data: ingredients, isLoading } = useIngredients(showInactive)
  const toggleMutation = useToggleIngredient()
  const deleteMutation = useDeleteIngredient()
  const bulkDeleteMutation = useBulkDeleteIngredients()
  const bulkUpdateMutation = useBulkUpdateIngredients()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkEditModal, setBulkEditModal] = useState(false)
  const [bulkEditField, setBulkEditField] = useState<string>('unit')
  const [bulkEditValue, setBulkEditValue] = useState('')

  const filtered = ingredients?.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const selectionCount = selectedIds.size

  function handleToggle(id: string, currentlyActive: boolean) {
    toggleMutation.mutate(
      { id, is_active: !currentlyActive },
      { onSuccess: () => toast('success', currentlyActive ? 'Ingredient deactivated' : 'Ingredient reactivated') },
    )
  }

  function handleDelete() {
    if (!confirmDelete) return
    deleteMutation.mutate(confirmDelete.id, {
      onSuccess: () => { toast('success', `Deleted ${confirmDelete.name}`); setConfirmDelete(null); selectedIds.delete(confirmDelete.id); setSelectedIds(new Set(selectedIds)) },
      onError: (err) => toast('error', err.message),
    })
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate([...selectedIds], {
      onSuccess: () => { toast('success', `Deleted ${selectionCount} ingredient(s)`); setSelectedIds(new Set()); setConfirmBulkDelete(false) },
      onError: (err) => { toast('error', err.message); setConfirmBulkDelete(false) },
    })
  }

  function handleBulkActivate(active: boolean) {
    bulkUpdateMutation.mutate(
      { ids: [...selectedIds], updates: { is_active: active } },
      {
        onSuccess: () => { toast('success', `${active ? 'Activated' : 'Deactivated'} ${selectionCount} ingredient(s)`); setSelectedIds(new Set()) },
        onError: (err) => toast('error', err.message),
      },
    )
  }

  function handleBulkEdit() {
    if (!bulkEditValue) { toast('error', 'Please enter a value'); return }
    const updates: Record<string, unknown> = {}
    if (bulkEditField === 'unit') updates.unit = bulkEditValue
    else if (bulkEditField === 'cost_per_unit') updates.cost_per_unit = Number(bulkEditValue)
    else if (bulkEditField === 'density') updates.density = Number(bulkEditValue)

    bulkUpdateMutation.mutate(
      { ids: [...selectedIds], updates },
      {
        onSuccess: () => { toast('success', `Updated ${selectionCount} ingredient(s)`); setSelectedIds(new Set()); setBulkEditModal(false); setBulkEditValue('') },
        onError: (err) => toast('error', err.message),
      },
    )
  }

  if (isLoading) return <LoadingSpinner text="Loading ingredients..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredients</h1>
          <p className="mt-1 text-sm text-gray-500">{filtered.length} ingredient{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/admin/ingredients/new')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Ingredient
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectionCount > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">{selectionCount} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={() => setBulkEditModal(true)}>
              Bulk Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkActivate(true)}>
              Activate All
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkActivate(false)}>
              Deactivate All
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmBulkDelete(true)}>
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <Card padding={false}>
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>
        </div>
        <DataTable
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/ingredients/${row.id}`)}
          emptyMessage="No ingredients found"
          data={filtered}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'sku', header: 'SKU', render: (r) => r.sku || '-' },
            { key: 'unit', header: 'Unit' },
            {
              key: 'cost_per_unit',
              header: 'Cost/Unit',
              render: (r) => r.cost_per_unit != null ? `$${Number(r.cost_per_unit).toFixed(4)}` : '-',
            },
            {
              key: 'is_active',
              header: 'Status',
              render: (r) => (
                <Badge className={r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                  {r.is_active ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggle(r.id, r.is_active) }}>
                    {r.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: r.id, name: r.name }) }}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Single Delete Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Ingredient">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to permanently delete <strong>{confirmDelete?.name}</strong>? This will fail if the ingredient is used in any formula.
        </p>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>Delete</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} title="Delete Selected Ingredients">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>{selectionCount} ingredient(s)</strong>? Ingredients used in formulas will be skipped.
        </p>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleBulkDelete} loading={bulkDeleteMutation.isPending}>Delete {selectionCount}</Button>
          <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* Bulk Edit Modal */}
      <Modal open={bulkEditModal} onClose={() => { setBulkEditModal(false); setBulkEditValue('') }} title={`Bulk Edit — ${selectionCount} ingredient(s)`}>
        <div className="space-y-4">
          <Select
            label="Field to update"
            value={bulkEditField}
            onChange={(e) => { setBulkEditField(e.target.value); setBulkEditValue('') }}
            options={[
              { value: 'unit', label: 'Unit' },
              { value: 'cost_per_unit', label: 'Cost per Unit' },
              { value: 'density', label: 'Density' },
            ]}
          />
          {bulkEditField === 'unit' ? (
            <Select
              label="New Unit"
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              placeholder="Select unit..."
              options={UNIT_OPTIONS as unknown as { value: string; label: string }[]}
            />
          ) : (
            <Input
              label={bulkEditField === 'cost_per_unit' ? 'New Cost per Unit ($)' : 'New Density'}
              type="number"
              step={bulkEditField === 'cost_per_unit' ? '0.0001' : '0.000001'}
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
            />
          )}
          <div className="flex gap-3">
            <Button onClick={handleBulkEdit} loading={bulkUpdateMutation.isPending} disabled={!bulkEditValue}>
              Update {selectionCount}
            </Button>
            <Button variant="secondary" onClick={() => { setBulkEditModal(false); setBulkEditValue('') }}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
