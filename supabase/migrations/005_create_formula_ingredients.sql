-- Migration 005: Create formula_ingredients table
CREATE TABLE public.formula_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_versions(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  quantity numeric(12,4) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  UNIQUE(formula_version_id, ingredient_id)
);
