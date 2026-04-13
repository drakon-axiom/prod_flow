import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFormula, type FormulaVersionDetail } from '../../../api/formulas'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Select } from '../../../components/ui/Select'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'

export default function FormulaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: formula, isLoading, error } = useFormula(id)
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0)

  if (isLoading) return <LoadingSpinner text="Loading formula..." />
  if (error) return <p className="text-red-600">Error loading formula: {error.message}</p>
  if (!formula) return <p>Formula not found</p>

  const versions = (formula.versions ?? []) as FormulaVersionDetail[]
  const version = versions[selectedVersionIdx]
  const isCurrent = version?.id === formula.current_version_id

  const versionOptions = versions.map((v, i) => ({
    value: String(i),
    label: `v${v.version_number}${v.id === formula.current_version_id ? ' (current)' : ''}`,
  }))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{formula.name}</h1>
          <p className="text-sm text-gray-500">{formula.product_name} — {formula.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/admin/formulas/${id}/edit?newVersion=true`)}>
            New Version
          </Button>
          <Button variant="secondary" onClick={() => navigate('/admin/formulas')}>
            Back
          </Button>
        </div>
      </div>

      {versions.length > 1 && (
        <div className="mb-4 max-w-xs">
          <Select
            label="Version"
            value={String(selectedVersionIdx)}
            onChange={(e) => setSelectedVersionIdx(Number(e.target.value))}
            options={versionOptions}
          />
        </div>
      )}

      {version && (
        <>
          <Card className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Version {version.version_number}
              </h2>
              {isCurrent && <Badge className="bg-indigo-100 text-indigo-700">Current</Badge>}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Base Batch:</span>
                <span className="ml-2 font-medium">{version.base_batch_size} {version.base_batch_unit}</span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <span className="ml-2">{new Date(version.created_at).toLocaleDateString()}</span>
              </div>
              {version.notes && (
                <div>
                  <span className="text-gray-500">Notes:</span>
                  <span className="ml-2">{version.notes}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Ingredients */}
          <Card className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3">
              Ingredients ({version.ingredients?.length ?? 0})
            </h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Ingredient</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 font-medium">Quantity</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {version.ingredients?.map((fi) => {
                  const ing = Array.isArray(fi.ingredient) ? fi.ingredient[0] : fi.ingredient
                  return (
                    <tr key={fi.id}>
                      <td className="py-2 font-medium">{ing?.name ?? 'Unknown'}</td>
                      <td className="py-2 text-gray-500">{ing?.sku ?? '-'}</td>
                      <td className="py-2">{fi.quantity}</td>
                      <td className="py-2">{ing?.unit ?? '-'}</td>
                      <td className="py-2 text-gray-500">{fi.notes ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* Steps */}
          <Card>
            <h3 className="text-md font-semibold text-gray-900 mb-3">
              Steps ({version.steps?.length ?? 0})
            </h3>
            <div className="space-y-4">
              {version.steps?.map((step) => (
                <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-gray-100 text-gray-700">Step {step.step_number}</Badge>
                    <span className="font-medium text-gray-900">{step.title}</span>
                  </div>
                  {step.instructions && (
                    <p className="text-sm text-gray-600 mb-3">{step.instructions}</p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-500 mb-2">
                    {step.requires_confirmation && <span>Requires confirmation</span>}
                    {step.requires_quantity_entry && <span>Requires qty entry</span>}
                  </div>
                  {step.fields && step.fields.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Fields:</p>
                      <div className="flex flex-wrap gap-2">
                        {step.fields.map((f) => (
                          <Badge key={f.id} className="bg-blue-50 text-blue-700">
                            {f.label} ({f.field_type}){f.is_required ? ' *' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
