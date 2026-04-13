# ProdFlow Code Review - Recommendations

**Date:** 2026-04-13
**Scope:** Full codebase review covering security, code quality, performance, and architecture

---

## Critical: Security Issues

### 1. Unsafe `JSON.parse()` Without Error Handling

`JSON.parse()` is called in multiple locations without try-catch. If a user enters malformed JSON (e.g., in field template options), the entire page will crash.

**Affected files:**
- `src/pages/admin/formulas/FormulaEditorPage.tsx:166` - Parsing field options during form submission
- `src/pages/admin/field-templates/FieldTemplatesPage.tsx:61` - Parsing options payload on template save
- `src/components/formulas/StepCard.tsx:61` - Parsing template options when adding from template

**Recommendation:** Wrap all `JSON.parse()` calls in try-catch blocks and display a validation error via toast on failure. Example:

```ts
let parsedOptions: unknown = undefined
try {
  parsedOptions = f.options ? JSON.parse(f.options) : undefined
} catch {
  toast('error', 'Invalid JSON in field options')
  return
}
```

### 2. Overly Permissive Row-Level Security (RLS) Policies

The production queue, production runs, run materials, run steps, and run step inputs tables allow ANY authenticated user to INSERT and UPDATE. Only DELETE on the production queue is restricted to admins.

**Affected file:** `supabase/migrations/014_create_rls_policies.sql`
- Lines 157-162: `pq_insert` and `pq_update` use `auth.uid() IS NOT NULL`
- Lines 176-180: `pr_insert` and `pr_update` use `auth.uid() IS NOT NULL`
- Lines 190-194: `rm_insert` and `rm_update` - same pattern
- Lines 204-208: `rs_insert` and `rs_update` - same pattern
- Lines 218-222: `rsi_insert` and `rsi_update` - same pattern

**Recommendation:** Restrict INSERT/UPDATE on production runs and related tables so that only the operator assigned to the run (or admins) can modify records:

```sql
CREATE POLICY pr_update ON public.production_runs
  FOR UPDATE USING (
    operator_id = auth.uid() OR public.get_user_role() = 'admin'
  );
```

### 3. Weak Password Requirements

The minimum password length is only 6 characters, which is below industry standards (NIST recommends 8+ characters minimum, 12+ preferred).

**Affected file:** `src/pages/admin/users/UserFormPage.tsx:35`
```tsx
<Input ... type="password" ... required minLength={6} />
```

**Recommendation:** Increase minimum password length to at least 12 characters. Also enforce this server-side via Supabase Auth configuration, not just the HTML `minLength` attribute which can be bypassed.

### 4. Authentication Error Messages May Leak User Information

Raw Supabase Auth error messages are displayed directly to users. Messages like "User not found" vs "Invalid password" allow attackers to enumerate valid email addresses.

**Affected files:**
- `src/pages/LoginPage.tsx:52` - `{error && <p className="text-sm text-red-600">{error}</p>}`
- `src/context/AuthContext.tsx:58` - Returns `error?.message` directly from Supabase

**Recommendation:** Replace with a generic message: `"Invalid email or password"` regardless of the actual error type.

### 5. No Security Headers Configured

The application has no Content Security Policy (CSP), X-Frame-Options, X-Content-Type-Options, or other standard security headers configured in `index.html` or at the server level.

**Recommendation:** Configure security headers in the nginx deployment:

```nginx
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://*.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline';";
```

### 6. Login Placeholder Reveals Email Format

The login page placeholder `admin@prodflow.local` reveals the internal email naming convention.

**Affected file:** `src/pages/LoginPage.tsx:42`

**Recommendation:** Use a generic placeholder like `"you@example.com"`.

### 7. SECURITY DEFINER Function Risk

The `get_user_role()` function in `supabase/migrations/001_create_profiles.sql:12-15` uses `SECURITY DEFINER`, meaning it runs with the privileges of the function creator. While necessary for RLS, it amplifies the impact of any future SQL injection.

**Recommendation:** This is acceptable as-is since the query uses `auth.uid()` (parameterized). Document the security implications and ensure this function is never modified to accept user-controlled input.

---

## High Priority: Code Quality Issues

### 8. Unsafe `as any` Type Casting Throughout Formula Pages

Multiple files bypass TypeScript type safety by casting Supabase join results to `any[]`, then using `any` in map callbacks.

