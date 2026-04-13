-- Migration 013: Create run_step_inputs table (snapshot of step fields + captured values)
CREATE TABLE public.run_step_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_step_id uuid NOT NULL REFERENCES public.run_steps(id) ON DELETE CASCADE,
  label varchar(255) NOT NULL,
  field_type varchar(30) NOT NULL,
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  value text,
  sort_order integer NOT NULL DEFAULT 0
);
