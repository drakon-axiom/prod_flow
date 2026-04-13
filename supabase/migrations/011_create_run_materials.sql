-- Migration 011: Create run_materials table (snapshot of scaled ingredients)
CREATE TABLE public.run_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.production_runs(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id),
  ingredient_name varchar(255) NOT NULL,
  sku varchar(100),
  unit varchar(50) NOT NULL,
  base_quantity numeric(12,4) NOT NULL,
  scaled_quantity numeric(12,4) NOT NULL,
  actual_quantity numeric(12,4),
  sort_order integer NOT NULL DEFAULT 0
);
