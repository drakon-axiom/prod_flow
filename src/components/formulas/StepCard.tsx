import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TrashIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { FIELD_TYPES } from '../../types/constants'
import type { Tables } from '../../types'

interface StepField {
  label: string
  field_type: string
  template_id: string
  options: string
  is_required: boolean
}

interface StepData {
  title: string
  instructions: string
  requires_confirmation: boolean
  requires_quantity_entry: boolean
  fields: StepField[]
}

interface StepCardProps {
  step: StepData
  index: number
  fieldTemplates: Tables<'step_field_templates'>[]
  onChange: (index: number, step: StepData) => void
  onRemove: (index: number) => void
}

const FIELD_TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

export function StepCard({ step, index, fieldTemplates, onChange, onRemove }: StepCardProps) {
  const [expanded, setExpanded] = useState(true)

  function updateField(key: keyof StepData, value: unknown) {
    onChange(index, { ...step, [key]: value })
  }

  function updateStepField(fi: number, key: keyof StepField, value: unknown) {
    const fields = [...step.fields]
    fields[fi] = { ...fields[fi], [key]: value }
    updateField('fields', fields)
  }

  function addField() {
    updateField('fields', [...step.fields, { label: '', field_type: 'text', template_id: '', options: '', is_required: false }])
  }

  function addFromTemplate(templateId: string) {
    const tmpl = fieldTemplates.find((t) => t.id === templateId)
    if (!tmpl) return
    updateField('fields', [
      ...step.fields,
      {
        label: tmpl.label,
        field_type: tmpl.field_type,
        template_id: tmpl.id,
        options: tmpl.options ? JSON.stringify(tmpl.options) : '',
        is_required: tmpl.is_required,
      },
    ])
  }

  function removeField(fi: number) {
    updateField('fields', step.fields.filter((_, i) => i !== fi))
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        <span className="text-sm font-medium text-gray-700">Step {index + 1}</span>
        <span className="text-sm text-gray-500 flex-1 truncate">{step.title || 'Untitled'}</span>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(index) }}>
          <TrashIcon className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <Input label="Title" value={step.title} onChange={(e) => updateField('title', e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              value={step.instructions}
              onChange={(e) => updateField('instructions', e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={step.requires_confirmation} onChange={(e) => updateField('requires_confirmation', e.target.checked)} className="rounded border-gray-300" />
              Requires confirmation
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={step.requires_quantity_entry} onChange={(e) => updateField('requires_quantity_entry', e.target.checked)} className="rounded border-gray-300" />
              Requires quantity entry
            </label>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Fields ({step.fields.length})</h4>
              <div className="flex gap-2">
                {fieldTemplates.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) { addFromTemplate(e.target.value); e.target.value = '' } }}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                    defaultValue=""
                  >
                    <option value="">+ From template...</option>
                    {fieldTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                )}
                <Button variant="secondary" size="sm" onClick={addField}>
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Custom
                </Button>
              </div>
            </div>

            {step.fields.map((field, fi) => (
              <div key={fi} className="flex items-start gap-2 py-1.5">
                <div className="flex-1">
                  <Input value={field.label} onChange={(e) => updateStepField(fi, 'label', e.target.value)} placeholder="Label" />
                </div>
                <div className="w-28">
                  <Select value={field.field_type} onChange={(e) => updateStepField(fi, 'field_type', e.target.value)} options={FIELD_TYPE_OPTIONS} />
                </div>
                <label className="flex items-center gap-1 text-xs text-gray-600 mt-2">
                  <input type="checkbox" checked={field.is_required} onChange={(e) => updateStepField(fi, 'is_required', e.target.checked)} className="rounded border-gray-300" />
                  Req
                </label>
                <Button variant="ghost" size="sm" onClick={() => removeField(fi)} className="mt-0.5">
                  <TrashIcon className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
