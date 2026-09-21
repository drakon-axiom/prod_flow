# Staff and production security remediation

Base revision: `6649158ac4cb664631d73b53385b4659d260b75a` (fresh GitHub main checked before editing).
No AGENTS.md exists in that repository tree. This patch does not change lot numbering, inventory integrations, billing, or existing production facts.

## Behavior

- Active staff membership is required for operational reads and commands. The helper also reads live Auth ban and soft-deletion state, so a still-valid JWT cannot bypass those restrictions. An authenticated account without an eligible active profile has no operational access.
- Personal profile updates are limited to the name column. Role and activation changes use `admin_update_profile`, which requires a current eligible administrator and records before/after evidence. Access changes take one shared transaction advisory lock, recheck the caller after obtaining it, and preserve at least one active administrator who is neither banned nor soft-deleted. It also prevents an administrator accidentally removing their own administrative access.
- Run creation, completion, scaling preview, and pause/resume/cancel derive the actor from the authenticated session. Legacy actor arguments remain accepted only when they match that session.
- Run snapshots/materials/steps/inputs no longer accept direct client writes, including via old column grants. Queue records remain linked to their runs. Started queue records and completed/cancelled runs cannot be changed through ordinary queue controls.
- Required step confirmations must be true. Required quantity entry is a finite, nonnegative numeric value. Required text cannot be whitespace; numeric values must be finite and respect any configured min/max; select values must belong to the snapshotted options. Duplicate and foreign field IDs are rejected.
- Completed results remain unchanged. Exact same-actor retries return the saved result without another completion event. A different payload cannot replace completed facts. Existing old completions without a new audit payload remain immutable and are not retroactively represented as idempotent new submissions.
- The frontend exposes required confirmation/quantity controls, uses the guarded commands, displays saved quantity/confirmation in history, and removes unsupported run deletion.
- The existing `create-user` Edge Function is now tracked in `supabase/functions/create-user`. It verifies the caller through Auth and the caller-scoped `get_user_role` RPC before using service credentials. Profile changes, including the legacy `update` action, use `admin_update_profile` under the caller's JWT. No action accepts a supplied actor or performs a service-role role/activation update.
- Account creation inserts an inactive operator profile, then uses the audited caller RPC to apply the requested role and activate it. It supplies only the name in Auth user metadata. Failed activation leaves the profile inactive for administrator recovery; failed profile insertion is reported for inspection without silently deleting an Auth account or overwriting a profile.
- Password changes and recovery-link generation require current admin eligibility and a target staff profile. Intent and completion events contain actor/target/request IDs, never passwords, recovery links, OTPs or token hashes. Completion-audit failures are explicitly reported; the password controls display that warning. The legacy `send_reset_email` action still returns `{success:true,link}` and does **not** send an email. Recovery lookup is bounded to 2,000 Auth accounts; larger directories must use the user-ID-based password action until the lookup is extended.
- The migration explicitly grants service-role INSERT for profile provisioning and audit append, and revokes service-role UPDATE/DELETE/TRUNCATE on the audit table even if inherited table defaults previously granted them. Handler audit writes do not depend on installation-specific default INSERT privileges.
- Hard user deletion is rejected with guidance to deactivate. The user list retains production attribution and provides Deactivate/Reactivate. Browser access is limited to `https://prodflow.acgllc.co` unless an explicit comma-separated `ALLOWED_ORIGINS` environment value configures additional trusted deployment URLs. The handler accepts POST and preflight OPTIONS only.

## Deployed function inspection

The previous deployed `create-user` source was read in Supabase before this replacement was prepared. It verified the caller with Auth, then used a service-role `profiles.role === 'admin'` check that ignored `is_active` and live Auth restrictions. Its `update` action directly changed role/activation with service privileges, bypassing the new RPC's audit and administrator guards. Its `delete` action deleted the profile and hard-deleted the Auth account. This replacement closes those inspected paths; deploying the SQL/frontend without replacing the old function would leave them reachable.

Migrations 001–016 contain no Auth-to-profile signup trigger. Before deployment, inventory any extra live Auth triggers: a custom trigger that grants access from user metadata must be removed or reconciled with inactive operator provisioning. The handler deliberately refuses an existing-profile conflict; it cannot guarantee inactivity if an extra live trigger created an active profile first. Also verify public signup does not provision an eligible staff profile. Auth users with no eligible profile have no database access through these policies.

Auth API calls and PostgreSQL transactions cannot commit atomically together. The handler rechecks current eligibility before sensitive Auth mutations, fails closed on failed access checks, records intent first, and reports uncertain completion for review. It does not claim to cancel an Auth request already in flight when an administrator is deactivated or to roll back Auth mutations if a later audit request fails. Do not blindly retry an uncertain create response.

## Apply and verify

