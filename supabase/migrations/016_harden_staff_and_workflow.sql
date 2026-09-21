-- Forward security remediation. Apply with the matching frontend release.
-- No lot, inventory, billing or production-history data is rewritten.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.role::text FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = auth.uid() AND p.is_active AND p.role IN ('admin', 'operator')
    AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
$$;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
ALTER FUNCTION public.handle_updated_at() SET search_path = '';
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.security_events TO authenticated;
CREATE POLICY security_events_admin_read ON public.security_events FOR SELECT TO authenticated
USING (public.get_user_role() = 'admin');
-- The tracked Edge handler must append audit events but never rewrite them,
-- even when a deployment's default privileges granted service_role all DML.
REVOKE UPDATE, DELETE, TRUNCATE ON public.security_events FROM service_role;
GRANT INSERT ON public.security_events TO service_role;
GRANT INSERT ON public.profiles TO service_role;

-- Replace this application's permissive policies, including any old insert/update
-- snapshot policies. Unknown policies on these tables must not OR around the guard.
DO $$
DECLARE p record; t text; c record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(ARRAY[
      'profiles','ingredients','step_field_templates','formulas','formula_versions',
      'formula_ingredients','formula_steps','formula_step_fields','production_queue',
      'production_runs','run_materials','run_steps','run_step_inputs'])
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname,p.schemaname,p.tablename); END LOOP;
  FOREACH t IN ARRAY ARRAY['profiles','ingredients','step_field_templates','formulas',
    'formula_versions','formula_ingredients','formula_steps','formula_step_fields',
    'production_queue','production_runs','run_materials','run_steps','run_step_inputs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    -- Table-level revocation does not remove prior column grants.
    FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=t
    LOOP
      EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.%I FROM PUBLIC, anon, authenticated',
        c.column_name,c.column_name,c.column_name,c.column_name,t);
    END LOOP;
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    IF t <> 'profiles' THEN
      EXECUTE format('CREATE POLICY active_staff_read ON public.%I FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL)', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['ingredients','step_field_templates','formulas','formula_versions',
    'formula_ingredients','formula_steps','formula_step_fields']
  LOOP
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY active_admin_write ON public.%I FOR ALL TO authenticated USING (public.get_user_role() = ''admin'') WITH CHECK (public.get_user_role() = ''admin'')', t);
  END LOOP;
END $$;

CREATE POLICY active_profile_read ON public.profiles FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL AND (id=auth.uid() OR public.get_user_role()='admin'));
GRANT UPDATE(name) ON public.profiles TO authenticated;
CREATE POLICY active_profile_own_name ON public.profiles FOR UPDATE TO authenticated
  USING (public.get_user_role() IS NOT NULL AND id=auth.uid())
  WITH CHECK (public.get_user_role() IS NOT NULL AND id=auth.uid());

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid, p_name text DEFAULT NULL, p_role text DEFAULT NULL, p_is_active boolean DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_old public.profiles%ROWTYPE; v_new public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Active administrator access is required' USING ERRCODE='42501';
  END IF;
  -- One lock for every access change, before reading the target. Without this,
  -- two administrators can each authorize a change that disables the other.
  PERFORM pg_advisory_xact_lock(72390402);
  IF public.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Active administrator access is required' USING ERRCODE='42501';
  END IF;
  IF p_name IS NOT NULL AND (btrim(p_name)='' OR length(p_name)>255) THEN
    RAISE EXCEPTION 'Enter a name between 1 and 255 characters';
  END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('operator','admin') THEN RAISE EXCEPTION 'Choose a valid role'; END IF;
  SELECT * INTO v_old FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff profile not found'; END IF;
  IF v_old.role='admin' AND v_old.is_active
    AND (COALESCE(p_role,v_old.role)<>'admin' OR NOT COALESCE(p_is_active,v_old.is_active))
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
      WHERE p.id<>p_user_id AND p.role='admin' AND p.is_active
        AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
    ) THEN
    RAISE EXCEPTION 'Keep at least one eligible active administrator';
  END IF;
  -- Avoid accidentally locking out the administrator using this screen.
  IF p_user_id=auth.uid() AND (p_role='operator' OR p_is_active=false) THEN
    RAISE EXCEPTION 'Ask another administrator to change your own access';
  END IF;
  UPDATE public.profiles SET name=COALESCE(btrim(p_name),name),
    role=COALESCE(p_role,role),is_active=COALESCE(p_is_active,is_active)
    WHERE id=p_user_id RETURNING * INTO v_new;
  INSERT INTO public.security_events(actor_id,action,target_id,details)
    VALUES(auth.uid(),'profile_updated',p_user_id,jsonb_build_object('before',to_jsonb(v_old),'after',to_jsonb(v_new)));
