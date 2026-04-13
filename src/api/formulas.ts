import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import type { Json } from '../lib/database.types'

export interface FormulaIngredientDetail {
  id: string
  formula_version_id: string
  ingredient_id: string
  quantity: number
  sort_order: number
  notes: string | null
  ingredient: { id: string; name: string; unit: string; sku: string | null } | null
}

export interface FormulaStepFieldDetail {
  id: string
  formula_step_id: string
  template_id: string | null
  label: string
  field_type: string
  options: Json | null
  is_required: boolean
  sort_order: number
}

export interface FormulaStepDetail {
  id: string
  formula_version_id: string
  step_number: number
  title: string
  instructions: string | null
  requires_confirmation: boolean
  requires_quantity_entry: boolean
  sort_order: number
  fields: FormulaStepFieldDetail[]
}

export interface FormulaVersionDetail {
  id: string
  formula_id: string
  version_number: number
  base_batch_size: number
  base_batch_unit: string
  notes: string | null
  created_by: string | null
  created_at: string
  ingredients: FormulaIngredientDetail[]
  steps: FormulaStepDetail[]
}

const KEYS = queryKeys.formulas

export function useFormulas() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formulas')
        .select(`
          *,
          current_version:formula_versions!fk_formulas_current_version(
            id, version_number, base_batch_size, base_batch_unit
          )
        `)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useFormula(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id!),
    enabled: !!id,
    queryFn: async () => {
      // Fetch formula + versions separately to avoid deep nested join issues
      const { data, error } = await supabase
        .from('formulas')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error

      // Fetch versions for this formula
      const { data: rawVersions, error: vErr } = await supabase
        .from('formula_versions')
        .select('*')
        .eq('formula_id', id!)
        .order('version_number', { ascending: false })
      if (vErr) throw vErr

      // Batch-fetch ingredients and steps for all versions in 2 queries (not N*2)
      const versionIds = (rawVersions ?? []).map((v) => v.id)

      const [allIngRes, allStepsRes] = versionIds.length > 0
        ? await Promise.all([
            supabase
              .from('formula_ingredients')
              .select('*, ingredient:ingredients(id, name, unit, sku)')
              .in('formula_version_id', versionIds)
              .order('sort_order'),
            supabase
              .from('formula_steps')
              .select('*, fields:formula_step_fields(*)')
              .in('formula_version_id', versionIds)
              .order('sort_order'),
          ])
        : [{ data: [] }, { data: [] }]

      // Group by version ID
      const ingByVersion = new Map<string, FormulaIngredientDetail[]>()
      for (const fi of (allIngRes.data ?? [])) {
        const vid = fi.formula_version_id
        if (!ingByVersion.has(vid)) ingByVersion.set(vid, [])
        ingByVersion.get(vid)!.push({
          ...fi,
          ingredient: Array.isArray(fi.ingredient) ? fi.ingredient[0] : fi.ingredient,
        })
      }

      const stepsByVersion = new Map<string, FormulaStepDetail[]>()
      for (const s of (allStepsRes.data ?? [])) {
        const vid = s.formula_version_id
        if (!stepsByVersion.has(vid)) stepsByVersion.set(vid, [])
        stepsByVersion.get(vid)!.push({
          ...s,
          fields: ((s.fields ?? []) as FormulaStepFieldDetail[]).sort((a, b) => a.sort_order - b.sort_order),
        })
      }

      const versions: FormulaVersionDetail[] = (rawVersions ?? []).map((v) => ({
        ...v,
        ingredients: ingByVersion.get(v.id) ?? [],
        steps: stepsByVersion.get(v.id) ?? [],
      }))

      return { ...data, versions } as typeof data & { versions: FormulaVersionDetail[] }
    },
  })
}