1. Identify the actual ProdFlow Supabase project and deployed revision. Back up the database and inventory current policies/grants/functions plus in-flight runs. Confirm a usable active administrator exists.
2. Enter a controlled maintenance window that prevents user administration and production writes, then inventory live Auth triggers and function settings as described above. Preserve the old source for incident analysis, but do not keep its endpoint available as a fallback. Confirm standard service-role access to `profiles` and the new `security_events` table, plus the existing Supabase URL/anon/service-role environment secrets; do not copy credentials into source.
3. Apply migration `016_harden_staff_and_workflow.sql` to staging with migrations 001–015 present. It replaces all policies on this application's known tables deliberately; reconcile any live custom policies first. It creates a private-by-policy audit table and two additional run-step evidence fields. It does not migrate or relabel historical lots. During the same maintenance release, deploy this repository's `supabase/functions/create-user/index.ts` and `handler.mjs` **to the existing `create-user` function**, preserving its platform JWT verification setting. The handler independently validates Auth identity and current database eligibility. Verify allowed frontend origins and the Auth Site URL used for recovery links. An old role helper must never authorize this new handler in production; apply migration 016 first.
4. Deploy the matching frontend during the same controlled release, then reopen operations after checks pass. The old four-argument completion API still resolves through default parameters, but old clients cannot satisfy newly enforced step confirmation/quantity requirements. Refresh open clients before resuming production. Migration sends the PostgREST schema reload notification.
5. Test sign-in and direct API calls as anonymous, no-profile, inactive, Auth-banned, soft-deleted, operator and administrator identities; verify existing JWTs lose operational access when deactivated/banned/deleted. In two real database sessions, attempt simultaneous cross-demotion of administrators: one change must complete, then the waiting caller must be denied after its authority changes. Confirm old completed records can be read but not edited, and that a normal operator can queue/start/pause/resume/complete a configured run.
6. Check a configured quantity/confirmation step, an ordinary field-only step, select choices, numeric bounds, retry behavior and cancellation. Verify audit actor and queue/run status agree. Inspect active runs with legacy noncontiguous step order before cutover; new runs normalize the step order without rewriting existing run history.
7. Compare deployed grants and policies with migration output. Database-dashboard tests as owner are not substitutes for Auth/PostgREST tests.
8. Exercise the deployed Edge endpoint as anonymous, operator, inactive/banned/deleted administrator and eligible administrator. Confirm create can only activate/elevate via the audited RPC; direct legacy updates obey its last-admin/self-access protections; legacy delete is rejected; password operations cannot target a nonstaff Auth user. Exercise incomplete creation recovery, a failed intent audit, and a failed completion audit without exposing passwords or recovery credentials in logs. Review existing administrators and prior access changes because patching the function cannot undo past misuse.

Use a forward correction if verification fails. Do not restore the old permissive grants or RPCs as an automatic rollback. Preserve existing data/audit events.

## Local validation

From a normal checkout with Node/npm:

```sh
npm ci
npm run test:security
npm test
npm run build
```

The security suite runs all 16 actual SQL migrations in isolated PGlite/PostgreSQL with synthetic Auth identities and explicitly seeded table/column grants. It also invokes the actual dependency-injected Edge handler with synthetic HTTP responses to exercise authorization order, request validation, profile/RPC boundaries, audit data, and partial failures. These tests do not emulate or test live Supabase Auth/PostgREST delivery, deployment settings or remote failure timing. The raw recovery response shape was checked against the installed `@supabase/auth-js` transform and [Supabase Auth's endpoint source documentation](https://github.com/supabase/auth/blob/master/README.md#post-admingenerate_link).

Recorded results:

- Security SQL suite: 12 tests passed (11 scenario groups plus parent). This includes service-role provisioning/audit append with audit mutation denial, stale-JWT Auth ban/deletion denial, expired-ban recovery, observing the access-change advisory lock in `pg_locks`, and stale-administrator/last-eligible-admin denial. PGlite uses one backend; the two-session blocking schedule remains a staging check.
- Edge handler suite: 9 tests passed; combined security command: 21 tests passed.
- Existing Vitest suite: 8 tests passed.
- TypeScript project build and Vite production bundle: passed.
- Scoped lint passes except the pre-existing `UserEditPage` initialization-effect error. This page was minimally changed only to display the audit warning and correct the password hint. Repository-wide lint retains the same 5 existing errors in Toast, AuthContext, FormulaEditorPage, IngredientFormPage and UserEditPage; no new lint error was introduced.
- Compatible dependency updates were applied without forced major upgrades; the final dependency audit reported 0 vulnerabilities. All recorded tests and build checks were rerun against those updated dependencies.
- No live migration, application deployment, merge or push performed by this implementation task.

Lot generation, source consumption, output billing, request-ID-based new cross-system workflows and broader correction mechanisms remain in the separately reviewed architecture work. This patch secures the existing production commands and does not claim those future workflows have been implemented.
