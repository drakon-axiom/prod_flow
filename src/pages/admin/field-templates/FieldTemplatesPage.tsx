import { useState, type FormEvent } from 'react'
import { useFieldTemplates, useCreateFieldTemplate, useUpdateFieldTemplate, useToggleFieldTemplate, useDeleteFieldTemplate } from '../../../api/field-templates'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable } from '../../../components/ui/DataTable'
import { Badge } from '../../../components/ui/Badge'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { PlusIcon } from '@heroicons/react/24/outline'
import { FIELD_TYPE_OPTIONS } from '../../../types/constants'
import { safeJsonParse } from '../../../utils/safe-json'


interface FormState {
  id?: string
  name: string
  label: string
  field_type: string
  options: string
  is_required: boolean
}

const emptyForm: FormState = { name: '', label: '', field_type: 'text', options: '', is_required: false }

export default function FieldTemplatesPage() {
  const { toast } = useToast()
  const { data: templates, isLoading } = useFieldTemplates(true)
  const createMutation = useCreateFieldTemplate()
  const updateMutation = useUpdateFieldTemplate()
  const toggleMutation = useToggleFieldTemplate()
  const deleteMutation = useDeleteFieldTemplate()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  function openNew() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(t: NonNullable<typeof templates>[number]) {
    setForm({
      id: t.id,
      name: t.name,
      label: t.label,
      field_type: t.field_type,
      options: t.options ? JSON.stringify(t.options) : '',
      is_required: t.is_required,
    })
    setModalOpen(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    let parsedOptions: unknown = null
    if (form.options) {
      const { data, error } = safeJsonParse(form.options)
      if (error) {
        toast('error', `Invalid JSON in options: ${error}`)
        return
      }
      parsedOptions = data
    }
    const payload = {
      name: form.name,
      label: form.label,
      field_type: form.field_type,
      options: parsedOptions as import('../../../lib/database.types').Json | null,
      is_required: form.is_required,
    }

    if (form.id) {
      updateMutation.mutate(
        { id: form.id, ...payload },
        {
          onSuccess: () => { toast('success', 'Template updated'); setModalOpen(false) },
          onError: (err) => toast('error', err.message),
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast('success', 'Template created'); setModalOpen(false) },
        onError: (err) => toast('error', err.message),
      })
    }
  }

  if (isLoading) return <LoadingSpinner text="Loading templates..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Templates</h1>
          <p className="mt-1 text-sm text-gray-500">Reusable field definitions for formula steps</p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <Card padding={false}>
        <DataTable
          keyExtractor={(row) => row.id}
          onRowClick={openEdit}
          emptyMessage="No field templates yet"
          data={templates ?? []}
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'label', header: 'Label' },
            {
              key: 'field_type',
              header: 'Type',
              render: (r) => <Badge className="bg-indigo-100 text-indigo-700">{r.field_type}</Badge>,
            },
            {
              key: 'is_required',
              header: 'Required',
              render: (r) => r.is_required ? 'Yes' : 'No',
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleMutation.mutate(
                        { id: r.id, is_active: !r.is_active },
                        { onSuccess: () => toast('success', r.is_active ? 'Deactivated' : 'Reactivated') },
                      )
                    }}
                  >
                    {r.is_active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate(r.id, {
                        onSuccess: () => toast('success', `Deleted ${r.name}`),
                        onError: (err) => toast('error', err.message),
                      })
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Edit Template' : 'New Template'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name (internal)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. temperature" />
          <Input label="Label (display)" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required placeholder="e.g. Temperature (°C)" />
          <Select label="Field Type" value={form.field_type} onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value }))} options={FIELD_TYPE_OPTIONS} />
          {form.field_type === 'select' && (
            <Input label="Options (JSON)" value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} placeholder='{"options": ["Option A", "Option B"]}' />
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_required} onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))} className="rounded border-gray-300" />
            Required by default
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {form.id ? 'Save' : 'Create'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
