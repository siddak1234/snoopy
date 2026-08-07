# Backend boundary cutover audit — 2026-08-06

Status: **Checkpoint implementation complete; persistence cutover open**

## Decision applied

- Supabase Auth is retained behind `snoopy-backend` for login identity.
- Product login is OAuth-only: Google, Microsoft, and Apple.
- Website/browser code does not use Supabase, object-storage SDKs, or execution
  webhooks.
- Login identity OAuth is separate from automation connector OAuth.
- The existing UI/UX remains the presentation contract unless a product decision
  explicitly changes a screen.

## Checkpoint evidence

### Baseline

- Website lint passed with 0 errors before the cutover (53 existing warnings).
- Website typecheck passed after removing byte-identical stale generated `.next`
  route type files.
- Website production build passed and its route inventory was recorded.
- Backend tests passed before implementation (23 tests).
- A source checksum baseline was captured for `app/` and `components/`.

### Removed only after caller scans

- Browser/Next Supabase clients and the Supabase packages.
- Password signup, password login, verification, reset callback support, and the
  old browser OAuth callback.
- Direct invoice, candidate, and job-description upload/file routes.
- GCS helper and package from the website.
- Direct contact execution-webhook route.
- Direct dashboard Supabase table/RPC calls.

### Added

- Same-origin website gateway at `/api/platform/*`.
- Backend Google/Microsoft/Apple login provider contract.
- Backend PKCE start/callback, signed short-lived state, HttpOnly session cookies,
  session refresh, logout, and login-identity linking boundary.
- Validated backend-to-established-UI session mapping.
- Explicit authenticated backend routes for every dashboard read/write URL now
  consumed by the website. Unimplemented owners return RFC 9457
  `503 NOT_CONFIGURED`; they do not return fake data.
- Same-origin enforcement for cookie-authenticated mutations.
- A website boundary audit that prevents reintroduction and pins remaining
  transitional database callers.

## Open nonconformance: website server database access

The target says only backend services may access the new Supabase project. The
website no longer has any Supabase or storage SDK, but 17 server-side source files
still import the legacy Prisma database helper:

1. `app/account/layout.tsx`
2. `app/account/organization/actions.ts`
3. `app/account/organization/page.tsx`
4. `app/account/projects/[id]/invoices/flagged/actions.ts`
5. `app/account/projects/actions.ts`
6. `app/account/projects/page.tsx`
7. `app/account/settings/page.tsx`
8. `app/onboarding/actions.ts`
9. `app/onboarding/join-org/page.tsx`
10. `app/onboarding/layout.tsx`
11. `lib/auth.ts`
12. `lib/domain-utils.ts`
13. `lib/project-rbac.ts`
14. `lib/projects.ts`
15. `lib/tenant.ts`
16. `lib/workflows.ts`
17. `lib/workspace-invites.ts`

They remain because the Access and Automation Catalog persistence/API adapters do
not exist. Deleting them now would remove working project, workspace, membership,
invite, onboarding, and workflow behavior. The audit script rejects any new file
outside this exact allowlist and asks maintainers to remove allowlist entries as
each caller migrates.

`POSTGRES_URL` and `POSTGRES_PRISMA_URL` therefore remain documented only as
legacy-cutover variables. They must not be populated with credentials for the new
Supabase project. Vercel can remove them only after the 17-file allowlist reaches
zero and dashboard compatibility tests pass.

## Mobile impact

`snoopy-mobile` is a tested UI prototype, not an integrated client. Code inspection
found demo email/password state, presentation-only OAuth buttons, fixture data, no
API client, no server session, and no secure credential storage. Its UI was not
changed in this checkpoint. A native app-link and backend session contract is
required before replacing its demo auth controls; the website cookie flow is not a
valid native implementation.

## External configuration not performed

No Supabase table, migration, provider setting, secret, Vercel environment value,
or deployment was changed. The screenshot proves the new project exists and is
empty/healthy; it does not provide the provider credentials, publishable key,
database password, redirect allowlist, or deployment endpoint required to safely
configure it.

## Next acceptance gate

1. Implement Access service subject-to-user mapping, workspaces, memberships,
   projects, and tenant authorization with service-owned migrations.
2. Implement Automation Catalog ownership for workflow drafts/versions.
3. Route all 17 legacy database callers through coarse-grained Edge APIs.
4. Prove response compatibility and negative tenant-isolation tests.
5. Remove Prisma/database packages and Vercel database variables from `snoopy`.
6. Only then apply reviewed migrations and backend secrets to the new Supabase
   project.

## Final verification evidence

- The subsequent Access identity checkpoint extends this baseline to 55 backend
  tests and an Access build; see the backend
  `docs/audits/2026-08-06-access-identity-checkpoint.md` record.
- Backend full and production dependency audits: 0 vulnerabilities.
- `snoopy npm run audit:boundaries`: passed; 0 browser Supabase/storage/manual
  login paths and 17 pinned transitional database files.
- Snoopy formatting/typecheck: passed.
- Snoopy lint: 0 errors and the same 53 pre-existing design/prompt warnings as the
  baseline.
- Snoopy production build: passed on patched Next.js 16.3.0; public and account
  UI routes remain present, while intentionally retired password/callback/direct
  upload routes are absent.
- Snoopy full and production dependency audits: 0 vulnerabilities after moving
  Prisma CLI/dotenv to development-only and updating Next.js to 16.3.0 and Prisma
  packages to 7.9.1.
- `snoopy-mobile`: clean worktree, lint/typecheck passed, and all 109 tests passed.
  One existing React test-timer console warning remains in the Face ID suite.
- UI source comparison: `app/globals.css`, Nocturne UI primitives, builder
  presentation, and marketing page layouts have no repository diff. Intentional
  presentation changes are limited to replacing website password forms with the
  three OAuth buttons; dashboard changes are transport/session logic. The Open
  Graph image uses Node rather than its prior Edge runtime because Next 16.3 marks
  that runtime deprecated and otherwise disables static generation for the route;
  image markup and styling are unchanged.
- `git diff --check`: passed in both changed repositories.

## Subsequent Access tenancy checkpoint

Later on 2026-08-06, the Access tenancy foundation added validated workspace
projection to the session contract. Three read-only website callers were removed
from the transitional database boundary without changing their rendered JSX or
class/style tokens:

- `app/account/layout.tsx`
- `app/account/settings/page.tsx`
- `app/onboarding/layout.tsx`

The boundary audit now pins exactly 14 direct-database files. Website contract
tests prove that active workspace IDs must reference a returned membership and
that malformed, uncontracted, or duplicate workspace projections fail closed.
The complete tenancy checkpoint passes 67 backend tests, 2 website contract tests,
the 14-file boundary audit, TypeScript, formatting, a 22-page supported Webpack
production build, and dependency audits with 0 known vulnerabilities. The exact
backend evidence and open policy/deployment gates are recorded in
`snoopy-backend/docs/audits/2026-08-06-access-tenancy-checkpoint.md`. This does not
authorize deployment of the mixed legacy/new identity state; the remaining 14
callers still use legacy IDs and database credentials.
