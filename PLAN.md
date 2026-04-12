# ProdFlow — Production Management System MVP

## Context

A small manufacturing operation needs a lightweight web app to manage their production workflow: tracking orders in a queue, executing production runs step-by-step with material tracking, and managing formulas/ingredients. Backend powered by Supabase (hosted PostgreSQL, Auth, RLS). Frontend is a React SPA deployed behind nginx on Ubuntu 24.04. Future integration planned with "Wholesale Connect" Supabase project.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Database + API | **Supabase** (hosted PG 17, PostgREST, Auth) | Eliminates custom backend, built-in auth + RLS, already in user's infra |
| Auth | **Supabase Auth** | Built-in JWT, email/password, row-level security |
| RBAC | **RLS policies + user metadata** | Role stored in `app_metadata`, enforced at DB level |
| Complex logic | **PostgreSQL functions** (via Supabase RPC) | Atomic transactions for run snapshots, batch calculations |
| Frontend | **React 18 + Vite + TypeScript** | Fast DX, production-proven |
| UI | **Tailwind CSS 4 + Headless UI** | Lightweight, mobile-first, no bloat |
| Data fetching | **TanStack Query + Supabase JS client** | Caching, auth token management built-in |
| Validation | **Zod** | Client-side form + data validation |
| Deployment | **Static build behind nginx** | No Node server process needed |

**What we eliminated by using Supabase:**
- No Express server
- No custom JWT/auth middleware
- No bcrypt password handling
- No Knex migrations (use Supabase migrations instead)
- No systemd service for API
- No server hosting/process management

---

## Supabase Setup

- **Organization**: ACG - PROD (`ywnoqusyfuzcfepnwcob`)
- **New project**: "ProdFlow" in `us-east-1`
- **Future integration**: "Wholesale Connect" project (`brszcewjgrdimhjmibiv`) — queue items will eventually come from there via external_order_id

---

## Folder Structure

```
/apps/prod_flow/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  tailwind.config.ts
  postcss.config.js
  .env.example                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  .gitignore
  nginx/prodflow.conf
  supabase/
    migrations/                   # SQL migrations applied via Supabase MCP
      001_create_users_profile.sql
      002_create_ingredients.sql
      003_create_formulas.sql
      004_create_formula_versions.sql
      005_create_formula_ingredients.sql
      006_create_formula_steps.sql
      007_create_step_field_templates.sql
      008_create_formula_step_fields.sql
      009_create_production_queue.sql
      010_create_production_runs.sql
      011_create_run_materials.sql
      012_create_run_steps.sql
      013_create_run_step_inputs.sql
      014_create_rls_policies.sql
      015_create_functions.sql     # RPC functions (snapshot, batch calc)
    seed.sql                       # Sample data
  src/
    main.tsx
    App.tsx
    lib/
      supabase.ts                  # Supabase client init
      database.types.ts            # Generated types from Supabase
    types/
      index.ts                     # App-level type definitions
      constants.ts                 # Roles, statuses, field types
    hooks/
      useAuth.ts
      useCurrentRun.ts
      useRequireRole.ts
    context/
      AuthContext.tsx
    api/
      ingredients.ts               # TanStack Query hooks wrapping Supabase calls
      formulas.ts
      production-queue.ts
      production-runs.ts
      users.ts
      field-templates.ts
      dashboard.ts
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      queue/
        QueuePage.tsx
      runs/
        RunsListPage.tsx
        RunDetailPage.tsx
        ActiveRunPage.tsx           # Core guided step-by-step execution
      admin/
        ingredients/
          IngredientsListPage.tsx
          IngredientFormPage.tsx
        formulas/
          FormulasListPage.tsx
          FormulaDetailPage.tsx
          FormulaEditorPage.tsx
        users/
          UsersListPage.tsx
          UserFormPage.tsx
        field-templates/
          FieldTemplatesPage.tsx
    components/
      layout/
        AppShell.tsx
        Sidebar.tsx
        MobileNav.tsx
        ProtectedRoute.tsx
      ui/
        Button.tsx
        Input.tsx
        Select.tsx
        Card.tsx
        Badge.tsx
        Modal.tsx
        DataTable.tsx
        LoadingSpinner.tsx
        EmptyState.tsx
        Toast.tsx
      formulas/
        IngredientRow.tsx
        StepCard.tsx
        StepFieldEditor.tsx
      runs/
        StepExecutionCard.tsx
        MaterialsChecklist.tsx
        RunProgressBar.tsx
    utils/
      format.ts                    # Number/date formatting
      batch-calc.ts                # Client-side batch scaling
      cn.ts                        # Tailwind class merge utility
```

