-- Migration 007: Create step_field_templates table (global reusable field definitions)
CREATE TABLE public.step_field_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  label varchar(255) NOT NULL,
  field_type varchar(30) NOT NULL CHECK (field_type IN ('text', 'number', 'checkbox', 'select', 'textarea')),
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
