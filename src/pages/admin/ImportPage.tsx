import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useFormulas } from '../../api/formulas'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { parseCsv } from '../../utils/csv'
import { safeJsonParse } from '../../utils/safe-json'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'

type ImportMode = 'ingredients' | 'formulas' | 'combined' | 'steps'

interface ImportResult {
  success: number
  errors: string[]
}

export default function ImportPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: formulas } = useFormulas()

  const [mode, setMode] = useState<ImportMode>('ingredients')
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<unknown[] | null>(null)
  const [previewLabel, setPreviewLabel] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [rawData, setRawData] = useState<unknown>(null)
  const [selectedFormulaId, setSelectedFormulaId] = useState('')

  // Reset formula selection when mode changes
  useEffect(() => { setSelectedFormulaId('') }, [mode])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const isJson = file.name.endsWith('.json')
      const isCsv = file.name.endsWith('.csv')

      if (isJson) {
        const { data, error } = safeJsonParse(text)
        if (error) { toast('error', 'Invalid JSON file'); return }
        parseAndPreview(data)
      } else if (isCsv) {
        const rows = parseCsv(text)
        parseAndPreviewCsv(rows)
      } else {
        toast('error', 'Please upload a .json or .csv file')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function parseCsvJsonField(value: string | undefined): unknown {
    if (!value) return []
    const trimmed = value.trim()
    if (!trimmed) return []
    const { data } = safeJsonParse(trimmed)
    return data ?? []
  }

  function parseAndPreviewCsv(rows: Record<string, string>[]) {
    if (mode === 'ingredients') {
      parseAndPreview(rows)
    } else if (mode === 'formulas') {
      const formulas = rows.map((row) => ({
        name: row.name,
        product_name: row.product_name,
        description: row.description,
        base_batch_size: Number(row.base_batch_size),
        base_batch_unit: row.base_batch_unit,
        ingredients: parseCsvJsonField(row.ingredients_json),
        steps: parseCsvJsonField(row.steps_json),
      }))
      parseAndPreview(formulas)
    } else if (mode === 'steps') {
      const steps = rows.map((row) => ({
        title: row.title,
        instructions: row.instructions,
        requires_confirmation: row.requires_confirmation === 'true',
        requires_quantity_entry: row.requires_quantity_entry === 'true',
        fields: parseCsvJsonField(row.fields_json),
      }))
      parseAndPreview(steps)
    } else {
      const ingredients: Record<string, unknown>[] = []
      const formulas: Record<string, unknown>[] = []
      for (const row of rows) {
        if (row.type === 'ingredient') {
          ingredients.push({
            name: row.name, sku: row.sku, unit: row.unit,
            density: row.density || null, cost_per_unit: row.cost_per_unit || null, notes: row.notes,
          })
        } else if (row.type === 'formula') {
          formulas.push({
            name: row.name, product_name: row.product_name, description: row.description,
            base_batch_size: Number(row.base_batch_size), base_batch_unit: row.base_batch_unit,
            ingredients: parseCsvJsonField(row.ingredients_json),
            steps: parseCsvJsonField(row.steps_json),
          })
        }
      }
      parseAndPreview({ ingredients, formulas })
    }
  }

  function parseAndPreview(data: unknown) {
    if (mode === 'ingredients') {
      const items = Array.isArray(data) ? data : []
      setPreview(items)
      setPreviewLabel(`${items.length} ingredient(s)`)
      setRawData(items)
    } else if (mode === 'formulas') {
      const items = Array.isArray(data) ? data : []
      setPreview(items)
      setPreviewLabel(`${items.length} formula(s)`)
      setRawData(items)
    } else if (mode === 'steps') {
      const items = Array.isArray(data) ? data : []
      setPreview(items)
      setPreviewLabel(`${items.length} step(s)`)
      setRawData(items)
    } else {
      const combined = data as { ingredients?: unknown[]; formulas?: unknown[] }
      const ings = combined?.ingredients ?? []
      const forms = combined?.formulas ?? []
      setPreview([...ings.map((i) => ({ ...i as Record<string, unknown>, _type: 'ingredient' })), ...forms.map((f) => ({ ...f as Record<string, unknown>, _type: 'formula' }))])
      setPreviewLabel(`${ings.length} ingredient(s) + ${forms.length} formula(s)`)
      setRawData(combined)
    }
  }

  async function handleImport() {
    if (!rawData) return
    if (mode === 'steps' && !selectedFormulaId) {
      toast('error', 'Please select a formula to import steps into')
      return
    }
    setImporting(true)
    setResult(null)

    try {
      if (mode === 'ingredients') {
        const res = await importIngredients(rawData as Record<string, unknown>[])
        setResult(res)
      } else if (mode === 'formulas') {
        const res = await importFormulas(rawData as Record<string, unknown>[])
        setResult(res)
      } else if (mode === 'steps') {
        const res = await importSteps(rawData as Record<string, unknown>[], selectedFormulaId)
        setResult(res)
      } else {
        const combined = rawData as { ingredients?: Record<string, unknown>[]; formulas?: Record<string, unknown>[] }
        const ingResult = await importIngredients(combined.ingredients ?? [])
        await qc.invalidateQueries({ queryKey: queryKeys.ingredients.all })
        const formResult = await importFormulas(combined.formulas ?? [])
        setResult({
          success: ingResult.success + formResult.success,
          errors: [...ingResult.errors, ...formResult.errors],
        })
      }
      qc.invalidateQueries({ queryKey: queryKeys.ingredients.all })
      qc.invalidateQueries({ queryKey: queryKeys.formulas.all })
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function importIngredients(items: Record<string, unknown>[]): Promise<ImportResult> {
    let success = 0
    const errors: string[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const name = String(item.name ?? '').trim()
      const unit = String(item.unit ?? '').trim()
      if (!name || !unit) { errors.push(`Row ${i + 1}: name and unit are required`); continue }

      const { error } = await supabase.from('ingredients').insert({
        name,
        sku: item.sku ? String(item.sku) : null,
        unit,
        density: item.density != null && item.density !== '' ? Number(item.density) : null,
        cost_per_unit: item.cost_per_unit != null && item.cost_per_unit !== '' ? Number(item.cost_per_unit) : null,
        notes: item.notes ? String(item.notes) : null,
      })
      if (error) { errors.push(`Row ${i + 1} (${name}): ${error.message}`); continue }
      success++
    }
    return { success, errors }
  }

  async function importFormulas(items: Record<string, unknown>[]): Promise<ImportResult> {
    const { data: allIngredients } = await supabase.from('ingredients').select('id, name').eq('is_active', true)
    const ingredientMap = new Map((allIngredients ?? []).map((i) => [i.name.toLowerCase(), i.id]))

    let success = 0
    const errors: string[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const name = String(item.name ?? '').trim()
      const productName = String(item.product_name ?? '').trim()
      if (!name || !productName) { errors.push(`Formula ${i + 1}: name and product_name are required`); continue }

      const baseBatchSize = Number(item.base_batch_size)
      const baseBatchUnit = String(item.base_batch_unit ?? 'kg')
      if (!baseBatchSize || baseBatchSize <= 0) { errors.push(`Formula ${i + 1} (${name}): valid base_batch_size required`); continue }

      try {
        const { data: formula, error: fErr } = await supabase
          .from('formulas')
          .insert({ name, product_name: productName, description: item.description ? String(item.description) : null })
          .select().single()
        if (fErr) throw new Error(fErr.message)

        const { data: version, error: vErr } = await supabase
          .from('formula_versions')
          .insert({ formula_id: formula.id, version_number: 1, base_batch_size: baseBatchSize, base_batch_unit: baseBatchUnit })
          .select().single()
        if (vErr) throw new Error(vErr.message)

        await supabase.from('formulas').update({ current_version_id: version.id }).eq('id', formula.id)

        const rawIngredients = (item.ingredients ?? []) as Record<string, unknown>[]
        for (let j = 0; j < rawIngredients.length; j++) {
          const ing = rawIngredients[j]
          const ingName = String(ing.ingredient_name ?? ing.name ?? '').trim()
          const ingredientId = ingredientMap.get(ingName.toLowerCase())
          if (!ingredientId) { errors.push(`Formula "${name}" ingredient "${ingName}": not found in ingredients list`); continue }
          await supabase.from('formula_ingredients').insert({
            formula_version_id: version.id,
            ingredient_id: ingredientId,
            quantity: Number(ing.quantity),
            sort_order: j,
            notes: ing.notes ? String(ing.notes) : null,
          })
        }

        await insertStepsForVersion(version.id, (item.steps ?? []) as Record<string, unknown>[], name, errors)
        success++
      } catch (err) {
        errors.push(`Formula ${i + 1} (${name}): ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    return { success, errors }
  }

  async function importSteps(items: Record<string, unknown>[], formulaId: string): Promise<ImportResult> {
    const errors: string[] = []

    // Get the formula's current version
    const { data: formula } = await supabase
      .from('formulas')
      .select('current_version_id, name')
      .eq('id', formulaId)
      .single()

    if (!formula?.current_version_id) {
      return { success: 0, errors: ['Formula has no current version'] }
    }

    // Get existing step count to determine sort_order offset
    const { count: existingCount } = await supabase
      .from('formula_steps')
      .select('id', { count: 'exact', head: true })
      .eq('formula_version_id', formula.current_version_id)

    const offset = existingCount ?? 0

    let success = 0
    for (let s = 0; s < items.length; s++) {
      const step = items[s]
      const title = String(step.title ?? '').trim()
      if (!title) { errors.push(`Step ${s + 1}: title is required`); continue }

      const { data: newStep, error: sErr } = await supabase.from('formula_steps').insert({
        formula_version_id: formula.current_version_id,
        step_number: offset + s + 1,
        title,
        instructions: step.instructions ? String(step.instructions) : null,
        requires_confirmation: step.requires_confirmation === true,
        requires_quantity_entry: step.requires_quantity_entry === true,
        sort_order: offset + s,
      }).select().single()

      if (sErr) { errors.push(`Step ${s + 1} (${title}): ${sErr.message}`); continue }

      const rawFields = (step.fields ?? []) as Record<string, unknown>[]
      for (let f = 0; f < rawFields.length; f++) {
        const field = rawFields[f]
        const { error: fErr } = await supabase.from('formula_step_fields').insert({
          formula_step_id: newStep.id,
          label: String(field.label ?? ''),
          field_type: String(field.field_type ?? 'text'),
          is_required: field.is_required === true,
          options: field.options ? (field.options as import('../../lib/database.types').Json) : null,
          sort_order: f,
        })
        if (fErr) errors.push(`Step "${title}" field ${f + 1}: ${fErr.message}`)
      }

      success++
    }

    return { success, errors }
  }

  async function insertStepsForVersion(versionId: string, rawSteps: Record<string, unknown>[], formulaName: string, errors: string[]) {
    for (let s = 0; s < rawSteps.length; s++) {
      const step = rawSteps[s]
      const { data: newStep, error: sErr } = await supabase.from('formula_steps').insert({
        formula_version_id: versionId,
        step_number: s + 1,
        title: String(step.title ?? ''),
        instructions: step.instructions ? String(step.instructions) : null,
        requires_confirmation: step.requires_confirmation === true,
        requires_quantity_entry: step.requires_quantity_entry === true,
        sort_order: s,
      }).select().single()
      if (sErr) { errors.push(`Formula "${formulaName}" step ${s + 1}: ${sErr.message}`); continue }

      const rawFields = (step.fields ?? []) as Record<string, unknown>[]
      for (let f = 0; f < rawFields.length; f++) {
        const field = rawFields[f]
        await supabase.from('formula_step_fields').insert({
          formula_step_id: newStep.id,
          label: String(field.label ?? ''),
          field_type: String(field.field_type ?? 'text'),
          is_required: field.is_required === true,
          options: field.options ? (field.options as import('../../lib/database.types').Json) : null,
          sort_order: f,
        })
      }
    }
  }

  const formulaOptions = (formulas ?? []).map((f) => {
    const cv = Array.isArray(f.current_version) ? f.current_version[0] : f.current_version
    return { value: f.id, label: `${f.name} (${f.product_name})${cv ? ` — v${cv.version_number}` : ''}` }
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
          <p className="mt-1 text-sm text-gray-500">Import ingredients, formulas, steps, or combined from JSON or CSV</p>
        </div>
      </div>

      {/* Download Templates */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Download Templates</h2>
        <p className="text-sm text-gray-500 mb-4">Download example files to see the expected format.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/ingredients-template.json')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Ingredients JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/ingredients-template.csv')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Ingredients CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/formulas-template.json')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Formulas JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/formulas-template.csv')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Formulas CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/steps-template.json')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Steps JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/steps-template.csv')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Steps CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/combined-template.json')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Combined JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.open('/templates/combined-template.csv')}>
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" /> Combined CSV
          </Button>
        </div>
      </Card>

      {/* Import Mode */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Import</h2>
        <div className="space-y-4">
          <Select
            label="Import Type"
            value={mode}
            onChange={(e) => { setMode(e.target.value as ImportMode); setPreview(null); setResult(null); setRawData(null) }}
            options={[
              { value: 'ingredients', label: 'Ingredients Only (JSON or CSV)' },
              { value: 'formulas', label: 'Formulas Only (JSON or CSV)' },
              { value: 'steps', label: 'Formula Steps (JSON or CSV)' },
              { value: 'combined', label: 'Ingredients + Formulas (JSON or CSV)' },
            ]}
          />

          {mode === 'formulas' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Formula ingredients are matched by name. Make sure all referenced ingredients exist before importing formulas, or use the "Combined" mode to import both at once.
            </p>
          )}

          {mode === 'steps' && (
            <>
              <Select
                label="Target Formula"
                value={selectedFormulaId}
                onChange={(e) => setSelectedFormulaId(e.target.value)}
                placeholder="Select a formula..."
                options={formulaOptions}
              />
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                Steps will be appended to the formula's current version. Existing steps are not removed.
              </p>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <Badge className="bg-blue-100 text-blue-700">{previewLabel}</Badge>
          </div>
          <div className="max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(preview.slice(0, 10), null, 2)}
              {preview.length > 10 && `\n... and ${preview.length - 10} more`}
            </pre>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleImport} loading={importing} disabled={mode === 'steps' && !selectedFormulaId}>
              <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
              Import {previewLabel}
            </Button>
            <Button variant="secondary" onClick={() => { setPreview(null); setRawData(null); setResult(null) }}>
              Clear
            </Button>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className={result.errors.length > 0 ? 'border-amber-200' : 'border-green-200'}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Import Results</h2>
          <div className="flex gap-4 mb-3">
            <Badge className="bg-green-100 text-green-700">{result.success} succeeded</Badge>
            {result.errors.length > 0 && (
              <Badge className="bg-red-100 text-red-700">{result.errors.length} error(s)</Badge>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 max-h-48 overflow-y-auto">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-700 mb-1">{err}</p>
              ))}
            </div>
          )}
          {result.success > 0 && (
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => navigate('/admin/ingredients')}>View Ingredients</Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/admin/formulas')}>View Formulas</Button>
              {mode === 'steps' && selectedFormulaId && (
                <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/formulas/${selectedFormulaId}`)}>View Formula</Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