**Affected files:**
- `src/pages/admin/formulas/FormulaDetailPage.tsx:21` - `as any[]` on versions
- `src/pages/admin/formulas/FormulaDetailPage.tsx:101,123,140` - `(fi: any)`, `(step: any)`, `(f: any)` in map callbacks
- `src/pages/admin/formulas/FormulaEditorPage.tsx:74` - `as any[]` on versions
- `src/pages/admin/formulas/FormulaEditorPage.tsx:88,95,100` - `(i: any)`, `(s: any)`, `(f: any)` in map callbacks
- `src/api/formulas.ts:64,68,70` - `(fi: any)`, `(s: any)`, `(a: any, b: any)` in data transformation

**Recommendation:** Create explicit TypeScript interfaces for the joined data shapes returned by Supabase queries and use them instead of `any`. This eliminates runtime risk from unexpected data structures.

### 9. Missing React Error Boundaries

There are no Error Boundary components anywhere in the component tree. A single unhandled error in any child component (including the unsafe `JSON.parse` calls above) will crash the entire application with a white screen.

**Affected file:** `src/App.tsx` - No error boundary wrapping routes

**Recommendation:** Add an Error Boundary component wrapping the route tree. Consider using `react-error-boundary` for a declarative API with retry and fallback support.

### 10. Unhandled Promise Rejection in Auth Flow

In `src/context/AuthContext.tsx:33-40`, `getSession()` resolves with a `.then()` but has no `.catch()`. If the Supabase session check fails (network error, invalid token), the promise rejects silently and `loading` may never become `false`, leaving users stuck on a loading screen.

**Recommendation:** Add a `.catch()` handler:

```ts
supabase.auth.getSession()
  .then(({ data: { session } }) => {
    // existing logic
  })
  .catch(() => setLoading(false))
```

### 11. Zod Installed But Never Used

The `zod` package (v4.3.6) is listed in `package.json` dependencies but is never imported or used anywhere in the codebase. All form validation relies solely on HTML `required` and `minLength` attributes.

**Recommendation:** Either remove `zod` to reduce bundle size, or implement Zod validation schemas for all form submissions to get proper client-side validation with type-safe error messages.

### 12. Duplicate Constants Across Files

Unit options and field type options are defined independently in multiple files:

- `src/pages/admin/formulas/FormulaEditorPage.tsx:16-23` - `BATCH_UNITS`
- `src/pages/admin/ingredients/IngredientFormPage.tsx:11-19` - `UNITS` (likely overlapping)
- `src/pages/admin/field-templates/FieldTemplatesPage.tsx:15` - `FIELD_TYPE_OPTIONS`
- `src/components/formulas/StepCard.tsx:33` - `FIELD_TYPE_OPTIONS` (duplicate)

**Recommendation:** Consolidate all shared constants into `src/types/constants.ts` and import from there.

### 13. Race Condition in Form Initialization

In `src/pages/admin/formulas/FormulaEditorPage.tsx:69-111`, an `initialized` flag is used outside of `useEffect` to prevent re-initialization from query data. This pattern executes during render, which can cause state updates during render and is fragile if `existingFormula` reference changes.

**Recommendation:** Move the initialization logic into a `useEffect` with `existingFormula` as a dependency.

### 14. Missing Input Validation on Numeric Fields

Batch size is converted from string to number via `Number(baseBatchSize)` at `src/pages/admin/formulas/FormulaEditorPage.tsx:246` and `150` without range validation. Users could enter negative numbers, zero, or extremely large values.

**Recommendation:** Validate that batch size is a positive number within acceptable bounds before submission. Apply the same validation to ingredient quantities.

---

## Medium Priority: Performance Issues

### 15. N+1 Query Pattern in Formula Loading

The `useFormula()` hook in `src/api/formulas.ts:29-76` fetches a formula, then its versions, then for EACH version makes 2 additional queries (ingredients + steps). A formula with 5 versions triggers 12 database round trips.

**Recommendation:** Use a single Supabase query with nested selects to fetch all data in one request, or create a PostgreSQL function (RPC) that returns the full formula tree in a single call.

### 16. Non-Atomic Formula Creation

The `useCreateFormula()` mutation in `src/api/formulas.ts:79-157` performs 5+ sequential Supabase calls (insert formula, insert version, update current_version_id, insert ingredients, insert steps + fields). If any intermediate call fails, the database is left in a partially created state.