END $$;
REVOKE ALL ON FUNCTION public.admin_update_profile(uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid,text,text,boolean) TO authenticated;

-- A queue item may be edited/deleted only before a run exists. Keep the queue
-- reference on every started run; do not detach it to delete production history.
GRANT INSERT, UPDATE, DELETE ON public.production_queue TO authenticated;
CREATE POLICY active_queue_insert ON public.production_queue FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IS NOT NULL AND requested_by=auth.uid()
    AND status IN ('queued','ready') AND batch_size>0 AND batch_size::text<>'NaN');
CREATE POLICY active_queue_update ON public.production_queue FOR UPDATE TO authenticated
  USING (public.get_user_role() IS NOT NULL AND status IN ('queued','ready')
    AND NOT EXISTS (SELECT 1 FROM public.production_runs r WHERE r.queue_item_id=production_queue.id))
  WITH CHECK (public.get_user_role() IS NOT NULL AND status IN ('queued','ready','cancelled')
    AND batch_size>0 AND batch_size::text<>'NaN');
CREATE POLICY active_queue_delete ON public.production_queue FOR DELETE TO authenticated
  USING (public.get_user_role()='admin' AND status IN ('queued','ready','cancelled')
    AND NOT EXISTS (SELECT 1 FROM public.production_runs r WHERE r.queue_item_id=production_queue.id));

CREATE OR REPLACE FUNCTION public.guard_queue_requester()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
    RAISE EXCEPTION 'The original requester cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER queue_requester_immutable BEFORE UPDATE ON public.production_queue
  FOR EACH ROW EXECUTE FUNCTION public.guard_queue_requester();
REVOKE ALL ON FUNCTION public.guard_queue_requester() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.run_steps ADD COLUMN confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.run_steps ADD COLUMN entered_quantity numeric;

