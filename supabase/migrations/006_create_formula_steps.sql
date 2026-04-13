-- Migration 006: Create formula_steps table
CREATE TABLE public.formula_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_versions(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  title varchar(255) NOT NULL,
  instructions text,
  requires_confirmation boolean NOT NULL DEFAULT true,
  requires_quantity_entry boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL
);