export function useCreateFormula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      product_name: string
      description?: string
      base_batch_size: number
      base_batch_unit: string
      ingredients: { ingredient_id: string; quantity: number; sort_order: number; notes?: string }[]
      steps: {
        step_number: number
        title: string
        instructions?: string
        requires_confirmation: boolean
        requires_quantity_entry: boolean
        sort_order: number
        fields: { label: string; field_type: string; template_id?: string; options?: unknown; is_required: boolean; sort_order: number }[]
      }[]
    }) => {
      // Create formula
      const { data: formula, error: fErr } = await supabase
        .from('formulas')
        .insert({ name: input.name, product_name: input.product_name, description: input.description || null })
        .select()
        .single()
      if (fErr) throw fErr

      // Create version
      const { data: version, error: vErr } = await supabase
        .from('formula_versions')
        .insert({
          formula_id: formula.id,
          version_number: 1,
          base_batch_size: input.base_batch_size,
          base_batch_unit: input.base_batch_unit,
        })
        .select()
        .single()
      if (vErr) throw vErr

      // Set current version
      await supabase.from('formulas').update({ current_version_id: version.id }).eq('id', formula.id)

      // Insert ingredients
      if (input.ingredients.length > 0) {
        const { error: iErr } = await supabase.from('formula_ingredients').insert(
          input.ingredients.map((i) => ({ ...i, formula_version_id: version.id })),
        )
        if (iErr) throw iErr
      }

      // Insert steps + fields
      for (const step of input.steps) {
        const { fields, ...stepData } = step
        const { data: newStep, error: sErr } = await supabase
          .from('formula_steps')
          .insert({ ...stepData, formula_version_id: version.id })
          .select()
          .single()
        if (sErr) throw sErr

        if (fields.length > 0) {
          const { error: sfErr } = await supabase.from('formula_step_fields').insert(
            fields.map((f) => ({
              ...f,
              formula_step_id: newStep.id,
              template_id: f.template_id || null,
              options: (f.options || null) as import('../lib/database.types').Json | null,
            })),
          )
          if (sfErr) throw sfErr
        }
      }

      return formula
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useCreateFormulaVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      formula_id: string
      base_batch_size: number
      base_batch_unit: string
      notes?: string
      ingredients: { ingredient_id: string; quantity: number; sort_order: number; notes?: string }[]
      steps: {
        step_number: number
        title: string
        instructions?: string
        requires_confirmation: boolean
        requires_quantity_entry: boolean
        sort_order: number
        fields: { label: string; field_type: string; template_id?: string; options?: unknown; is_required: boolean; sort_order: number }[]
      }[]
    }) => {
      // Get max version number
      const { data: versions } = await supabase
        .from('formula_versions')
        .select('version_number')
        .eq('formula_id', input.formula_id)
        .order('version_number', { ascending: false })
        .limit(1)
      const nextVersion = (versions?.[0]?.version_number ?? 0) + 1

      const { data: version, error: vErr } = await supabase
        .from('formula_versions')
        .insert({
          formula_id: input.formula_id,
          version_number: nextVersion,
          base_batch_size: input.base_batch_size,
          base_batch_unit: input.base_batch_unit,
          notes: input.notes || null,
        })
        .select()
        .single()
      if (vErr) throw vErr

      await supabase.from('formulas').update({ current_version_id: version.id }).eq('id', input.formula_id)

      if (input.ingredients.length > 0) {
        const { error: iErr } = await supabase.from('formula_ingredients').insert(
          input.ingredients.map((i) => ({ ...i, formula_version_id: version.id })),
        )
        if (iErr) throw iErr
      }

      for (const step of input.steps) {
        const { fields, ...stepData } = step
        const { data: newStep, error: sErr } = await supabase
          .from('formula_steps')
          .insert({ ...stepData, formula_version_id: version.id })
          .select()
          .single()
        if (sErr) throw sErr

        if (fields.length > 0) {
          const { error: sfErr } = await supabase.from('formula_step_fields').insert(
            fields.map((f) => ({
              ...f,
              formula_step_id: newStep.id,
              template_id: f.template_id || null,
              options: (f.options || null) as import('../lib/database.types').Json | null,
            })),
          )
          if (sfErr) throw sfErr
        }
      }

      return version
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.formula_id) })
    },
  })
}