CREATE OR REPLACE FUNCTION public.start_production_run(
  p_queue_item_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_existing uuid;
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
  IF v_actor IS NULL OR public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'Active staff access is required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'The recorded actor must match your session' USING ERRCODE = '42501';
  END IF;
  -- Lock and validate queue item
  SELECT * INTO v_queue_item
    FROM public.production_queue
    WHERE id = p_queue_item_id
    FOR UPDATE;

  IF v_queue_item IS NULL THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;

  SELECT id INTO v_existing FROM public.production_runs WHERE queue_item_id = p_queue_item_id ORDER BY started_at LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

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

  IF v_version IS NULL OR v_version.formula_id IS DISTINCT FROM v_queue_item.formula_id THEN
    RAISE EXCEPTION 'Formula version not found';
  END IF;

  IF NOT v_formula.is_active OR v_queue_item.batch_size <= 0 OR v_version.base_batch_size <= 0
    OR v_queue_item.batch_size::text IN ('NaN','Infinity','-Infinity')
    OR v_version.base_batch_size::text IN ('NaN','Infinity','-Infinity')
    OR v_queue_item.batch_unit IS DISTINCT FROM v_version.base_batch_unit THEN
    RAISE EXCEPTION 'Choose an active formula and a positive batch size in its configured unit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formula_steps WHERE formula_version_id = v_version.id) THEN
    RAISE EXCEPTION 'Add production steps to the formula before starting';
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
    'in_progress', 0, v_actor, v_queue_item.notes
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
    SELECT *, (row_number() OVER (ORDER BY sort_order, id) - 1)::integer AS run_order FROM public.formula_steps
    WHERE formula_version_id = v_queue_item.formula_version_id
    ORDER BY sort_order, id
  LOOP
    INSERT INTO public.run_steps (
      run_id, step_number, title, instructions,
      requires_confirmation, requires_quantity_entry,
      status, sort_order
    ) VALUES (
      v_run_id, v_step.step_number, v_step.title, v_step.instructions,
      v_step.requires_confirmation, v_step.requires_quantity_entry,
      'pending', v_step.run_order
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
    SET status = 'in_progress', assigned_to = v_actor
    WHERE id = p_queue_item_id;

  INSERT INTO public.security_events(actor_id, action, target_id, details)
    VALUES (v_actor, 'run_started', v_run_id, jsonb_build_object('queue_item_id', p_queue_item_id));
  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_production_run(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_production_run(uuid,uuid) TO authenticated;

-- Replace the four-argument function with defaulted confirmation/quantity args.
-- Old callers still resolve it, but must provide evidence for required controls.
DROP FUNCTION public.complete_run_step(uuid,uuid,uuid,jsonb);
CREATE FUNCTION public.complete_run_step(
  p_run_id uuid, p_step_id uuid, p_user_id uuid DEFAULT NULL,
  p_inputs jsonb DEFAULT '[]'::jsonb, p_confirmed boolean DEFAULT false,
  p_quantity numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_run public.production_runs%ROWTYPE;
  v_step public.run_steps%ROWTYPE;
  v_input public.run_step_inputs%ROWTYPE;
  v_value jsonb; v_text text; v_number numeric; v_total integer;
  v_payload jsonb; v_previous jsonb;
BEGIN
  IF v_actor IS NULL OR public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'Active staff access is required' USING ERRCODE='42501';
  END IF;
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'The recorded actor must match your session' USING ERRCODE='42501';
  END IF;
  IF p_inputs IS NULL OR jsonb_typeof(p_inputs)<>'array' OR jsonb_array_length(p_inputs)>200 THEN
    RAISE EXCEPTION 'Submit a valid list of step values';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_inputs) e
    WHERE jsonb_typeof(e)<>'object' OR jsonb_typeof(e->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(e->'value') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Each step value needs its field ID and a text value';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_inputs)) <>
     (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(p_inputs) e) THEN
    RAISE EXCEPTION 'A step field was submitted more than once';
  END IF;
  SELECT * INTO v_run FROM public.production_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production run not found'; END IF;
  SELECT * INTO v_step FROM public.run_steps WHERE id=p_step_id AND run_id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Step not found in this run'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_inputs) e
    WHERE NOT EXISTS (SELECT 1 FROM public.run_step_inputs i
      WHERE i.id::text=e->>'id' AND i.run_step_id=p_step_id)) THEN
    RAISE EXCEPTION 'A submitted field does not belong to this step';
  END IF;
  SELECT COALESCE(jsonb_agg(e ORDER BY e->>'id'),'[]'::jsonb)
    INTO v_payload FROM jsonb_array_elements(p_inputs) e;
  -- Retry is safe only with exactly the original payload and actor.
  IF v_step.status='completed' THEN
    SELECT details INTO v_previous FROM public.security_events
      WHERE action='step_completed' AND target_id=p_step_id ORDER BY occurred_at DESC LIMIT 1;
    IF v_step.completed_by=v_actor AND v_previous->'inputs'=v_payload
      AND v_step.confirmed=COALESCE(p_confirmed,false)
      AND v_step.entered_quantity IS NOT DISTINCT FROM p_quantity THEN
      RETURN jsonb_build_object('step_id',p_step_id,'status','completed',
        'run_completed',v_run.status='completed','next_step_index',v_run.current_step_index);
    END IF;
    RAISE EXCEPTION 'This step is already completed; its recorded results cannot be replaced';
  END IF;
  IF v_run.status<>'in_progress' THEN RAISE EXCEPTION 'Resume an active run before completing a step'; END IF;
  IF v_step.sort_order<>v_run.current_step_index THEN RAISE EXCEPTION 'Complete the current step first'; END IF;
  IF v_step.requires_confirmation AND p_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirm that you completed this step';
  END IF;
  IF (v_step.requires_quantity_entry AND p_quantity IS NULL) OR
     (p_quantity IS NOT NULL AND (p_quantity<0 OR p_quantity::text IN ('NaN','Infinity','-Infinity'))) THEN
    RAISE EXCEPTION 'Enter a finite, nonnegative quantity for this step';
  END IF;

  FOR v_input IN SELECT * FROM public.run_step_inputs WHERE run_step_id=p_step_id ORDER BY sort_order,id
  LOOP
    SELECT e INTO v_value FROM jsonb_array_elements(p_inputs) e WHERE e->>'id'=v_input.id::text;
    v_text := v_value->>'value';
    IF v_text IS NOT NULL AND length(v_text)>10000 THEN RAISE EXCEPTION 'A step value is too long'; END IF;
    IF v_input.is_required AND (v_text IS NULL OR btrim(v_text)='') THEN
      RAISE EXCEPTION 'Complete the required field: %',v_input.label;
    END IF;
    IF v_input.field_type='checkbox' THEN
      IF v_input.is_required AND v_text IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Confirm the required checkbox: %',v_input.label;
      END IF;
      IF COALESCE(v_text,'') NOT IN ('','true','false') THEN RAISE EXCEPTION 'Invalid checkbox value'; END IF;
    ELSIF v_input.field_type='number' AND COALESCE(btrim(v_text),'')<>'' THEN
      IF v_text !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' THEN
        RAISE EXCEPTION 'Enter a valid number for: %',v_input.label;
      END IF;
      v_number := v_text::numeric;
      IF v_number::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a finite number'; END IF;
      IF jsonb_typeof(v_input.options->'min')='number' AND v_number<(v_input.options->>'min')::numeric THEN
        RAISE EXCEPTION 'The value is below the minimum for: %',v_input.label;
      END IF;
      IF jsonb_typeof(v_input.options->'max')='number' AND v_number>(v_input.options->>'max')::numeric THEN
        RAISE EXCEPTION 'The value is above the maximum for: %',v_input.label;
      END IF;
    ELSIF v_input.field_type='select' AND COALESCE(v_text,'')<>'' THEN
      IF jsonb_typeof(v_input.options->'options') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Ask an administrator to configure choices for: %',v_input.label;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_input.options->'options') opt
        WHERE jsonb_typeof(opt)='string' AND opt=to_jsonb(v_text)) THEN
        RAISE EXCEPTION 'Choose an available option for: %',v_input.label;
      END IF;
    ELSIF v_input.field_type NOT IN ('text','textarea','number','select','checkbox') THEN
      RAISE EXCEPTION 'This field type needs administrator review';
    END IF;
    UPDATE public.run_step_inputs SET value=v_text WHERE id=v_input.id;
  END LOOP;
  UPDATE public.run_steps SET status='completed', started_at=COALESCE(started_at,now()),
    completed_at=now(),completed_by=v_actor,confirmed=COALESCE(p_confirmed,false),entered_quantity=p_quantity
    WHERE id=p_step_id;
  SELECT count(*) INTO v_total FROM public.run_steps WHERE run_id=p_run_id;
  IF v_run.current_step_index+1>=v_total THEN
    UPDATE public.production_runs SET status='completed',current_step_index=current_step_index+1,
      completed_at=now(),completed_by=v_actor WHERE id=p_run_id;
    UPDATE public.production_queue SET status='completed' WHERE id=v_run.queue_item_id;
  ELSE
    UPDATE public.production_runs SET current_step_index=current_step_index+1 WHERE id=p_run_id;
  END IF;
  INSERT INTO public.security_events(actor_id,action,target_id,details)
    VALUES(v_actor,'step_completed',p_step_id,jsonb_build_object('run_id',p_run_id,'inputs',v_payload,
      'confirmed',COALESCE(p_confirmed,false),'quantity',p_quantity));
  RETURN jsonb_build_object('step_id',p_step_id,'status','completed',
    'run_completed',v_run.current_step_index+1>=v_total,'next_step_index',v_run.current_step_index+1);
END $$;
REVOKE ALL ON FUNCTION public.complete_run_step(uuid,uuid,uuid,jsonb,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_run_step(uuid,uuid,uuid,jsonb,boolean,numeric) TO authenticated;

CREATE FUNCTION public.change_run_status(p_run_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_run public.production_runs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'Active staff access is required' USING ERRCODE='42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('paused','in_progress','cancelled') THEN
    RAISE EXCEPTION 'Choose pause, resume, or cancel';
  END IF;
  SELECT * INTO v_run FROM public.production_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production run not found'; END IF;
  IF v_run.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'A finished run cannot be changed'; END IF;
  IF v_run.status=p_status THEN RETURN; END IF;
  UPDATE public.production_runs SET status=p_status WHERE id=p_run_id;
  UPDATE public.production_queue SET status=p_status WHERE id=v_run.queue_item_id;
  INSERT INTO public.security_events(actor_id,action,target_id,details)
    VALUES(auth.uid(),'run_status_changed',p_run_id,jsonb_build_object('from',v_run.status,'to',p_status));
END $$;
REVOKE ALL ON FUNCTION public.change_run_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_run_status(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.calculate_batch(p_formula_version_id uuid,p_batch_size numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_version public.formula_versions%ROWTYPE; v_scale numeric; v_materials jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS NULL THEN
    RAISE EXCEPTION 'Active staff access is required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_version FROM public.formula_versions WHERE id=p_formula_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Formula version not found'; END IF;
  IF p_batch_size IS NULL OR p_batch_size<=0 OR p_batch_size::text IN ('NaN','Infinity','-Infinity')
    OR v_version.base_batch_size<=0 OR v_version.base_batch_size::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Enter a positive, finite batch size';
  END IF;
  v_scale := p_batch_size/v_version.base_batch_size;
  SELECT jsonb_agg(jsonb_build_object('ingredient_id',i.id,'ingredient_name',i.name,'unit',i.unit,
    'base_quantity',fi.quantity,'scaled_quantity',fi.quantity*v_scale) ORDER BY fi.sort_order)
    INTO v_materials FROM public.formula_ingredients fi JOIN public.ingredients i ON i.id=fi.ingredient_id
    WHERE fi.formula_version_id=p_formula_version_id;
  RETURN jsonb_build_object('formula_version_id',p_formula_version_id,'base_batch_size',v_version.base_batch_size,
    'base_batch_unit',v_version.base_batch_unit,'requested_batch_size',p_batch_size,
    'scale_factor',v_scale,'materials',COALESCE(v_materials,'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.calculate_batch(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.calculate_batch(uuid,numeric) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
