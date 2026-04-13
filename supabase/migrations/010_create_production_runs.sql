-- Migration 010: Create production_runs table (immutable snapshot)
CREATE TABLE public.production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid REFERENCES public.production_queue(id),
  formula_id uuid REFERENCES public.formulas(id),
  formula_version_id uuid REFERENCES public.formula_versions(id),
  formula_name varchar(255) NOT NULL,
  product_name varchar(255) NOT NULL,
  version_number integer NOT NULL,
  batch_size numeric(12,4) NOT NULL,
  base_batch_size numeric(12,4) NOT NULL,
  base_batch_unit varchar(50) NOT NULL,
  scale_factor numeric(12,6) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'paused', 'completed', 'cancelled')),
  current_step_index integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  started_by uuid NOT NULL REFERENCES auth.users(id),
  completed_by uuid REFERENCES auth.users(id),
  notes text
);
