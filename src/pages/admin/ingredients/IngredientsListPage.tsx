import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIngredients, useToggleIngredient } from '../../../api/ingredients'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable } from '../../../components/ui/DataTable'
import { Badge } from '../../../components/ui/Badge'
import { Input } from '../../../components/ui/Input'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { PlusIcon } from '@heroicons/react/24/outline'

export default function IngredientsListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const { data: ingredients, isLoading } = useIngredients(showInactive)
  const toggleMutation = useToggleIngredient()

  const filtered = ingredients?.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  function handleToggle(id: string, currentlyActive: boolean) {
    toggleMutation.mutate(
      { id, is_active: !currentlyActive },
      { onSuccess: () => toast('success', currentlyActive ? 'Ingredient deactivated' : 'Ingredient reactivated') },
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleToggle(r.id, r.is_active) }}
                >
                  {r.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