---

## Database Schema

### profiles (extends Supabase auth.users)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References auth.users(id) ON DELETE CASCADE |
| name | varchar(255) | NOT NULL |
| role | varchar(20) | NOT NULL, CHECK IN ('admin','operator'), DEFAULT 'operator' |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### ingredients
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| name | varchar(255) | NOT NULL |
| sku | varchar(100) | NULLABLE |
| unit | varchar(50) | NOT NULL |
| density | numeric(12,6) | NULLABLE |
| cost_per_unit | numeric(12,4) | NULLABLE |
| notes | text | NULLABLE |
| is_active | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | |

### formulas
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | varchar(255) | NOT NULL |
| product_name | varchar(255) | NOT NULL |
| description | text | NULLABLE |
| current_version_id | uuid FK->formula_versions | NULLABLE |
| is_active | boolean | DEFAULT true |
| created_at / updated_at | timestamptz | |

### formula_versions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| formula_id | uuid FK->formulas | ON DELETE CASCADE |
| version_number | integer | NOT NULL |
| base_batch_size | numeric(12,4) | NOT NULL |
| base_batch_unit | varchar(50) | NOT NULL |
| notes | text | NULLABLE |
| created_by | uuid FK->auth.users | |
| created_at | timestamptz | |

UNIQUE(formula_id, version_number)

### formula_ingredients
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| formula_version_id | uuid FK->formula_versions | ON DELETE CASCADE |
| ingredient_id | uuid FK->ingredients | |
| quantity | numeric(12,4) | NOT NULL |
| sort_order | integer | DEFAULT 0 |
| notes | text | NULLABLE |

UNIQUE(formula_version_id, ingredient_id)

### formula_steps
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| formula_version_id | uuid FK->formula_versions | ON DELETE CASCADE |
| step_number | integer | NOT NULL |
| title | varchar(255) | NOT NULL |
| instructions | text | NULLABLE |
| requires_confirmation | boolean | DEFAULT true |
| requires_quantity_entry | boolean | DEFAULT false |
| sort_order | integer | NOT NULL |

### step_field_templates (global reusable fields)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | varchar(255) | NOT NULL |
| label | varchar(255) | NOT NULL |
| field_type | varchar(30) | CHECK IN ('text','number','checkbox','select','textarea') |
| options | jsonb | NULLABLE |
| is_required | boolean | DEFAULT false |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | |

### formula_step_fields
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| formula_step_id | uuid FK->formula_steps | ON DELETE CASCADE |
| template_id | uuid FK->step_field_templates | NULLABLE |
| label | varchar(255) | NOT NULL |
| field_type | varchar(30) | NOT NULL |
| options | jsonb | NULLABLE |
| is_required | boolean | DEFAULT false |
| sort_order | integer | DEFAULT 0 |

### production_queue
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| formula_id | uuid FK->formulas | |
| formula_version_id | uuid FK->formula_versions | |
| batch_size | numeric(12,4) | NOT NULL |
| batch_unit | varchar(50) | NOT NULL |
| priority | integer | DEFAULT 0 |
| status | varchar(30) | DEFAULT 'queued'. CHECK IN ('queued','ready','in_progress','paused','completed','cancelled') |
| due_date | timestamptz | NULLABLE |
| notes | text | NULLABLE |
| external_order_id | varchar(255) | NULLABLE, for Wholesale Connect integration |
| assigned_to | uuid FK->auth.users | NULLABLE |
| requested_by | uuid FK->auth.users | NOT NULL |
| created_at / updated_at | timestamptz | |

Index: (status, priority DESC, due_date, created_at)

