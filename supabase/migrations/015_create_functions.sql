-- Migration 015: Create RPC functions for production workflow

-- ============================================================
-- start_production_run: Atomic snapshot creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_production_run(
  p_queue_item_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_item record;
  v_formula record;
  v_version record;
  v_run_id uuid;
  v_scale_factor numeric(12,6);
  v_ingredient record;
  v_step record;
  v_run_step_id uuid;
  v_field record;
BEGIN
  -- Lock and validate queue item
  SELECT * INTO v_queue_item
    FROM public.production_queue
    WHERE id = p_queue_item_id
    FOR UPDATE;

  IF v_queue_item IS NULL THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;

  IF v_queue_item.status NOT IN ('queued', 'ready') THEN
    RAISE EXCEPTION 'Queue item is not in a startable state (current: %)', v_queue_item.status;
  END IF;

  -- Get formula
  SELECT * INTO v_formula
    FROM public.formulas
    WHERE id = v_queue_item.formula_id;

  IF v_formula IS NULL THEN
    RAISE EXCEPTION 'Formula not found';
  END IF;

  -- Get formula version
  SELECT * INTO v_version
    FROM public.formula_versions
    WHERE id = v_queue_item.formula_version_id;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Formula version not found';
  END IF;

  -- Compute scale factor
  v_scale_factor := v_queue_item.batch_size / v_version.base_batch_size;

  -- Create production run (snapshot)
  INSERT INTO public.production_runs (
    queue_item_id, formula_id, formula_version_id,
    formula_name, product_name, version_number,
    batch_size, base_batch_size, base_batch_unit, scale_factor,
    status, current_step_index, started_by, notes
  ) VALUES (
    p_queue_item_id, v_queue_item.formula_id, v_queue_item.formula_version_id,
    v_formula.name, v_formula.product_name, v_version.version_number,
    v_queue_item.batch_size, v_version.base_batch_size, v_version.base_batch_unit, v_scale_factor,
    'in_progress', 0, p_user_id, v_queue_item.notes
  ) RETURNING id INTO v_run_id;

  -- Snapshot materials (scaled ingredients)
  FOR v_ingredient IN
    SELECT fi.*, i.name AS ingredient_name, i.sku, i.unit
    FROM public.formula_ingredients fi
    JOIN public.ingredients i ON i.id = fi.ingredient_id
    WHERE fi.formula_version_id = v_queue_item.formula_version_id
    ORDER BY fi.sort_order
  LOOP
    INSERT INTO public.run_materials (
      run_id, ingredient_id, ingredient_name, sku, unit,
      base_quantity, scaled_quantity, sort_order
    ) VALUES (
      v_run_id, v_ingredient.ingredient_id, v_ingredient.ingredient_name,
      v_ingredient.sku, v_ingredient.unit,
      v_ingredient.quantity, v_ingredient.quantity * v_scale_factor,
      v_ingredient.sort_order
    );
  END LOOP;

  -- Snapshot steps and their fields
  FOR v_step IN
    SELECT * FROM public.formula_steps
    WHERE formula_version_id = v_queue_item.formula_version_id
    ORDER BY sort_order
  LOOP
    INSERT INTO public.run_steps (
      run_id, step_number, title, instructions,
      requires_confirmation, requires_quantity_entry,
      status, sort_order
    ) VALUES (
      v_run_id, v_step.step_number, v_step.title, v_step.instructions,
      v_step.requires_confirmation, v_step.requires_quantity_entry,
      'pending', v_step.sort_order
    ) RETURNING id INTO v_run_step_id;

    -- Snapshot step fields
    FOR v_field IN
      SELECT * FROM public.formula_step_fields
      WHERE formula_step_id = v_step.id
      ORDER BY sort_order
    LOOP
      INSERT INTO public.run_step_inputs (
        run_step_id, label, field_type, options, is_required, sort_order
      ) VALUES (
        v_run_step_id, v_field.label, v_field.field_type,
        v_field.options, v_field.is_required, v_field.sort_order
      );
    END LOOP;
  END LOOP;

  -- Update queue item status
  UPDATE public.production_queue
    SET status = 'in_progress', assigned_to = p_user_id
    WHERE id = p_queue_item_id;

  RETURN v_run_id;
END;
$$;

-- ============================================================
-- complete_run_step: Validate and complete a step
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_run_step(
  p_run_id uuid,
  p_step_id uuid,
  p_user_id uuid,
  p_inputs jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run record;
  v_step record;
  v_total_steps integer;
  v_input record;
  v_input_value jsonb;
BEGIN
  -- Lock the run row
  SELECT * INTO v_run
    FROM public.production_runs
    WHERE id = p_run_id
    FOR UPDATE;

  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Production run not found';
  END IF;

  IF v_run.status != 'in_progress' THEN
    RAISE EXCEPTION 'Run is not in progress (current: %)', v_run.status;
  END IF;

  -- Get the step
  SELECT * INTO v_step
    FROM public.run_steps
    WHERE id = p_step_id AND run_id = p_run_id;

  IF v_step IS NULL THEN
    RAISE EXCEPTION 'Step not found in this run';
  END IF;

  -- Validate step is the current one (no skipping)
  IF v_step.sort_order != v_run.current_step_index THEN
    RAISE EXCEPTION 'Cannot complete step out of order. Expected index %, got %',
      v_run.current_step_index, v_step.sort_order;
  END IF;

  IF v_step.status = 'completed' THEN
    RAISE EXCEPTION 'Step is already completed';
  END IF;

  -- Update input values from the provided JSON
  -- p_inputs format: [{"id": "uuid", "value": "string"}, ...]
  FOR v_input_value IN SELECT * FROM jsonb_array_elements(p_inputs)
  LOOP
    UPDATE public.run_step_inputs
      SET value = v_input_value->>'value'
      WHERE id = (v_input_value->>'id')::uuid
        AND run_step_id = p_step_id;
  END LOOP;

  -- Validate required inputs have values
  IF EXISTS (
    SELECT 1 FROM public.run_step_inputs
    WHERE run_step_id = p_step_id
      AND is_required = true
      AND (value IS NULL OR value = '')
  ) THEN
    RAISE EXCEPTION 'All required fields must be filled';
  END IF;

  -- Mark step completed
  UPDATE public.run_steps SET
    status = 'completed',
    started_at = COALESCE(started_at, now()),
    completed_at = now(),
    completed_by = p_user_id
  WHERE id = p_step_id;

  -- Count total steps
  SELECT count(*) INTO v_total_steps
    FROM public.run_steps
    WHERE run_id = p_run_id;

  -- Advance step index
  IF (v_run.current_step_index + 1) >= v_total_steps THEN
    -- Last step — complete the run
    UPDATE public.production_runs SET
      status = 'completed',
      current_step_index = v_run.current_step_index + 1,
      completed_at = now(),
      completed_by = p_user_id
    WHERE id = p_run_id;

    -- Also mark queue item as completed
    IF v_run.queue_item_id IS NOT NULL THEN
      UPDATE public.production_queue
        SET status = 'completed'
        WHERE id = v_run.queue_item_id;
    END IF;
  ELSE
    -- Advance to next step
    UPDATE public.production_runs SET
      current_step_index = v_run.current_step_index + 1
    WHERE id = p_run_id;
  END IF;

  -- Return updated step data
  RETURN jsonb_build_object(
    'step_id', p_step_id,
    'status', 'completed',
    'run_completed', (v_run.current_step_index + 1) >= v_total_steps,
    'next_step_index', v_run.current_step_index + 1
  );
END;
$$;

-- ============================================================
-- calculate_batch: Read-only scaling preview
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_batch(
  p_formula_version_id uuid,
  p_batch_size numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_version record;
  v_scale_factor numeric(12,6);
  v_materials jsonb;
BEGIN
  SELECT * INTO v_version
    FROM public.formula_versions
    WHERE id = p_formula_version_id;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Formula version not found';
  END IF;

  v_scale_factor := p_batch_size / v_version.base_batch_size;

  SELECT jsonb_agg(jsonb_build_object(
    'ingredient_id', i.id,
    'ingredient_name', i.name,
    'unit', i.unit,
    'base_quantity', fi.quantity,
    'scaled_quantity', fi.quantity * v_scale_factor
  ) ORDER BY fi.sort_order)
  INTO v_materials
  FROM public.formula_ingredients fi
  JOIN public.ingredients i ON i.id = fi.ingredient_id
  WHERE fi.formula_version_id = p_formula_version_id;

  RETURN jsonb_build_object(
    'formula_version_id', p_formula_version_id,
    'base_batch_size', v_version.base_batch_size,
    'base_batch_unit', v_version.base_batch_unit,
    'requested_batch_size', p_batch_size,
    'scale_factor', v_scale_factor,
    'materials', COALESCE(v_materials, '[]'::jsonb)
  );
END;
$$;
