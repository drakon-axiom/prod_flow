import { useParams, useNavigate } from 'react-router-dom'
import { useRun } from '../../api/production-runs'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { RunProgressBar } from '../../components/runs/RunProgressBar'
import { RUN_STATUS_COLORS, type RunStatus } from '../../types/constants'

export default function RunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: run, isLoading } = useRun(id)

  if (isLoading) return <LoadingSpinner text="Loading run..." />
  if (!run) return <p>Run not found</p>

  const steps = run.steps ?? []
  const materials = run.materials ?? []
  const completedSteps = steps.filter((s) => s.status === 'completed').length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{run.formula_name}</h1>
            <Badge className={RUN_STATUS_COLORS[run.status as RunStatus]}>
              {run.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {run.product_name} v{run.version_number} — {run.batch_size} {run.base_batch_unit} ({Number(run.scale_factor).toFixed(2)}x)
          </p>
        </div>
        <div className="flex gap-2">
          {(run.status === 'in_progress' || run.status === 'paused') && (
            <Button size="sm" onClick={() => navigate(`/runs/${id}/execute`)}>
              {run.status === 'paused' ? 'Resume Run' : 'Continue Run'}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate('/runs')}>Back</Button>
        </div>
      </div>

      <RunProgressBar completed={completedSteps} total={steps.length} className="mb-6" />

      {/* Metadata */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Run Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-500">Started:</span> <span className="ml-1">{new Date(run.started_at).toLocaleString()}</span></div>
          {run.completed_at && <div><span className="text-gray-500">Completed:</span> <span className="ml-1">{new Date(run.completed_at).toLocaleString()}</span></div>}
          <div><span className="text-gray-500">Base batch:</span> <span className="ml-1">{run.base_batch_size} {run.base_batch_unit}</span></div>
          <div><span className="text-gray-500">Scale:</span> <span className="ml-1">{Number(run.scale_factor).toFixed(4)}x</span></div>
        </div>
      </Card>

      {/* Materials */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Materials</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2 font-medium">Material</th>
              <th className="pb-2 font-medium">Base Qty</th>
              <th className="pb-2 font-medium">Scaled Qty</th>
              <th className="pb-2 font-medium">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materials.map((m) => (
              <tr key={m.id}>
                <td className="py-2 font-medium">{m.ingredient_name}</td>
                <td className="py-2 font-mono text-gray-500">{Number(m.base_quantity).toFixed(2)}</td>
                <td className="py-2 font-mono">{Number(m.scaled_quantity).toFixed(2)}</td>
                <td className="py-2 text-gray-500">{m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Steps Timeline */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Steps</h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="border-l-2 border-gray-200 pl-4 ml-2">
              <div className="flex items-center gap-2">
                <Badge className={step.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                  Step {step.step_number}
                </Badge>
                <span className="font-medium text-sm">{step.title}</span>
                <span className="text-xs text-gray-400 ml-auto">{step.status}</span>
              </div>
              {step.completed_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Completed {new Date(step.completed_at).toLocaleString()}
                </p>
              )}
              {step.inputs && step.inputs.length > 0 && step.status === 'completed' && (
                <div className="mt-2 space-y-1">
                  {step.inputs.map((inp) => (
                    <div key={inp.id} className="text-xs text-gray-600">
                      <span className="font-medium">{inp.label}:</span> {inp.value || '-'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