### production_runs (immutable snapshot)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| queue_item_id | uuid FK->production_queue | NULLABLE |
| formula_id | uuid FK->formulas | Reference only |
| formula_version_id | uuid FK->formula_versions | Reference only |
| formula_name | varchar(255) | Snapshot |
| product_name | varchar(255) | Snapshot |
| version_number | integer | Snapshot |
| batch_size | numeric(12,4) | |
| base_batch_size | numeric(12,4) | Snapshot |
| base_batch_unit | varchar(50) | Snapshot |
| scale_factor | numeric(12,6) | batch_size / base_batch_size |
| status | varchar(30) | CHECK IN ('in_progress','paused','completed','cancelled') |
| current_step_index | integer | DEFAULT 0 |
| started_at | timestamptz | DEFAULT now() |
| completed_at | timestamptz | NULLABLE |
| started_by | uuid FK->auth.users | |
| completed_by | uuid FK->auth.users | NULLABLE |
| notes | text | NULLABLE |

### run_materials
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| run_id | uuid FK->production_runs | ON DELETE CASCADE |
| ingredient_id | uuid FK->ingredients | NULLABLE |
| ingredient_name | varchar(255) | Snapshot |
| sku | varchar(100) | Snapshot |
| unit | varchar(50) | Snapshot |
| base_quantity | numeric(12,4) | |
| scaled_quantity | numeric(12,4) | |
| actual_quantity | numeric(12,4) | NULLABLE |
| sort_order | integer | |

### run_steps
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| run_id | uuid FK->production_runs | ON DELETE CASCADE |
| step_number | integer | |
| title | varchar(255) | Snapshot |
| instructions | text | Snapshot |
| requires_confirmation | boolean | Snapshot |
| requires_quantity_entry | boolean | Snapshot |
| status | varchar(20) | CHECK IN ('pending','in_progress','completed','skipped') |
| started_at | timestamptz | NULLABLE |
| completed_at | timestamptz | NULLABLE |
| completed_by | uuid FK->auth.users | NULLABLE |
| sort_order | integer | |

### run_step_inputs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| run_step_id | uuid FK->run_steps | ON DELETE CASCADE |
| label | varchar(255) | Snapshot |
| field_type | varchar(30) | Snapshot |
| options | jsonb | Snapshot |
| is_required | boolean | |
| value | text | NULLABLE |
| sort_order | integer | |

---

## Auth & RBAC Design

**Supabase Auth** handles signup/login/JWT. Role is stored in `profiles.role`.

**RLS Policies** (applied per table):
- **profiles**: Users can read their own. Admins can read/write all.
- **ingredients**: All authenticated can read active. Admins can CUD.
- **formulas + children**: All authenticated can read active. Admins can CUD.
- **step_field_templates**: All authenticated can read active. Admins can CUD.
- **production_queue**: All authenticated can read. Admins + operators can create. Admins can delete.
- **production_runs + children**: All authenticated can read. Operators/admins can create and update step data.

