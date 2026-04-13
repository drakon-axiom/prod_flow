-- Migration 009: Create production_queue table
CREATE TABLE public.production_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES public.formulas(id),
  formula_version_id uuid NOT NULL REFERENCES public.formula_versions(id),
  batch_size numeric(12,4) NOT NULL,
  batch_unit varchar(50) NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ready', 'in_progress', 'paused', 'completed', 'cancelled')),
  due_date timestamptz,
  notes text,
  external_order_id varchar(255),
  assigned_to uuid REFERENCES auth.users(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_status_priority
  ON public.production_queue(status, priority DESC, due_date, created_at);

CREATE TRIGGER production_queue_updated_at
  BEFORE UPDATE ON public.production_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
