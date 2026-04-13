import { useMemo } from 'react'
import { useRun } from '../api/production-runs'

export function useCurrentRun(id: string | undefined) {
  const query = useRun(id)

  const derived = useMemo(() => {
    const run = query.data
    if (!run) return null

    const steps = run.steps ?? []
    const totalSteps = steps.length
    const completedSteps = steps.filter((s) => s.status === 'completed').length
    const currentStep = steps.find((s) => s.sort_order === run.current_step_index) ?? null
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
    const isLastStep = currentStep ? currentStep.sort_order === totalSteps - 1 : false
    const isCompleted = run.status === 'completed'

    return { run, steps, totalSteps, completedSteps, currentStep, progress, isLastStep, isCompleted }
  }, [query.data])

  return { ...query, derived }
}
