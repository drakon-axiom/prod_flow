import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useIngredient, useCreateIngredient, useUpdateIngredient } from '../../../api/ingredients'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Card } from '../../../components/ui/Card'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { UNIT_OPTIONS } from '../../../types/constants'

export default function IngredientFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: existing, isLoading } = useIngredient(id)
  const createMutation = useCreateIngredient()
  const updateMutation = useUpdateIngredient()

  const [form, setForm] = useState({
    name: '',
    sku: '',
    unit: 'g',
    density: '',
    cost_per_unit: '',
    notes: '',
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        sku: existing.sku ?? '',
        unit: existing.unit,
        density: existing.density != null ? String(existing.density) : '',
        cost_per_unit: existing.cost_per_unit != null ? String(existing.cost_per_unit) : '',
        notes: existing.notes ?? '',
      })
    }
  }, [existing])

  if (isEdit && isLoading) return <LoadingSpinner text="Loading ingredient..." />

  const saving = createMutation.isPending || updateMutation.isPending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      sku: form.sku || null,
      unit: form.unit,
      density: form.density ? Number(form.density) : null,
      cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : null,
      notes: form.notes || null,
    }

    if (isEdit) {
      updateMutation.mutate(
        { id: id!, ...payload },
        {
          onSuccess: () => {
            toast('success', 'Ingredient updated')
            navigate('/admin/ingredients')
          },
          onError: (err) => toast('error', err.message),
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast('success', 'Ingredient created')
          navigate('/admin/ingredients')
        },
        onError: (err) => toast('error', err.message),
      })
    }
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Edit Ingredient' : 'New Ingredient'}
      </h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" value={form.sku} onChange={(e) => update('sku', e.target.value)} placeholder="Optional" />
            <Select label="Unit" value={form.unit} onChange={(e) => update('unit', e.target.value)} options={UNIT_OPTIONS as unknown as { value: string; label: string }[]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Density" type="number" step="0.000001" value={form.density} onChange={(e) => update('density', e.target.value)} placeholder="Optional" />
            <Input label="Cost per Unit ($)" type="number" step="0.0001" value={form.cost_per_unit} onChange={(e) => update('cost_per_unit', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save Changes' : 'Create Ingredient'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/ingredients')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
