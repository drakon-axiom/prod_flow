import { useParams, useNavigate } from 'react-router-dom'
import { useCurrentRun } from '../../hooks/useCurrentRun'
import { useCompleteStep, usePauseRun } from '../../api/production-runs'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { RunProgressBar } from '../../components/runs/RunProgressBar'
import { MaterialsChecklist } from '../../components/runs/MaterialsChecklist'
import { StepExecutionCard } from '../../components/runs/StepExecutionCard'
import { RUN_STATUS_COLORS, type RunStatus } from '../../types/constants'

export default function ActiveRunPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { derived, isLoading } = useCurrentRun(id)
  const completeStep = useCompleteStep()
  const pauseRun = usePauseRun()

  if (isLoading) return <LoadingSpinner text="Loading run..." />
  if (!derived) return <p>Run not found</p>

  const { run, steps, totalSteps, completedSteps, currentStep, isLastStep, isCompleted } = derived

  function handleComplete(inputs: { id: string; value: string }[]) {
    if (!currentStep || !user || !id) return
    completeStep.mutate(
      { run_id: id, step_id: currentStep.id, user_id: user.id, inputs },
      {
        onSuccess: (result) => {
          if (result.run_completed) {
            toast('success', 'Run completed!')
          } else {
            toast('success', 'Step completed')
          }
        },
        onError: (err) => toast('error', err.message),
      },
    )
  }

  function handlePause() {
    if (!id) return
    const newStatus = run.status === 'paused' ? 'in_progress' : 'paused'
    pauseRun.mutate(
      { id, status: newStatus },
      { onSuccess: () => toast('info', newStatus === 'paused' ? 'Run paused' : 'Run resumed') },
    )
  }

  function handleCancel() {
    if (!id) return
    pauseRun.mutate(
      { id, status: 'cancelled' },
      { onSuccess: () => { toast('info', 'Run cancelled'); navigate('/runs') } },
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{run.formula_name}</h1>
            <Badge className={RUN_STATUS_COLORS[run.status as RunStatus]}>
              {run.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {run.product_name} — {run.batch_size} {run.base_batch_unit} ({Number(run.scale_factor).toFixed(2)}x scale)
          </p>
        </div>
        {!isCompleted && run.status !== 'cancelled' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handlePause}>
              {run.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="danger" size="sm" onClick={handleCancel}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Progress */}
      <RunProgressBar completed={completedSteps} total={totalSteps} className="mb-6" />

      {/* Materials */}
      <div className="mb-6">
        <MaterialsChecklist materials={run.materials ?? []} />
      </div>

      {/* Paused banner */}
      {run.status === 'paused' && (
        <Card className="mb-6 bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-800 font-medium">Run is paused</p>
              <p className="text-orange-600 text-sm mt-1">Resume the run to continue executing steps.</p>
            </div>
            <Button size="sm" onClick={handlePause} loading={pauseRun.isPending}>
              Resume Run
            </Button>
          </div>
        </Card>
      )}

      {/* Completed message */}
      {isCompleted && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <p className="text-green-800 font-medium">Run completed successfully!</p>
          <p className="text-green-600 text-sm mt-1">
            Completed at {run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate(`/runs/${id}`)}>
            View Details
          </Button>
        </Card>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => (
          <StepExecutionCard
            key={step.id}
            step={step as typeof step & { inputs: NonNullable<typeof step.inputs> }}
            isCurrentStep={!isCompleted && run.status === 'in_progress' && step.sort_order === run.current_step_index}
            isCompleted={step.status === 'completed'}
            isLastStep={isLastStep && step.sort_order === run.current_step_index}
            onComplete={handleComplete}
            completing={completeStep.isPending}
          />
        ))}
      </div>
    </div>
  )
}