**Role check helper function**:
```sql
CREATE FUNCTION public.get_user_role() RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Used in RLS policies: `get_user_role() = 'admin'`

**Admin user creation**: First user created via Supabase Auth, then profiles row inserted with role='admin'. Subsequent users created by admin through the app (Supabase `auth.admin` functions via Edge Function or direct insert).

**Note on user management**: Since Supabase Auth user creation requires the service_role key (which cannot be exposed to the client), we'll create a single Supabase Edge Function `create-user` that admins call to create new auth users + profiles. This is the only server-side function needed.

---

## Key PostgreSQL Functions (RPC)

### `start_production_run(queue_item_id, user_id)`
Single atomic transaction that:
1. Reads formula version with ingredients, steps, fields
2. Computes scale_factor
3. Inserts production_run with snapshot metadata
4. Inserts run_materials with scaled quantities
5. Inserts run_steps with snapshot data
6. Inserts run_step_inputs for each step's fields
7. Updates queue item status to 'in_progress'
Returns the new run ID.

### `complete_run_step(run_id, step_id, user_id, inputs_json)`
1. Validates step is next in sequence (no skipping)
2. Validates all required inputs have values
3. Updates run_step_inputs values
4. Sets step status to 'completed', timestamps, user
5. Advances production_run.current_step_index
6. If last step: sets run status to 'completed'
Returns updated step data.

### `calculate_batch(formula_version_id, batch_size)`
Read-only function that returns scaled material requirements for preview.

---

## Frontend Pages

| Route | Page | Access |
|-------|------|--------|
| `/login` | LoginPage | Public |
| `/` | Redirect to /dashboard | Auth |
| `/dashboard` | DashboardPage | Auth |
| `/queue` | QueuePage | Auth |
| `/runs` | RunsListPage | Auth |
| `/runs/:id` | RunDetailPage (read-only) | Auth |
| `/runs/:id/execute` | ActiveRunPage (guided execution) | Auth |
| `/admin/ingredients` | IngredientsListPage | Admin |
| `/admin/ingredients/new` | IngredientFormPage | Admin |
| `/admin/ingredients/:id` | IngredientFormPage (edit) | Admin |
| `/admin/formulas` | FormulasListPage | Admin |
| `/admin/formulas/new` | FormulaEditorPage | Admin |
| `/admin/formulas/:id` | FormulaDetailPage | Auth |
| `/admin/formulas/:id/edit` | FormulaEditorPage | Admin |
| `/admin/users` | UsersListPage | Admin |
| `/admin/users/new` | UserFormPage | Admin |
| `/admin/field-templates` | FieldTemplatesPage | Admin |

---

## Implementation Phases

### Phase 1: Supabase Project + Database Schema
- Create "ProdFlow" project on Supabase
- Apply all migrations (tables, indexes, constraints)
- Create RLS policies
- Create PostgreSQL functions (snapshot, step completion, batch calc)
- Create Edge Function for admin user creation
- Seed sample data (admin user, ingredients, field templates)

### Phase 2: Frontend Scaffold
- Initialize Vite + React + TypeScript project
- Install deps: @supabase/supabase-js, @tanstack/react-query, react-router-dom, tailwindcss, @headlessui/react, zod
- Set up Supabase client, auth context, protected routes
- Build UI component library (Button, Input, Card, Badge, Modal, DataTable, etc.)
- Build AppShell layout with responsive mobile/desktop nav
- Login page

### Phase 3: Admin Pages
- Ingredients CRUD (list + form)
- Field templates management
- Formulas CRUD with version management
  - Formula editor with ingredient rows
  - Step editor with configurable fields (template + custom)
- Users management (via Edge Function for creation)

### Phase 4: Operational Pages
- Dashboard with stats (active runs, queue count, recent completions)
- Queue page (sortable, filterable, start-run action)
- Runs list page
- **ActiveRunPage** — the core guided execution UI:
  - Progress bar showing step completion
  - Current step card with instructions
  - Dynamic field inputs (text, number, checkbox, select, textarea)
  - Materials checklist with actual vs. needed quantities
  - Step confirmation with validation
  - Pause/resume support
- Run detail page (historical read-only view)

### Phase 5: Polish + Deploy
- Loading/error/empty states on all pages
- Toast notifications
- Mobile/tablet responsive pass
- nginx reverse proxy config
- End-to-end workflow testing
- README with setup instructions

---

## Deployment

```
Browser --> nginx (:80/:443)
              |-> /*  --> static files from /apps/prod_flow/dist (Vite build)

All API calls go directly to Supabase (*.supabase.co) from the browser.
```

- **No Node.js server process** — just static files
- nginx serves the SPA with `try_files $uri /index.html`
- Supabase handles all backend: auth, database, RLS, edge functions
- `.env` contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Verification Plan

1. **Auth**: Login as admin, verify role-based route protection, verify operator cannot see admin pages
2. **Ingredients CRUD**: Create, edit, soft-delete, verify list filtering
3. **Formula versioning**: Create v1, edit to v2, verify v1 unchanged
4. **RLS**: Verify operator cannot delete ingredients (DB-level rejection)
5. **Queue**: Create items, sort by priority/due date, filter by status
6. **Run creation**: Start run via RPC, verify snapshot tables populated with correct scaled quantities
7. **Step execution**: Complete steps in order, verify required fields enforced, verify timestamps
8. **Historical immutability**: Edit formula after run, verify run data unchanged
9. **Mobile UX**: Test ActiveRunPage on phone/tablet viewports
10. **Full workflow**: Login -> ingredients -> formula -> queue -> run -> complete all steps -> dashboard shows result
