import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Card } from '../ui/Card'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import type { Tables } from '../../types'

interface StepExecutionCardProps {
  step: Tables<'run_steps'> & { inputs: Tables<'run_step_inputs'>[] }
  isCurrentStep: boolean
  isCompleted: boolean
  isLastStep: boolean
  onComplete: (inputs: { id: string; value: string }[]) => void
  completing: boolean
}

export function StepExecutionCard({ step, isCurrentStep, isCompleted, isLastStep, onComplete, completing }: StepExecutionCardProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    step.inputs?.forEach((inp) => {
      initial[inp.id] = inp.value ?? ''
    })
    return initial
  })

  function handleComplete() {
    const inputs = Object.entries(values).map(([id, value]) => ({ id, value }))
    onComplete(inputs)
  }

  const allRequiredFilled = step.inputs
    ?.filter((inp) => inp.is_required)
    .every((inp) => values[inp.id]?.trim()) ?? true

  if (isCompleted) {
    return (
      <Card className="opacity-75">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-gray-500">Step {step.step_number}: {step.title}</span>
          {step.completed_at && (
            <span className="text-xs text-gray-400 ml-auto">
              {new Date(step.completed_at).toLocaleTimeString()}
            </span>
          )}
        </div>
        {step.inputs && step.inputs.length > 0 && (
          <div className="ml-7 space-y-1">
            {step.inputs.map((inp) => (
              <div key={inp.id} className="text-xs text-gray-500">
                <span className="font-medium">{inp.label}:</span> {inp.value || '-'}
              </div>
            ))}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card className={isCurrentStep ? 'ring-2 ring-indigo-500' : 'opacity-50'}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Step {step.step_number}: {step.title}
        </h3>
        {step.instructions && (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{step.instructions}</p>
        )}
      </div>

      {step.inputs && step.inputs.length > 0 && isCurrentStep && (
        <div className="space-y-3 mb-4">
          {step.inputs.map((inp) => {
            if (inp.field_type === 'checkbox') {
              return (
                <label key={inp.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values[inp.id] === 'true'}
                    onChange={(e) => setValues((v) => ({ ...v, [inp.id]: String(e.target.checked) }))}
                    className="rounded border-gray-300 h-5 w-5"
                  />
                  <span className={inp.is_required ? 'font-medium' : ''}>{inp.label}{inp.is_required ? ' *' : ''}</span>
                </label>
              )
            }
            if (inp.field_type === 'textarea') {
              return (
                <div key={inp.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {inp.label}{inp.is_required ? ' *' : ''}
                  </label>
                  <textarea
                    value={values[inp.id] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [inp.id]: e.target.value }))}
                    rows={3}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required={inp.is_required}
                  />
                </div>
              )
            }
            if (inp.field_type === 'select') {
              const opts = (inp.options as { options?: string[] })?.options ?? []
              return (
                <Select
                  key={inp.id}
                  label={`${inp.label}${inp.is_required ? ' *' : ''}`}
                  value={values[inp.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [inp.id]: e.target.value }))}
                  placeholder="Select..."
                  options={opts.map((o) => ({ value: o, label: o }))}
                />
              )
            }
            return (
              <Input
                key={inp.id}
                label={`${inp.label}${inp.is_required ? ' *' : ''}`}
                type={inp.field_type === 'number' ? 'number' : 'text'}
                step={inp.field_type === 'number' ? '0.01' : undefined}
                value={values[inp.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [inp.id]: e.target.value }))}
                required={inp.is_required}
              />
            )
          })}
        </div>
      )}

      {isCurrentStep && (
        <Button
          onClick={handleComplete}
          loading={completing}
          disabled={!allRequiredFilled}
          className="w-full"
          size="lg"
        >
          {isLastStep ? 'Complete Run' : 'Complete Step'}
        </Button>
      )}
    </Card>
  )
}
