-- Migration 012: Create run_steps table (snapshot of formula steps)
CREATE TABLE public.run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.production_runs(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  title varchar(255) NOT NULL,
  instructions text,
  requires_confirmation boolean NOT NULL,
  requires_quantity_entry boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  sort_order integer NOT NULL
);
