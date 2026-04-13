-- Migration 003: Create formulas table
CREATE TABLE public.formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  product_name varchar(255) NOT NULL,
  description text,
  current_version_id uuid, -- FK added in migration 004 after formula_versions exists
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER formulas_updated_at
  BEFORE UPDATE ON public.formulas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