**Recommendation:** Wrap the entire creation flow in a PostgreSQL function called via `supabase.rpc()` so it executes as a single atomic transaction. This also reduces round trips.

### 17. Dashboard Polling Every 30 Seconds

`src/api/dashboard.ts:27` uses `refetchInterval: 30000` to poll 4 parallel queries every 30 seconds, even when the tab is inactive or data hasn't changed.

**Recommendation:** Add `refetchIntervalInBackground: false` to stop polling when the tab is not visible. Consider using Supabase Realtime subscriptions for live updates instead of polling.

### 18. Missing Request Deduplication on Mutations

Multiple rapid clicks on action buttons (e.g., "Create Formula", "Start Run") can trigger duplicate mutations since there is no deduplication mechanism beyond the `isPending` check on the submit button.

**Recommendation:** Disable action buttons while mutations are pending (already partially done with `loading` prop) and ensure all critical buttons include this pattern consistently.

---

## Architecture Recommendations

### 19. No Test Coverage

There are zero test files in the entire codebase. No testing framework (Vitest, Jest) is configured. Critical paths like authentication, formula creation, and production run execution have no automated verification.

**Recommendation:** Add Vitest (already compatible with Vite) and write tests for:
1. **API hooks** - Mock Supabase and test query/mutation behavior
2. **Auth flow** - Test sign-in, sign-out, and session restoration
3. **Critical components** - FormulaEditorPage form validation and submission
4. **RLS policies** - Integration tests against a test Supabase instance

### 20. No Application-Level Logging

There is no logging library or structured logging in the codebase. API errors are either thrown silently or shown as toasts, making production debugging difficult.

**Recommendation:** Add a lightweight logging utility that:
- Logs API errors with context (query key, parameters)
- Logs auth state transitions
- Can be configured to send logs to an external service in production

### 21. API Layer Mixes Data Fetching and Transformation

`src/api/formulas.ts:50-73` contains complex data normalization logic (handling `Array.isArray` checks for Supabase join inconsistencies) inside the query function. This makes the API layer hard to test and maintain.

**Recommendation:** Separate data normalization into utility functions that can be tested independently. Consider creating a data normalization layer between Supabase responses and React components.

### 22. Hardcoded RPC Function Names

RPC function names like `'start_production_run'` and `'complete_run_step'` are hardcoded as string literals throughout the codebase.

**Recommendation:** Extract all RPC function names into a constants file to prevent typo-related bugs and make refactoring easier.

### 23. No Query Key Factory

Each API file independently defines its own `KEYS` object (`src/api/formulas.ts:4-7`, `src/api/ingredients.ts`, etc.) with no centralized query key management.

**Recommendation:** Create a shared query key factory in `src/lib/query-keys.ts` following the TanStack Query best practice pattern. This prevents key collisions and makes invalidation more predictable.

---

## Low Priority: Minor Improvements

### 24. Toast ID Counter Never Resets

`src/components/ui/Toast.tsx:25` uses a module-level `let nextId = 0` counter that increments indefinitely. In very long sessions this could theoretically overflow, though practically unlikely.

### 25. No Loading Skeletons

All pages use a generic `<LoadingSpinner />` instead of skeleton loaders that match the page layout, causing layout shift on load.

### 26. No Optimistic Updates

Mutations (delete user, toggle ingredient, etc.) wait for server confirmation before updating the UI. Optimistic updates via TanStack Query's `onMutate` would improve perceived performance.

---

## Summary

| Priority | Category | Count |
|----------|----------|-------|
| Critical | Security | 7 |
| High | Code Quality | 7 |
| Medium | Performance | 4 |
| Medium | Architecture | 5 |
| Low | Minor | 3 |
| **Total** | | **26** |

### Recommended Action Order

1. **Immediate:** Fix unsafe `JSON.parse()` calls (#1), tighten RLS policies (#2), increase password requirements (#3)
2. **Short-term:** Add Error Boundaries (#9), fix auth error handling (#4, #10), add input validation (#14)
3. **Medium-term:** Resolve N+1 queries (#15), make formula creation atomic (#16), add test coverage (#19)
4. **Long-term:** Implement logging (#20), refactor API layer (#21), add security headers (#5)
