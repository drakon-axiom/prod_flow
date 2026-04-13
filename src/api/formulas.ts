import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEYS = {
  all: ['formulas'] as const,
  detail: (id: string) => ['formulas', id] as const,
}

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

      // For each version, fetch ingredients + steps + fields
      const versions = await Promise.all((rawVersions ?? []).map(async (v) => {
        const [ingRes, stepsRes] = await Promise.all([
          supabase
            .from('formula_ingredients')
            .select('*, ingredient:ingredients(id, name, unit, sku)')
            .eq('formula_version_id', v.id)
            .order('sort_order'),
          supabase
            .from('formula_steps')
            .select('*, fields:formula_step_fields(*)')
            .eq('formula_version_id', v.id)
            .order('sort_order'),
        ])
        const ingredients = (ingRes.data ?? []).map((fi: any) => ({
          ...fi,
          ingredient: Array.isArray(fi.ingredient) ? fi.ingredient[0] : fi.ingredient,
        }))
        const steps = (stepsRes.data ?? []).map((s: any) => ({
          ...s,
          fields: (s.fields ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        }))
        return { ...v, ingredients, steps }
      }))
      return { ...data, versions }
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
