-- Migration 004: Create formula_versions table + add FK on formulas.current_version_id
CREATE TABLE public.formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  base_batch_size numeric(12,4) NOT NULL,
  base_batch_unit varchar(50) NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(formula_id, version_number)
);

ALTER TABLE public.formulas
  ADD CONSTRAINT fk_formulas_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.formula_versions(id);
