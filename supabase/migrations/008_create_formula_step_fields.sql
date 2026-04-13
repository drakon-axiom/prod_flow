-- Migration 008: Create formula_step_fields table
CREATE TABLE public.formula_step_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_step_id uuid NOT NULL REFERENCES public.formula_steps(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.step_field_templates(id),
  label varchar(255) NOT NULL,
  field_type varchar(30) NOT NULL CHECK (field_type IN ('text', 'number', 'checkbox', 'select', 'textarea')),
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);
