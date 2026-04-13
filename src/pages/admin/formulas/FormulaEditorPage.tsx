import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFormula, useCreateFormula, useCreateFormulaVersion } from '../../../api/formulas'
import { useIngredients } from '../../../api/ingredients'
import { useFieldTemplates } from '../../../api/field-templates'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Card } from '../../../components/ui/Card'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { IngredientRow } from '../../../components/formulas/IngredientRow'
import { StepCard } from '../../../components/formulas/StepCard'
import { PlusIcon } from '@heroicons/react/24/outline'

const BATCH_UNITS = [
  { value: 'g', label: 'Grams' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'ml', label: 'Milliliters' },
  { value: 'L', label: 'Liters' },
  { value: 'oz', label: 'Ounces' },
  { value: 'lb', label: 'Pounds' },
]

interface IngredientInput {
  ingredient_id: string
  quantity: string
  notes: string
}

interface StepFieldInput {
  label: string
  field_type: string
  template_id: string
  options: string
  is_required: boolean
}

interface StepInput {
  title: string
  instructions: string
  requires_confirmation: boolean
  requires_quantity_entry: boolean
  fields: StepFieldInput[]
}

export default function FormulaEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNewVersion = searchParams.get('newVersion') === 'true'
  const isEdit = !!id
  const navigate = useNavigate()
  const { toast } = useToast()

  const { data: existingFormula, isLoading: loadingFormula } = useFormula(id)
  const { data: allIngredients, isLoading: loadingIngredients } = useIngredients()
  const { data: fieldTemplates, isLoading: loadingTemplates } = useFieldTemplates()
  const createFormula = useCreateFormula()
  const createVersion = useCreateFormulaVersion()

  const [name, setName] = useState('')
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [baseBatchSize, setBaseBatchSize] = useState('')
  const [baseBatchUnit, setBaseBatchUnit] = useState('kg')
  const [versionNotes, setVersionNotes] = useState('')
  const [ingredients, setIngredients] = useState<IngredientInput[]>([])
  const [steps, setSteps] = useState<StepInput[]>([])
  const [initialized, setInitialized] = useState(false)

  // Pre-fill from existing formula when creating new version
  if (isEdit && existingFormula && !initialized) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const versions = (existingFormula.versions ?? []) as any[]
    const currentVersion = versions[0]
    if (!isNewVersion) {
      // Viewing/editing — redirect to detail page
      navigate(`/admin/formulas/${id}`, { replace: true })
      return null
    }
    if (currentVersion) {
      setName(existingFormula.name)
      setProductName(existingFormula.product_name)
      setDescription(existingFormula.description ?? '')
      setBaseBatchSize(String(currentVersion.base_batch_size))
      setBaseBatchUnit(currentVersion.base_batch_unit)
      setIngredients(
        (currentVersion.ingredients ?? []).map((i: any) => ({
          ingredient_id: i.ingredient_id,
          quantity: String(i.quantity),
          notes: i.notes ?? '',
        })),
      )
      setSteps(
        (currentVersion.steps ?? []).map((s: any) => ({
          title: s.title,
          instructions: s.instructions ?? '',
          requires_confirmation: s.requires_confirmation,
          requires_quantity_entry: s.requires_quantity_entry,
          fields: (s.fields ?? []).map((f: any) => ({
            label: f.label,
            field_type: f.field_type,
            template_id: f.template_id ?? '',
            options: f.options ? JSON.stringify(f.options) : '',
            is_required: f.is_required,
          })),
        })),
      )
    }
    setInitialized(true)
  }

  if ((isEdit && loadingFormula) || loadingIngredients || loadingTemplates) {
    return <LoadingSpinner text="Loading..." />
  }

  const saving = createFormula.isPending || createVersion.isPending

  function addIngredient() {
    setIngredients([...ingredients, { ingredient_id: '', quantity: '', notes: '' }])
  }

  function updateIngredient(index: number, field: string, value: string) {
    setIngredients(ingredients.map((ing, i) => i === index ? { ...ing, [field]: value } : ing))
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  function addStep() {
    setSteps([...steps, { title: '', instructions: '', requires_confirmation: true, requires_quantity_entry: false, fields: [] }])
  }

  function updateStep(index: number, step: StepInput) {
    setSteps(steps.map((s, i) => i === index ? step : s))
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const parsedIngredients = ingredients
      .filter((i) => i.ingredient_id && i.quantity)
      .map((i, idx) => ({
        ingredient_id: i.ingredient_id,
        quantity: Number(i.quantity),
        sort_order: idx,
        notes: i.notes || undefined,
      }))

    const parsedSteps = steps.map((s, idx) => ({
      step_number: idx + 1,
      title: s.title,
      instructions: s.instructions || undefined,
      requires_confirmation: s.requires_confirmation,
      requires_quantity_entry: s.requires_quantity_entry,
      sort_order: idx,
      fields: s.fields.map((f, fi) => ({
        label: f.label,
        field_type: f.field_type,
        template_id: f.template_id || undefined,
        options: f.options ? JSON.parse(f.options) : undefined,
        is_required: f.is_required,
        sort_order: fi,
      })),
    }))

    if (isNewVersion && id) {
      createVersion.mutate(
        {
          formula_id: id,
          base_batch_size: Number(baseBatchSize),
          base_batch_unit: baseBatchUnit,
          notes: versionNotes || undefined,
          ingredients: parsedIngredients,
          steps: parsedSteps,
        },
        {
          onSuccess: () => {
            toast('success', 'New version created')
            navigate(`/admin/formulas/${id}`)
          },
          onError: (err) => toast('error', err.message),
        },
      )
    } else {
      createFormula.mutate(
        {
          name,
          product_name: productName,
          description: description || undefined,
          base_batch_size: Number(baseBatchSize),
          base_batch_unit: baseBatchUnit,
          ingredients: parsedIngredients,
          steps: parsedSteps,
        },
        {
          onSuccess: (formula) => {
            toast('success', 'Formula created')
            navigate(`/admin/formulas/${formula.id}`)
          },
          onError: (err) => toast('error', err.message),
        },
      )
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNewVersion ? `New Version — ${name}` : 'New Formula'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        {!isNewVersion && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Formula Details</h2>
            <div className="space-y-4">
              <Input label="Formula Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Lavender Body Wash" />
              <Input label="Product Name" value={productName} onChange={(e) => setProductName(e.target.value)} required placeholder="e.g. LBW-500ml" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional description..."
                />
              </div>
            </div>
          </Card>
        )}

        {/* Version Metadata */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isNewVersion ? 'Version Settings' : 'Batch Settings'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Base Batch Size" type="number" step="0.0001" value={baseBatchSize} onChange={(e) => setBaseBatchSize(e.target.value)} required />
            <Select label="Batch Unit" value={baseBatchUnit} onChange={(e) => setBaseBatchUnit(e.target.value)} options={BATCH_UNITS} />
          </div>
          {isNewVersion && (
            <div className="mt-4">
              <Input label="Version Notes" value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} placeholder="What changed in this version?" />
            </div>
          )}
        </Card>

        {/* Ingredients */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Ingredients ({ingredients.length})</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addIngredient}>
              <PlusIcon className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          {ingredients.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No ingredients added yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {ingredients.map((ing, i) => (
                <IngredientRow
                  key={i}
                  ingredient={ing}
                  index={i}
                  allIngredients={allIngredients ?? []}
                  onChange={updateIngredient}
                  onRemove={removeIngredient}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Steps */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Steps ({steps.length})</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addStep}>
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </div>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No steps added yet</p>
          ) : (
            <div className="space-y-4">
              {steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  index={i}
                  fieldTemplates={fieldTemplates ?? []}
                  onChange={updateStep}
                  onRemove={removeStep}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" loading={saving}>
            {isNewVersion ? 'Create Version' : 'Create Formula'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/admin/formulas/${id}` : '/admin/formulas')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
