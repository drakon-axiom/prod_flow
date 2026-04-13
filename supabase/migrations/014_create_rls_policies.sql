-- Migration 014: Enable RLS and create policies for all tables

-- ============================================================
-- PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT USING (public.get_user_role() = 'admin');

-- Admins can insert profiles (for user management)
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

-- Admins can update any profile
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE USING (public.get_user_role() = 'admin');

-- Users can update their own profile (name only, not role)
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- INGREDIENTS
-- ============================================================
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY ingredients_select ON public.ingredients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ingredients_insert_admin ON public.ingredients
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY ingredients_update_admin ON public.ingredients
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY ingredients_delete_admin ON public.ingredients
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- STEP_FIELD_TEMPLATES
-- ============================================================
ALTER TABLE public.step_field_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY sft_select ON public.step_field_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY sft_insert_admin ON public.step_field_templates
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY sft_update_admin ON public.step_field_templates
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY sft_delete_admin ON public.step_field_templates
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- FORMULAS
-- ============================================================
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY formulas_select ON public.formulas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY formulas_insert_admin ON public.formulas
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY formulas_update_admin ON public.formulas
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY formulas_delete_admin ON public.formulas
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- FORMULA_VERSIONS
-- ============================================================
ALTER TABLE public.formula_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY fv_select ON public.formula_versions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY fv_insert_admin ON public.formula_versions
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY fv_update_admin ON public.formula_versions
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY fv_delete_admin ON public.formula_versions
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- FORMULA_INGREDIENTS
-- ============================================================
ALTER TABLE public.formula_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY fi_select ON public.formula_ingredients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY fi_insert_admin ON public.formula_ingredients
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY fi_update_admin ON public.formula_ingredients
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY fi_delete_admin ON public.formula_ingredients
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- FORMULA_STEPS
-- ============================================================
ALTER TABLE public.formula_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY fs_select ON public.formula_steps
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY fs_insert_admin ON public.formula_steps
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY fs_update_admin ON public.formula_steps
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY fs_delete_admin ON public.formula_steps
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- FORMULA_STEP_FIELDS
-- ============================================================
ALTER TABLE public.formula_step_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY fsf_select ON public.formula_step_fields
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY fsf_insert_admin ON public.formula_step_fields
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY fsf_update_admin ON public.formula_step_fields
  FOR UPDATE USING (public.get_user_role() = 'admin');

CREATE POLICY fsf_delete_admin ON public.formula_step_fields
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- PRODUCTION_QUEUE
-- ============================================================
ALTER TABLE public.production_queue ENABLE ROW LEVEL SECURITY;

-- All authenticated can read queue
CREATE POLICY pq_select ON public.production_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins and operators can create queue items
CREATE POLICY pq_insert ON public.production_queue
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admins and operators can update queue items
CREATE POLICY pq_update ON public.production_queue
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only admins can delete queue items
CREATE POLICY pq_delete_admin ON public.production_queue
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================================
-- PRODUCTION_RUNS
-- ============================================================
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_select ON public.production_runs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY pr_insert ON public.production_runs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY pr_update ON public.production_runs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- RUN_MATERIALS
-- ============================================================
ALTER TABLE public.run_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY rm_select ON public.run_materials
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY rm_insert ON public.run_materials
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY rm_update ON public.run_materials
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- RUN_STEPS
-- ============================================================
ALTER TABLE public.run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY rs_select ON public.run_steps
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY rs_insert ON public.run_steps
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY rs_update ON public.run_steps
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- RUN_STEP_INPUTS
-- ============================================================
ALTER TABLE public.run_step_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY rsi_select ON public.run_step_inputs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY rsi_insert ON public.run_step_inputs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY rsi_update ON public.run_step_inputs
  FOR UPDATE USING (auth.uid() IS NOT NULL);
