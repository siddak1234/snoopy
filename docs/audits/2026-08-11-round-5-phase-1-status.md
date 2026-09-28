# Round 5 Phase 1 status — 2026-08-11

Status: **implemented locally; not release-approved**

This record describes only evidence available from the `snoopy` working tree
and its read-only sibling governance/contract repository. It does not change
the backend plan or assert backend delivery.

## Change-control baseline — 2026-08-12

The initial Round 5 worktree was found on `main`, with no local or remote
Round 5 branch. A live read-only remote-ref check returned only `main` at
`6a7dedc`. The current worktree is now on the local branch
`feat/web-round-5`, based on that same commit; `main` was not changed or
committed.

At the branch baseline, the worktree held 15 modified tracked files and 23
untracked files. Their code-based scope is:

- generated public-contract consumption (`lib/automations.ts`, generation
  scripts, generated declarations, and contract tests);
- connection presentation, server actions, callback compatibility, navigation,
  and status mapping;
- browser/visual/accessibility test infrastructure and CI wiring;
- Round 5 design-system cleanup and reduced-motion handling; and
- this audit documentation.

`AGENTS.md` was initially separated from the implementation while its ownership
was checked. It is retained as the repository's agent-governance file: the
Next.js-generated block explicitly states that Next recreates it and that
committing it keeps the tree clean, while the Autom8x block enforces this
repository's read-only governance boundary.

The branch baseline was rechecked on 2026-08-12:

- format, lint, typecheck, boundary audit, contract tests, generated-contract
  verification, `git diff --check`, and Webpack production build passed;
- the boundary audit still reports 12 transitional direct-database callers;
- the browser suite initially passed 9 of 10 checks: all four marketing
  screenshots and the callback privacy test passed; the remaining failure was
  the documented `/contact` inline-email-link accessibility finding. The
  approved corrective change and its subsequent 10/10 result are recorded in
  the accessibility section below.

The initial typecheck produced duplicate declarations only in ignored
`.next/types` output. Removing that generated cache and rerunning typecheck
passed; no source file was changed for that repair.

## Boundary hardening after the baseline

- Connection and automation reads and server actions now use generated operation
  aliases for their request/response shapes. This includes subscription, run,
  approval, OAuth-authorization, pasted-key, and disconnect operations. Contract
  tests fail if those callers return to manually declared `authorizationUrl`,
  `connection`, `subscription`, `run`, or `approval` wrappers.
- The existing `Modal` primitive now contains keyboard focus inside an open
  dialog, places focus on its first usable control, and restores focus to the
  trigger after close. This changes no visual token, layout, or dialog call-site
  markup. Every current call site supplies a dialog label.

The public browser suite cannot exercise an authenticated dashboard modal while
its test environment intentionally uses `BACKEND_API_ORIGIN=https://backend.invalid`.
Authenticated keyboard traversal of the connections credential dialog remains a
required fresh-audit check against an actual non-production backend session; it
is not claimed as passed here.

The latest baseline verification passed format, lint, typecheck, generated
contract verification, and all 13 website contract tests. The Webpack production
build passed. The local browser suite passed 10/10 checks after the approved
`/contact` baseline update.

## Backend PR #28 contract audit — 2026-08-12

This audit read only `snoopy-backend` `main` at
`c2220b65113515a966259be46862a13eafb11eff` (PR #28). The public detailed
automation and connection fragments remain the generator inputs; the root
document explicitly describes itself as a draft cross-domain index.

Implemented from the published fragments:

- Catalog `AutomationCatalogEntry.setup[]` is now consumed as generated data.
  The subscription dialog appears only when that array is non-empty, preserves
  response order within the documented `connections`, `source`, `rules`, and
  `notifications` sections, renders the declared control/title/description,
  applies supplied defaults, submits `config` to the existing subscription
  PATCH, and leaves validation to the server. No provider-specific setup field
  was added. `resource-picker` is represented as an opaque text value because
  the public contract provides no resource-list or picker operation.
- A pasted-key Connect action creates one browser-memory key and carries it to
  the server action. The action validates the published 16–128-character
  alphabet and sends it only through `platformServerJson`'s `Idempotency-Key`
  header. A 409 keeps the dialog and its key in place, offers a same-intent retry
  or a connection-list refresh, and never silently sends a new credential
  request. Credential values remain form values only; they are not logged,
  placed in URLs, analytics, or component state.
- Subscription creation maps only the two reason tokens the automation Problem
  schema documents: `over_plan_limit` to a plan-limit state and
  `entitlements_not_configured` to an unavailable-entitlements state. Other
  403s remain generic authorization failures. No checkout, pricing,
  subscription-management, or webhook integration was added. Error rendering
  now uses the public Problem title and explicit allowlisted details rather than
  raw `detail` text.
- Provider credential fields and their `help` text are still rendered directly
  from `credentialFields`. No frontend text claims that SendGrid scopes were
  independently live-verified.

Focused website tests now cover those UI-consumption states: metadata-driven
setup fields/defaults/controls, the two entitlement states and absence of an
invented billing flow, reused pasted-key intent on 409, header-only transport,
and provider-help rendering. `npm run test:contracts` passed 18/18; typecheck,
lint, formatting, and the boundary audit also passed after these changes.

## Backend PR #29 contract audit — 2026-08-12

This follow-up read only `snoopy-backend` `main` at
`b7bf93a37951e0ea0fc37026c30b879518619298` (PR #29). It resolves all three
public-contract defects recorded above:

- `connections.yaml` now declares its referenced `IdempotencyKey` header;
  generated connection operations include the required header and
  `npm run verify:platform-contracts` passes.
- `createSubscription` explicitly declares its public 403 Problem response.
  The website's pure entitlement classifier proves both allowed reason tokens
  produce the intended state and an unknown token or non-403 response remains
  generic.
- The public root document now declares `WorkspaceExportResponse` and its
  service-section union. The generator now consumes all three authoritative
  inputs: `snoopy-backend/docs/openapi.yaml`, `snoopy-backend/docs/openapi/automations.yaml`, and
  `snoopy-backend/docs/openapi/connections.yaml`.

`/account/settings` now presents an existing-design-system workspace export
section. It requests the public Edge operation through a server action, renders
only the service label plus the typed `included`/safe-unavailable reason state,
and downloads the exact public response as JSON. It reports partial whenever
`complete` is false or a successful section reports `data.truncated: true`.
The published response has no cursor, and the UI neither renders nor fabricates
one. No billing, pricing, checkout, customer portal, webhook, object-storage
key, credential, or raw upstream-error behavior was introduced.

The follow-up tests add executable client-facing coverage of a complete export,
a nested truncated section, an unavailable section, the generated public
service union, absence of cursor behavior, both entitlement reasons, and a
generic unknown 403 reason. `npm run test:contracts` passed 22/22; generated
contract verification, typecheck, lint, formatting, the boundary audit, Webpack
production build, and the public browser suite (10/10) also passed.

## Phase 1 work completed in this repository

### Public-contract consumption

- `scripts/generate-platform-contracts.mjs` generates TypeScript declarations
  from all three authoritative public inputs: root `openapi.yaml` for workspace
  export, plus detailed `automations.yaml` and `connections.yaml` fragments.
- `lib/automations.ts`, `lib/connections.ts`, and `lib/exports.ts` expose aliases
  of generated schemas/operations; they do not recreate corresponding response
  models by hand.
- `npm run verify:platform-contracts` regenerates the declarations and fails if
  the committed output differs. `test/automation-contract.test.mjs` and
  `test/connections-contract.test.mjs` verify that the façades consume generated
  schemas and check selected public-contract invariants when the sibling backend
  checkout is available.
- The internal entitlements contract remains excluded because this web repository
  may call only public Edge operations. The root document is generated only for
  its now-typed public export response; existing detailed product fragments
  remain the source for their named domains.

### Connections presentation and callback boundary

- `/account/connections` is an authenticated, server-rendered dashboard page
  using existing `SectionCard`, `Button`, `Modal`, `FormInput`, `FormError`, and
  `StatusPill` components. No dashboard design system was replaced or duplicated.
- `/connections` retains the backend callback-compatible public route. It retains
  only the fixed `status` token and redirects to the authenticated page; provider
  and reason query values are discarded. The browser test covers that privacy
  boundary.
- The source uses the existing server-side platform client boundary. Browser code
  has no provider credential, database URL, or direct database import.

## Verified local evidence

The following checks passed after the Phase 1 implementation:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run audit:boundaries`
- `npm run test:contracts`
- `npm run verify:platform-contracts` with the sibling backend checkout present
- `npm run build -- --webpack`
- `npm run test:browser` (marketing screenshot coverage and callback-route test,
  before the accessibility suite was added)
- `git diff --check`

The default Turbopack build could not bind its internal worker port in this
sandbox. The Webpack production build completed. A normal CI/fresh-environment
build remains required before release approval.

## Accessibility audit result

Automated Axe coverage now audits the settled, reduced-motion public routes:
`/`, `/solutions`, `/contact`, `/automation-builder`, and `/login`. The first
run found design-level contrast/discernibility failures on `/contact`: inline
email links were identified only by a low-contrast color difference from their
surrounding text. The initial `/solutions` result was a false measurement of
the in-progress opacity animation; reduced-motion testing removes that
transitional frame from the audit.

On 2026-08-12, the design owner approved the smallest corrective treatment:
the four inline `mailto:` links gained a persistent underline and underline
offset. Their color, typography, copy, spacing, layout, and hover color were
unchanged. Only the macOS `/contact` screenshot baseline was regenerated in
this workspace; the separate Linux baseline remains for CI to validate on its
native renderer. `npm run test:a11y` passed all five public-route checks, and
the local full browser suite passed 10/10 checks. This closes the automated
public-route portion of NFR35; authenticated keyboard traversal remains below.

## Release and next-phase blockers found from code and contracts

| Round 5 item | Evidence | Required resolution | Owner/repository |
| --- | --- | --- | --- |
| 4.5.3 setup from `manifest.setup[]` | PR #28 publishes `setup[]`; the UI now consumes it from generated automation types. The public contract has no resource-picker list operation. | Validate against a real authenticated workspace with each published setup control; publish a resource-list contract if `resource-picker` needs selectable choices rather than opaque values. | Website + backend API |
| 8.2 pasted-key connections | PR #29 resolves the public header reference; generated verification passes and the UI preserves one key per retry intent. | Run the pasted-key flow against a non-production provider account, including a real 409/retry observation. | Website + backend environment |
| 8.3 billing | The public root Edge contract exposes a billing webhook route, not a customer checkout, portal, or entitlement-read operation. | Publish the intended public billing operations and authorization behavior. | Backend governance/API; `snoopy-backend` |
| Entitlement state | PR #29 declares subscription-create 403 and the UI recognizes only its two allowlisted reasons. | Observe both allowed states and an unrelated 403 through Edge; do not add an upgrade/payment flow. | Website + backend environment |
| Export UX | PR #29 publishes the root response union; Settings now renders and downloads it without a cursor assumption. | Observe a complete, unavailable, and truncated result through Edge with an owner/admin non-production session. | Website + backend environment |
| 4.6.4 invites | D4 drops workspace invite links for launch. The Prisma-only routes, components, actions, utility, and allowlist entry are removed. | Complete — do not recreate an invite flow without a new approved public contract. | Website |
| 4.6.5–4.6.7 Prisma removal | `npm run audit:boundaries` reports 11 remaining transitional Prisma callers. Several corresponding public Edge operations have no typed request/response bodies. | Backend must publish complete public schemas/routes; then migrate each approved caller, prove behavior and tenant isolation, and remove the remaining packages, variables, and Docker credentials. | Website plus backend API owners |

The connection and export pages are implementation evidence, not release
approval. The live, authenticated non-production observations above are still
required before a fresh final audit.

## CI and audit boundary

The generator requires the sibling private backend checkout, which GitHub Actions
does not currently fetch. CI validates the committed generated declarations and
website contract tests, but cannot run `verify:platform-contracts` until it is
given read-only access to the exact backend contract source (or an immutable
published contract artifact). Do not silently remove this local verification.

## Next execution order

1. Run authenticated non-production checks for setup controls, pasted-key retry
   (including 409), both entitlement states plus a generic 403, and complete,
   unavailable, and bounded exports. Billing remains out of scope until a public
   customer API exists.
2. Resume the tenancy/Prisma migration only after the public-contract gaps in
   the Phase 2 update are resolved; the boundary audit currently records 11
   transitional files.
3. After those observations and remaining Round 5 items, run a fresh audit session with
   both repositories available to re-run generated-contract verification, browser
   behavior, architecture boundaries, and release gates.

## Phase 2 update — invite decision and platform boundary — 2026-08-12

### 4.6.4 complete: launch drops workspace invite links

The governing Round 5 decision is D4 in `AUTOM8X-ROUND-PLAYBOOK.md`: workspace
invite links are dropped for launch; the Prisma invite table has no backend
counterpart, and rebuilding it serves no requirement. The website implementation
now follows that decision exactly:

- removed the public `/org-invite/[token]` page, its accept form, invite server
  actions, the invite utility, the organization invite control, and the projects
  page's invite-link join control;
- removed the pending-invite read from the organization page and adjusted only
  the now-inaccurate organization copy;
- removed ~~`lib/workspace-invites.ts`~~ from the transitional database allowlist (the file is gone since).

No replacement invite flow was added. The current public contract has no
issue-or-accept invite operation, and a frontend substitute would violate the
contract-first rule. The boundary audit now reports **11** transitional
database files, down from 12.

### Platform transport hardening

All product HTTP calls now pass through one of three explicit transport façades:
`lib/platform-api.ts` for browser calls, `lib/platform-server.ts` for Server
Components/actions/routes, and `lib/platform-proxy.ts` for the special proxy
session request that must preserve backend `Set-Cookie` rotation headers in the
same request. `scripts/audit-boundaries.mjs` rejects any new direct `fetch`.

The linked-identity response and contact receipt use generated root-contract
types. Browser-side problem rendering now uses the public RFC Problem `title`,
not raw `detail` or arbitrary upstream fields. The contact form no longer treats
an undocumented 503 as a product state; its current public operation declares
201, 400, and 429 only. No visual design, copy, layout, or approved marketing
baseline was redesigned.

### Current public-contract blocker for 4.6.5

This is a contract completeness finding, not permission to infer shapes:

- `SessionResponse.user` is `additionalProperties: true`, while the website
  necessarily reads `userId`, `email`, `displayName`, and `activeWorkspaceId`.
- `listWorkspaceMembers`, `readProject`, `updateProject`,
  `listProjectMemberships`, `upsertProjectMembership`,
  `removeProjectMembership`, `listJoinRequests`, and the organization-domain
  operations have no generated JSON content type for one or both of their
  request/response bodies.
- Root `openapi.yaml` declares no public workspace-name update or
  workspace-member removal operation.
- Domain discovery and join creation exist in `snoopy-backend/docs/openapi/access.yaml` only
  as private Access operations; they are not public website endpoints.

The remaining 11 transitional files cannot be migrated correctly until the
backend publishes those public Edge operations and exact schemas. The website
must not use the private Access API, direct Prisma, or handwritten fallback
types to bridge that gap.

### Latest verified evidence

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run audit:boundaries` — 11 transitional database files; no browser
  Supabase, storage, or manual-login path
- `npm run verify:platform-contracts`
- `npm run test:contracts` — 22 passed
- `BACKEND_API_ORIGIN=https://backend.invalid npm run build -- --webpack`
- `npm run test:browser` — 10 passed
- `git diff --check`

The browser suite's `backend.invalid` proxy messages are expected for its
unauthenticated visual fixtures; each declared visual, accessibility, and
callback assertion passed. Authenticated non-production observations and the
public-contract completion above remain required before the fresh final audit.

## Round 5 implementation completion record — 2026-08-12

This section supersedes the earlier Phase 1/2 blocker snapshots above. Those
snapshots describe the contract state before the public Edge contract was
merged. This implementation was audited against the sibling backend checkout at
main commit `7b39746017d5bf861e1155f76d8b73fb4f5a73cb` and its public
`snoopy-backend/docs/openapi.yaml`, `snoopy-backend/docs/openapi/automations.yaml`, and
`snoopy-backend/docs/openapi/connections.yaml` documents only.

### Tenancy replacement map

| Removed local tenancy responsibility | Public Edge replacement |
| --- | --- |
| Session preview selected as workspace authority | `GET /v1/session` active workspace, then the declared `activeWorkspaceId` from `GET /v1/workspaces`; no first-item fallback |
| Workspace/member reads and removal | `GET /v1/workspaces`, `GET /v1/workspaces/{workspaceId}/members`, `DELETE /v1/workspaces/{workspaceId}/members/{userId}` |
| Workspace rename | `PATCH /v1/workspaces/{workspaceId}` with `{ name }` |
| Project read/write and membership administration | Documented workspace project and project-membership operations |
| Domain claim, policy, discovery, verification, revocation | Documented workspace domain operations; the one-time DNS verification value is displayed only from the claim response that supplies it |
| Organization joining and owner decisions | `GET /v1/organization-discovery`, `POST /v1/organizations/{workspaceId}/join`, and documented join-request operations |

`lib/tenancy.ts` aliases generated root-contract schemas and is the sole
tenancy facade. It forwards `nextCursor` values only by URL encoding the opaque
value as the documented `cursor` parameter. It neither parses cursors nor
chooses a workspace from an unordered list. Every tenancy mutation creates its
own valid `Idempotency-Key`; the pasted-key connection panel retains one key for
the same explicit retry intent as required by its separate contract.

The obsolete local Prisma layer, all migrations, database packages, database
configuration, and the former invite-link UI are removed from the working tree.
No private Access route, Prisma import, Supabase SDK, browser secret, database
credential, or manual frontend `fetch` was introduced. The approved D4 launch
decision remains in effect: join requests replace workspace invite links; no
invite token/codes are recreated.

### Deliberate product and contract boundaries

- The billing page deliberately remains an availability placeholder. The public
  contract declares no browser checkout, price, subscription-management, or
  customer-portal operation. The subscription UI handles only the two documented
  entitlement reasons and never invents an upgrade path.
- Exports use the typed `WorkspaceExportResponse`; `complete: false`, a service
  unavailable variant, or a successful nested `data.truncated: true` is shown as
  partial. The present contract emits no export cursor, so the UI does not create
  one.
- A persisted requester whose discovery result only says `membershipState:
  requested` cannot be offered a post-refresh cancellation action: that response
  has no join-request ID, and no requester-scoped lookup is documented. A newly
  submitted request can be cancelled in the same UI state because its documented
  join response may return `request.id`. This is not a frontend fallback.

### Exit evidence to rerun in the independent audit

The implementation session reran the following after the final tenancy changes:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:contracts` — 27 passing tests
- `npm run audit:boundaries`
- `npm run verify:platform-contracts`
- `BACKEND_API_ORIGIN=https://backend.invalid npm run build -- --webpack`
- `npm run test:browser` — 10 passing tests, including the unchanged marketing
  screenshot suite and public accessibility coverage
- `docker compose config --quiet` and `docker compose build web`
- container inspection: no database credential or Prisma/database artifact in
  the frontend image; the web container reached the backend live health endpoint
  on the existing external `autom8x_default` network.

The browser fixtures are intentionally unauthenticated. A fresh audit session
with a configured non-production identity should therefore execute protected
keyboard traversal and real Edge observations for domain verification,
join-request decision, connection retry, entitlement 403 variants, and export
variants. That is independent verification scope, not a missing browser API or
permission to alter the contract.

## Round 5 final fixture audit — 2026-08-14

This final web-repository audit supersedes the previous sentence about an
unauthenticated-only browser fixture. It read only the three published public
contracts from sibling backend `main` at
`7b39746017d5bf861e1155f76d8b73fb4f5a73cb`:
`snoopy-backend/docs/openapi.yaml`, `snoopy-backend/docs/openapi/automations.yaml`, and
`snoopy-backend/docs/openapi/connections.yaml`. The contracts matched that commit without a
diff.

### Credential-free authenticated observations

`npm run test:browser:fixtures` creates a loopback-only HTTPS Edge fixture with
a temporary one-day certificate and a test HttpOnly session cookie. It builds
the standalone output against `https://127.0.0.1:3443`, copies only the
standalone deployment assets, and deletes its temporary key, certificate, and
cookie state on exit. It does not use a cloud identity account, OAuth client,
database, provider token, or backend-private route.

The fixture run passed **17/17** tests:

- public and authenticated Axe coverage;
- keyboard opening, Escape close, and focus return for the connections dialog;
- domain discovery and an approval-policy join request with no invite flow;
- owner join-request approval;
- a pasted-key 409 followed by one retry with the original idempotency key;
- only the two documented subscription 403 entitlement reasons; and
- complete followed by partial workspace-export responses.

The normal `npm run test:browser` run passed **10** public visual/accessibility
and callback checks, with **12 expected skips** for fixture-only and missing
non-production-authentication cases. A same-renderer comparison with
`origin/main` found `/`, `/solutions`, and `/automation-builder`
byte-identical. `/contact` differed only at the four persistent email-link
underlines approved in the accessibility audit above; this is an intentional
NFR-35 correction, not a claim of literal byte identity with `origin/main`.

### Independent release-audit corrections — 2026-08-14

A clean Node 22 Linux install reproduced GitHub's formatting failure in exactly
five files while the existing macOS install passed. The difference was not the
operating system: the working install was stale at Tailwind `4.1.18`, while the
Round 5 lockfile resolved the broad `^4` ranges to `4.3.3`. The same clean
`4.3.3` build reproduced all four Linux screenshot failures in the pinned
Playwright `1.62.1` image, including the exact CI dimensions and pixel counts.

A disposable control then pinned `tailwindcss` and `@tailwindcss/postcss` to the
`origin/main` version, `4.1.18`. In that same renderer, `/`, `/solutions`, and
`/automation-builder` matched their committed Linux baselines exactly;
`/contact` differed by **472 pixels**, and inspection showed only the four
approved underlines. The repository now pins those two design-compiler packages
to `4.1.18`, and only `contact-linux.png` was regenerated. All four pinned Linux
visual checks pass.

The first post-fix GitHub rerun proved that `ubuntu-latest` itself was not the
renderer used by those baselines: lint, typecheck, build, architecture, Axe, and
callback checks passed, but all four screenshots had different font/layout
metrics. The browser job now runs in the same Playwright `1.62.1` Noble image
used by the independent audit, pinned by immutable digest, with `--ipc=host`.
The image already contains its matching Chromium and OS dependencies, so the
moving-runner `playwright install --with-deps` step is removed.

The failed Vercel deployment `dpl_A3KtBjVFWgf2pQBcK1HJAM2ewSBH` was inspected
with authenticated build logs. Next compiled successfully under Turbopack, then
Vercel's `onBuildComplete` failed because
`.next/next-server.js.nft.json` did not exist. Next.js 16.3 documents that file
as an output-file-tracing artifact used by standalone deployments. Production
builds are therefore standardized on Webpack, matching the existing CI/browser
audit command and producing the required trace. Post-change deployment
`dpl_3b7awnziKDBy1rYX9p3XR7De8cov` completed successfully and reached Vercel's
Ready state. Automated probes returned 200 from `/api/health`, `/`, and
`/solutions`; `/api/ready` returned the truthful 503
`{"status":"not-ready","backend":"not-configured"}` because no Preview backend
origin has been allocated. Deployment is therefore observed; backend-integrated
Preview behavior remains not configured rather than silently claimed.

### Final exit evidence

- `npm run format:check`, `npm run lint`, and `npm run typecheck` passed.
- `npm run test:contracts` passed **28/28**.
- `npm run audit:boundaries` passed with no browser secret, direct database,
  storage, or manual-login path.
- `npm run verify:platform-contracts` regenerated and verified all three public
  declaration inputs.
- `BACKEND_API_ORIGIN=https://backend.invalid npm run build -- --webpack`
  passed.
- `rg 'prisma|@/lib/db' app components lib` returned no matches.
- `docker compose config --quiet` and `docker compose build web` passed. The
  rebuilt image runs as non-root `nextjs`, exposes only port 3000, and contains
  no database environment variable. Recreating only `snoopy-web-1` on the
  backend's external `autom8x_default` network produced `GET /api/health` →
  `{"status":"ok"}` beside the running platform services.
- `git diff --check` passed.

### Explicit non-observations and closure ownership

An actual third-party OAuth redirect/client allowlist and a deployed
non-production Edge environment remain **NOT OBSERVED**. They require
backend/deployment configuration and are intentionally outside the
credential-free web fixture. They do not justify adding local resource
configuration to Snoopy.

## Incremental merge disposition — 2026-08-14

The owner directed PR #4 to merge as an audited **incremental Round 5 web
implementation**, while leaving Round 5 open until infrastructure-dependent and
contract-dependent work can be completed. The merge must not be represented as
Round 5 closure. It allocates no cloud resource, adds no local secret, changes no
backend contract, and does not convert a non-observation into a pass.

The merge proves the automated evidence in the preceding sections against
backend commit `7b39746017d5bf861e1155f76d8b73fb4f5a73cb`. The following register
is the authoritative web-repository handoff for work that remains:

| Requirement | Status at incremental merge | Exact evidence and reason it remains open | Exact completion condition | Owner/repository |
| --- | --- | --- | --- | --- |
| Gate 4.5: sign in, subscribe, configure, activate, trigger, and watch steps in the browser | **NOT OBSERVED** | The 17-test HTTPS fixture covers authenticated policy and error boundaries, but it does not execute this complete state sequence. No integrated non-production identity/Edge environment was supplied. | In an authorized non-production environment, record the complete browser sequence against the published API, including setup rows generated from every `manifest.setup[]` control used by the selected automation. | Web observation plus deployed backend environment |
| Gate 4.5: approve in the UI and show continuation steps under the same root | **NOT OBSERVED** | The fixture observes organization join-request approval, not an automation approval continuation and its `root_run_id` chain. | Record one automation approval in the browser and verify the continuation steps retain the original root. | Web observation plus deployed backend environment |
| NFR-35 authenticated core keyboard journey | **NOT OBSERVED** | Automated Axe passed, and the fixture proves focus containment, Escape close, and focus return for the connection dialog. The playbook separately requires a human keyboard traversal of the core journey. | Record the playbook-required human keyboard traversal, or amend the backend-owned gate explicitly to accept automated evidence. | Human audit or backend governance decision |
| Third-party OAuth redirect and client allowlist | **NOT OBSERVED** | The disposable fixture uses a test HttpOnly cookie and no identity-provider account or OAuth client. | Observe a real non-production provider redirect with the deployed callback/redirect allowlist. | Deployment/identity configuration |
| Live domain, join-request, pasted-key 409, entitlement 403, and export variants | **NOT OBSERVED** | Deterministic fixture observations passed for these public-contract shapes; no deployed Edge origin and authenticated non-production workspace were supplied. | Re-run domain verification, join-request decision, connection 409 retry with the same intent key, both allowlisted entitlement 403 reasons plus an unrelated 403, and complete/unavailable/truncated exports against the deployed Edge. | Web observation plus deployed backend environment |
| BUILD-PLAN 8.3 billing page | **OPEN — PUBLIC CONTRACT BLOCKER** | The pinned public Edge contract exposes no browser checkout, portal, billing-read, price, or subscription-management operation. The page therefore remains a truthful availability placeholder; Snoopy must not invent an operation. | Backend governance defines and publishes the intended public operation and authorization behavior; backend tests it without requiring production resources; Snoopy regenerates types and implements only that contract. | `snoopy-backend`, then `snoopy` |
| Marketing byte identity | **NOT PASS under the literal gate** | `/`, `/solutions`, and `/automation-builder` are byte-identical in the pinned renderer. `/contact` differs by 472 pixels solely because four owner-approved persistent link underlines satisfy NFR-35. | Backend governance records the approved accessibility exception to byte identity. Do not silently describe the current result as literal equality. | Backend governance/design owner |
| Backend-integrated Preview readiness | **NOT OBSERVED** | The deployment is Ready and public routes respond, while `/api/ready` truthfully returns `backend:not-configured`; Preview has no allocated `BACKEND_API_ORIGIN`. | Configure an authorized non-production Edge origin during deployment work and repeat readiness and protected-route observations. | Deployment configuration |
| Round 5 closure and Round 6 sequencing | **OPEN** | The backend master-plan §0 still says Round 5, `snoopy`, and `NOT STARTED`. Snoopy is read-only with respect to that record. | In an authorized `snoopy-backend` governance session, record this incremental merge and the open register, then explicitly authorize concurrent Round 6 work or keep Round 6 blocked until Round 5 closes. | `snoopy-backend` governance |

Until the final row is updated in the master plan, the repository-of-record still
names `snoopy` as open. A session in `snoopy-mobile` must not infer Round 6
authorization from this PR merge alone.

## Round 5 re-entry disposition — 2026-09-24/26

Round 5 was re-entered on the owner's word on 2026-09-24 as BUILD-PLAN **Phase 20**
(`snoopy-backend` `9fe81b5`, PR #112). The work below happened in this repository;
its boxes flip in `snoopy-backend` at Round 5's close, which re-runs this evidence.
Every row of the 2026-08-14 register above is re-read here **by evidence, not by
date**. A row that needs production stays NOT OBSERVED and is re-dated: production
answers 503 (backend §12.1 #156) and no authorized non-production environment exists.

| Requirement (2026-08-14 row) | Disposition 2026-09-26 | Evidence |
| --- | --- | --- |
| Gate 4.5: sign in, subscribe, configure, activate, trigger, watch steps | **OBSERVED 2026-09-03, production** — by the backend's Gate 4.5 cell, not re-observed here | BUILD-PLAN Gate 4.5 line 1 (the platform's first real user at www.autom8x.ai; three production fixes shipped mid-observation, two of them this repository's — #9 and #10). This repository's own live re-observation is carried: production is down (§12.1 #156). |
| Gate 4.5: approve in the UI, continuation under the same root | **OBSERVED 2026-09-03, production, twice** — by the backend's cell | BUILD-PLAN Gate 4.5 line 2: approval `5751b10c` → continuation `e0f7267d` (origin `approval-continuation`, `root_run_id` the held run); `c61fa3cd` → `d81cc20d`. |
| NFR-35 authenticated core keyboard journey | **DECIDED BY THE OWNER 2026-09-27 — the closing session's keyboard-only traversal accepted as this half** (backend BUILD-PLAN Gate 20 line 7). It reached all seven stops of the recipe below; stop 1 failed two of its expectations — the switcher's arrow keys and Escape's focus (backend §12.1 #170) — **fixed in Round 13** (below) | The traversal's record is Gate 20 line 7's cell in `snoopy-backend` (120 records, 110 focus stops, every control with a visible indicator). Automated since: axe on every authenticated route the suite scans and on the Run, Archive and "platform could not answer" states; the switcher's keyboard behaviour as an e2e (Round 13). |
| Third-party OAuth redirect and client allowlist | **OBSERVED in production** — by BUILD-PLAN 8.2's own text | 8.2: "incremental consent and reconnect both ran through Google's screen in production, attempts `a03775c1`/`f39915f5`". |
| Live domain, join-request, pasted-key 409, entitlement 403, export variants | **NOT OBSERVED — re-dated 2026-09-26** | Fixture observations pass (the fixture suite: 39 passing at this PR, with the owner's hand-over test skipped unless asked for); a live run needs production (§12.1 #156). |
| BUILD-PLAN 8.3 billing page | **UNBLOCKED 2026-09-20 (ADR-0025) · IMPLEMENTED `ba4fd44` (#16) · live observation carried** | Four published operations, generated client only (#14); page, facade, actions, fixture member identity, four e2e + axe, 26 audit probes; Gate 20 line 1. |
| Marketing byte identity | **DECIDED 2026-09-24 by the owner: the NFR-35 accessibility exception is accepted** | `/`, `/solutions`, `/automation-builder`, `/privacy`, `/terms` byte-identical; `/contact` differs only by the four owner-approved persistent link underlines, already in both baselines. `test:visual` 6/6 green on darwin (every `npm run verify`) and linux (CI's pinned Playwright image, the "Browser regression and accessibility" job: `main` pushes `36140364318` @ `c97d557` (#14), `36147960894` @ `fddcd17` (#15), `36176059273` @ `ba4fd44` (#16), `36187006932` @ `caa12be` (#17), `36237192134` @ `961221b` (#18), `36255537829` @ `061768e` (#19); PR runs `36088330621` (#14), `36147684131` (#15), `36175809012` (#16), `36186563329` (#17), `36220159864` (#18), `36255400710` (#19) — every one green). |
| Backend-integrated Preview readiness | **NOT OBSERVED — re-dated 2026-09-26** | Needs an authorized non-production Edge origin (deployment work). |
| Round 5 closure and Round 6 sequencing | **SETTLED** — Round 6 closed 2026-08-18; **Round 5 CLOSED 2026-09-27** at Gate 20, nine lines for nine (`snoopy-backend` `ae9a2bf`, PR #113) | MASTER-PLAN §0.2 archive (both closes). The findings Round 5's close filed from the web against the real Edge became Round 13 (below). |

**Shipped since this register was written, confirmed against the code rather than the
commit subjects:** legal pages (#5 — `app/(marketing)/privacy`, `app/(marketing)/terms`,
footer links `lib/nav.ts:33-34` rendered by `components/marketing/MarketingFooter.tsx`,
sitemap rows); the workspace switcher (#6 — `components/dashboard/WorkspaceSwitcher.tsx`
→ `app/account/actions.ts` → `lib/tenancy.ts` `PATCH /v1/session/active-workspace`);
sign-out ends in a document load (#7); the forwarded Origin (#9 — `lib/platform-server.ts`);
Run-now fixed (#10), then **retired** by the owner's decision this round (`961221b`, #18).

### Progress this round (Phase 20)

| Item | Commit | Gate 20 line | Evidence |
| --- | --- | --- | --- |
| 20.2.1 regenerate the client | `c97d557` (#14) | 2 | Backend `9fe81b5`, clean; byte-identical on re-run; contracts 32/32 |
| 20.4.1 + 20.4.2 `npm run verify` + facts | `fddcd17` (#15) | 5 | Green with and without the sibling; facts 23/43/21/9; lock both ways |
| 8.3 billing page | `ba4fd44` (#16) | 1 | Owner/admin as the server enforces; no checkout while a subscription is live; no provider identifier rendered; 11 static + 4 e2e; audit 35 surfaces / 26 probes; live carried (§12.1 #156) |
| 20.3.1 account-deletion copy | `caa12be` (#17) | 3 | ADR-0028's sentences read from the rendered dialog; 409 keeps the account (raw body — F1); workspace-delete search empty, `delete?: never` asserted; audit 13 surfaces / 9 probes |
| 20.6.1 Run-now retired | `961221b` (#18) | 4 | Pause offered, no Run now, no dialog — observed in the rendered UI; Activity → both run pages; Trigger fact over every `RunOrigin`; audit 14 surfaces / 7 probes |
| 20.3.1 follow-up (review and audit of #17) | `061768e` (#19) | 3 | A failed deletion never reads as done: any 5xx or lost answer is "unknown" — the contract's 502 is bearer-only (F39) and the standalone rewrite answers 500 for a lost Edge answer; an expired session is said inline with a sign-in link, hedged after a lost answer, focus kept; the pre-existing `//` return-target redirect closed; nine e2e — one through the real rewrite (a fixture session whose answer is lost), one through the real login page, seven answered at the route; audit 29 surfaces / 24 probes, after a first audit failed on the rewrite's 500 |
| 20.5.1 this register | this PR | 6, 7 | The 2026-08-14 rows re-read by evidence (above); findings F1–F49 (below); the NFR-35 hand-over test; `test:visual` 6/6 on darwin and linux; axe on every scanned authenticated route |

Every new assertion was proved to bite by hand (Gate 20 line 8): broken, run as a
whole file, RED naming its test, restored from a SHA-256-checked copy, tree unchanged.
Each squash commit's message on `main` lists the proofs its PR ran
(`git log -1 --format=%b <sha>`), including the breaks that did not apply and the one
RED for the wrong reason (#19: a build refusal), each recorded and re-run rather than
counted. This PR adds no assertion: its hand-over test is proved skipped in the suite
and listed by its own command. Line 9 — a fresh session re-running every line — is the
close's.

#### NFR-35 keyboard traversal — the owner's recipe

Run alone, headed, from a clean checkout of `main` (Node 22):

```bash
KEYBOARD_JOURNEY=1 node scripts/run-browser-fixtures.mjs --headed --grep "keyboard journey"
```

It builds the site, starts the loopback Edge fixture, opens `/account` signed in as the
fixture owner, and pauses in the Playwright Inspector. Tab, Shift+Tab, Enter, Space,
the arrow keys and Escape only — no pointer:

1. `/account` — the sidebar links in order, each with a visible focus ring; the
   workspace switcher opens on the workspace in use, the arrow keys, Home and End
   move among its options, and Escape or a selection returns focus to it (#170,
   Round 13).
2. `/account/automations` — a card's Add, Pause, Set up (its dialog: Spending
   limit, Save setup), Run (its dialog: Vendor, Amount, Invoice reference, Start
   run) and Archive (its confirmation: Cancel returns focus).
3. `/account/connections` — Connect opens its dialog; focus stays inside; Escape;
   focus returns.
4. `/account/billing` — Choose plan and Manage billing are reachable and named.
5. `/account/settings` — Delete Account opens the dialog; "Yes, delete my account"
   meets the fixture owner's refusal (nothing is deleted), which is announced;
   Try again and Cancel are reachable; Escape closes and focus returns.
6. Sign out from the top bar.
7. `/login`, signed out — the provider buttons (F45 is closed: the fixture answers
   the provider list without a session, as the Edge does).

Resume in the Inspector ends the run. The close records the date, the route list and
anything found in Gate 20 line 7's cell; a finding becomes a register row for the next
web round.

#### Test debt named by the audits

Every `/audit-change` verdict lists the tests it would have wanted, beyond the probes it ran
itself (the probes all passed). They are the next web round's test backlog:

- #14 (5): a subscription with status 'archived' is treated as absent: its card shows no StatusPill, no 'Connect … before going live' hint, and offers…; Add click on an archived row's card subscribes afresh (server action subscribeToAutomation → POST /v1/workspaces/{ws}/subscriptions {templat…; Pause click on a live card (setSubscriptionStatus → PATCH {status:'paused'}) re-renders the card Paused / Go live / Run now disabled; Go live click on a paused card with no unmet connections (PATCH {status:'live'}) re-renders the card Live / Pause / Run now enabled; Set up modal: SetupFieldMetadata renders AutomationSetupField.notifies verbatim (enum now includes 'run-succeeded'); Escape closes the dialo…
- #15 (9): verify.mjs lock semantics; verify.mjs skip branch (sibling absent); verify.mjs full run emission; repo-facts counts reproduce from their commands; dirty-tree warning; repo-facts CLI entrypoint; repo-facts pipefail (failing producer must throw, never record 0); generate-platform-contracts.mjs SNOOPY_BACKEND_ROOT resolution; contract tests honour SNOOPY_BACKEND_ROOT; .gitignore ignores the facts path
- #16 (15): No active workspace empty state; Lost access (403/404 from the billing read); Unavailable (503 NotConfigured from billing or plans); Breakage rethrown (500 from billing; undocumented 404 from plans); Empty plan list and the no-plans needsCheckout copy; portal body {}; Portal refused when the active workspace changed; Action unreachable stays in the panel; Pending state: only the pressed control says Opening…, all disabled; Departure lock after window.location.assign; bfcache restore reloads; https-only hosted URL guard (checkout and portal; http:// and unparsable); Server refusals shown as the problem title (checkout 403/404, portal 403); Every non-active billing status: pill label/tone, period line wording, checkout vs portal door; Capability copy; StatusPill labels on the other dashboard pages
- #17 (8): R4 'Try again' re-issues the DELETE; R5 Cancel closes, clears the error, restores focus; R6 Escape / backdrop close the dialog; R7 in-flight guard; R8 other HTTP problem / network failure render inline; R9 502 treated as deleted; R11 failed courtesy sign-out still leaves; R12 dialog accessibility
- #18 (6): R3 Pause click; R4 Go live on a non-live subscription; R5 Set up + setup modal; R7 Activity empty state; R10/R11/R12 Trigger labels for manual / approval-continuation / retry-continuation; R14 /account/approvals (pre-existing gap, not introduced here)
- #19 (16): focus after a 409 and after a fetch that never answers; 200: courtesy sign-out; every other 5xx through the real rewrite (A1); the Edge silent past the 30 s proxy timeout (A1); the hedge after Escape / backdrop close (A2); other 4xx through the real rewrite; close() forgets a 409/403; keyboard after expiry; axe on the open dialog in each state; Sign in again with a still-valid session; Sign in again after the session ended; signed-out login page return_to for crafted targets; safePlatformReturnTo / loginHref behaviour; confirm button focus ring; Button runtime for every importer; platform-api existing exports for other importers

### Findings — for `snoopy-backend`, and for the next web round

Filed here because a `snoopy` session never edits `snoopy-backend` (AGENTS.md rule 1).
Each names the evidence a backend session can re-run.

**Contract / Edge (the backend to decide or fix)**

- **F1** `DELETE /v1/account` answers its 409 with the raw Access result `{deleted:false, workspaces, reason}` as `application/json` (`snoopy-backend/apps/api/src/app.ts:463-466`), while `snoopy-backend/docs/openapi.yaml:428-435` publishes `application/problem+json` `ApiProblem`; no backend test asserts the 409 at either route. The web branches on status only (#17).
- **F3** `POST …/billing/portal`: the contract marks the body optional (`required: false`), the Edge answers 400 "Request body is required" on an empty body (`snoopy-backend/packages/http/src/index.ts:225-227`). The web sends `{}`.
- **F4 / #158** `siddak1234/snoopy`'s GitHub Actions ran and passed on 2026-09-25 (`main` pushes `36140364318` @ `c97d557`, `36147960894` @ `fddcd17`, `36176059273` @ `ba4fd44`; PR runs `36147684131`, `36175809012`, `36186563329`) — §12.1 #158's billing block did not apply to this repository then; and `main` @ `43c2975` was RED on `test:contracts` whenever the sibling was present (fixed by #14) while CI was green without it.
- **F10** Undocumented 502s on the billing operations (`apps/api/src/modules/entitlements/billing-routes.ts:323,351,368`).
- **F12** SYSTEM-MANIFEST §9's fourth count command (`find . -name '*.test.*'`) counts `node_modules` (351 on this machine on 2026-09-26 — the number moves with `node_modules`); the facts file states `git ls-files --cached --others --exclude-standard` forms for all four units — §9 should quote the facts file.
- **F14** "163 `@theme` tokens" (AGENTS.md:42, §9.2) is the whole-file custom-property count; 46 sit inside `@theme {}`, and 4 more in an `@theme inline {}` block.
- **F20 (owner call)** The website offers no Archive/Remove action for a subscription; archiving is the backend's only way to free a plan slot (18.5.3), so a workspace at its plan limit cannot free one from the browser — 18.5.3's client half.
- **F23** GitHub reported six Dependabot vulnerabilities on `main` (4 critical, 2 high) at the round's open and four (2 critical, 2 high) at the 2026-09-25 pushes — PRs #11–#13 (`next`, `sharp`, `js-yaml`/`@redocly/openapi-core`), whose own CI runs pass; owner's call, not this round's.
- **F39** `DELETE /v1/account`'s documented 502 ("deleted, but the identity provider could not be reached to revoke the session") is raised only for a bearer caller: `snoopy-backend/apps/api/src/app.ts` (the `/v1/account` handler) throws it only when `revoking` is set, and `nativeLogoutSession` returns `undefined` for a request with no bearer — every request the website makes; a website's failed cookie revocation is folded into 200 (its cookies are cleared regardless). Every 502 a cookie caller can receive on that route is the Access client's `dependencyFailure` (`snoopy-backend/apps/api/src/modules/access/client.ts`: unreachable, invalid body, unexpected status) — the deletion did not run, or its outcome is unknown. Both outcomes share `DEPENDENCY_FAILURE` / `urn:autom8x:problem:dependency-failure`. The contract should say the 502 is bearer-only, and the two outcomes should carry distinct codes. (#17 had read the contract literally and signed the person out on any 502; #19 reverses it.) **F36** — the earlier note that the Edge should clear its cookies on its 502 path — is superseded by this reading: for a cookie caller it clears them before any 502 could be raised, and raises none.

**Web (this repository's next round; not this one)**

- **F2** `/login?deleted=1` is never read; `app/(auth)/account-deleted/page.tsx` exists and is linked from nowhere.
- **F5** The checkout lives in iCloud-synced `~/Desktop/Business Infra`: files are evicted (16,766 at this round's open, 1,518 under `.git`) and Finder duplicates (`* 2.*`, `* 2`) re-appear under `.next/` during builds; both gates refuse them by design. Excluding the repository from sync ends the class.
- **F6** `verify:platform-contracts` rewrites the generated files in place and does not restore on "stale". **F7** the generated files carry no source sha (the cell records it by hand).
- **F8** Connections and Settings → Export have no UI role gate (the server enforces). **F9** action files interpolate the server-resolved workspace id without `encodeURIComponent` (the facades do).
- **F13** `.claude/launch.json` references a nonexistent `npm run db:studio`. **F15** `scripts/audit/run-gates.mjs` omits `format:check` and `verify:platform-contracts` (both in `npm run verify`). **F16** the `browser` CI job is not a required check. **F17** local Node 24 vs the pinned 22 (`.nvmrc` added in #15).
- **F18** the web had no handling for the contract's `archived` subscription status (now treated as absent, #14). **F21** `app/account/automations/page.tsx` `byTemplate` is keyed by `templateId`, last-wins over a `created_at DESC` list — with project-scoped subscriptions the oldest hides the newer. **F22** `AutomationSetupField.notifies` renders the raw wire token (`run-succeeded`, `approval-expiring`, …).
- **F24** `scripts/verify.mjs` duplicates `run-gates.mjs`'s preflight, lock and rewrite assertion (~70 lines); a shared `scripts/audit/preflight.mjs` would end it — touching the audit machinery was outside 20.4.1. **F25** `run-gates.mjs` itself acquires its lock non-atomically and treats an empty lock as pid 0 (`process.kill(0, 0)` signals its own group) — `verify.mjs` does neither.
- **F26** The app has no `error.tsx` boundary at any level; a rethrown platform failure renders Next's default error page.
- **F27** Pages call `getAppSession` → `listWorkspaces` → `resolveActiveWorkspaceId` sequentially, and the account layout already made the same calls (`cache: "no-store"`) — up to three extra round trips per render.
- **F28** `activeWorkspaceId()` and `failure()` are private copies in the automations, connections and billing action modules; one `requireActiveWorkspaceId()` in `lib/tenancy.ts` would serve all three.
- **F29** Four private empty-row helpers (`Empty`/`EmptyRow` in approvals, automations, runs, billing) render one markup; no shared component exists in `components/dashboard`.
- **F30** The loopback fixture's billing state (`subscribedPlan`), like its connection and export state, lives for one fixture process and is never reset through the published API; the billing e2e orders its own steps.
- **F31** The fixture keys its workspace routes to the organization (`isWorkspacePath`); a personal-workspace billing read is an undeclared route (501, "fail closed"). Per-workspace fixture billing would let the suite run in more than one worker.
- **F32** From `/account/billing` the "no backend configured" path is unreachable (the account layout redirects first); the facade guard still serves its other callers.
- **F33** (closed by #19) The error-to-copy mapping was written out in `ContactForm.tsx` and `DeleteAccountButton.tsx`; the dialog now has its own status table (`outcomeFor`), and `ContactForm.tsx` keeps the only generic mapping.
- **F34** The loopback fixture's `DELETE /v1/account` 200 does not clear the session cookie the way the Edge does (`snoopy-backend/apps/api/src/app.ts:438-448`); harmless today because the component's courtesy sign-out clears it, but a future "signed out without the courtesy logout" test needs the fixture to mirror the Edge (#17's audit).
- **F37** `e2e/accessibility.spec.ts`'s authenticated route list lacks seven of the fourteen authenticated pages — `/account/approvals`, `/account/projects/[id]`, `/account/runs`, `/account/runs/[runId]`, `/account/support`, `/onboarding/join-org`, `/onboarding/setup-org` — so axe never scans them (#18's audit named three; this PR's audit counted seven; pre-existing).
- **F38** The loopback fixture declares no `PATCH /v1/workspaces/{id}/subscriptions/{id}`, so Pause / Go live / Set up can only surface a 501 refusal in the suite — the automation card's retained mutations have no positive fixture path (#18's audit; pre-existing).
- **F40** Session expiry (401) is handled inside `DeleteAccountButton` only; `LinkedAccountsSection.tsx`, `OAuthButtons.tsx` and `hooks/use-app-session.ts` also call `platformApiJson` and none handle a 401 — one rule in `lib/platform-api.ts` (or a shared hook) would serve every caller, with the return target derived from the current path as the deletion dialog now does (#19's review).
- **F41** `platformApiJson` reads `body.title` untyped: a JSON intermediary answering `{"title": {}}` would render "[object Object]" through `FormError`; gate on `typeof body.title === "string" && body.title.length > 0` (#19's review; pre-existing).
- **F42** The sign-in return URL is still hand-built at four sites (`proxy.ts`, `app/account/layout.tsx`, `app/account/projects/page.tsx`, `app/(marketing)/automation-builder/page.tsx`) with slightly different rules (the proxy keeps the query string); #19 added `loginHref()` beside `safePlatformReturnTo` in `lib/platform-api.ts` and uses it in the deletion dialog — the other four should call it (#19's review).
- **F43** The account-deletion trigger and its confirm button carry the same hand-written error-styled class string (`rounded-full border border-[var(--error-border-strong)] bg-[var(--error-bg)] …`) rather than a `Button` variant; a `danger` variant on `components/ui/Button` would end the duplication (#19's review; the confirm button's missing focus-visible ring was fixed there).
- **F44** `focus-visible:outline-none` does nothing wherever it is used: the unlayered global `:focus-visible` rule in `app/globals.css` wins over Tailwind's layered utilities, so keyboard focus shows the accent outline and the utility's ring together (the account-deletion trigger and confirm button among them; #19's audit). Either drop the dead utility or scope the global rule.
- **F45** The loopback fixture checks the session before it answers `GET /v1/auth/providers`, so a signed-out request gets 401 and no signed-out login-page test can run against it (#19's audit).
- **F46** The deletion dialog's "any other 4xx" row shows the Edge's generic problem title verbatim ("Forbidden", "Request origin is not allowed"); the body's `detail`, or a short curated map, would tell a person more (#19's audit).
- **F47** Once an attempt on the page ended unknown, a later 401 in the deletion dialog hedges ("may already have been removed") even when an intervening 409 showed the account still there; a 409 could clear the memory. It errs cautious and never claims "deleted" (#19's re-audit, A10).
- **F48** The loopback fixture's `departed` flag is module state that never resets, so the lost-answer test cannot run twice against one fixture process (a retry or `--repeat-each` meets 401 on its first DELETE); `playwright.config.ts` configures no retries and `scripts/run-browser-fixtures.mjs` starts a fresh fixture per run (#19's re-audit, A11; the F30 class).
- **F49** No loopback-fixture automation declares setup fields (every catalog entry has `setup: []`), and `Set up` renders only when `setup.length > 0` (`AutomationActions.tsx`), so the set-up dialog cannot be reached in the harness: no e2e opens it and the owner's keyboard traversal cannot visit it (this PR's audit; the same debt as #14 R7 and #18 R5).

**Numbering.** F11 — mobile's wrapper claimed to "match snoopy" by skipping the sibling gate — became true with #15, whose `verify` skips out loud; closed. F19 — retiring Run-now would have stranded the run pages' fixture coverage — kept through Activity in #18; closed. F35 was never assigned. F36 — the Edge should clear its cookies on its 502 path — is withdrawn: F39 shows that for a cookie caller the Edge clears them before that 502 could be raised, and raises none.

## Round 13 — the web signs a person in, sells, and runs — 2026-09-27

Opened in `snoopy-backend` on the owner's word (BUILD-PLAN **Phase 21**, Gate 21) from
the findings Round 5's close filed when the real website first met the real Edge —
backend §12.1 #160–#170. The backend half landed first, because every item here reads a
contract it changed; this repository then regenerated its client from that tree
(`verify:platform-contracts` green against it). Each box flips in `snoopy-backend` at the
round's close, which re-runs this evidence.

| Item | Backend row | What changed here | Evidence |
| --- | --- | --- | --- |
| 21.2.2 a refusal is not a sign-out | #160 | Every `<Link>` in the account area has `prefetch={false}`. `getAppSession()` is memoised per request and returns `null` only for a 401 or a site with no platform; a 429, a 5xx or no answer is thrown. The proxy sends a person to sign in on a 401 only — or, without asking the Edge, when the request carries no cookie at all. The account and onboarding layouts render `PlatformUnavailable` for a refusal (busy for 429); `app/account/error.tsx` does the same for a page. The four action modules that turned a missing session into "sign in again" (workspace switch, project create, export, onboarding) read it inside their `try`, so a refusal shows the platform's own answer. The login page reads the provider list on the server, cookieless, cached for a minute, and renders per request rather than at build time | `test/session-contract.test.mjs` (the four rules, every account-area link); e2e: a page view makes no RSC request after load, hovering included; a 429 and a 503 each keep the URL, say so, pass axe and send no sign-out; a page's own failed read stays inside the shell and Try again asks again; signed out, `/login` arrives with its providers and the browser asks for none |
| 21.4.2 Run | #162 | A live subscription whose **pinned** version declares `runInput` offers Run: a dialog rendered by the setup renderer (`ManifestFields.tsx`, shared), a server action on the generated `createRun` types whose idempotency key is the form's — made when the dialog opens and whenever a value changes, so a resubmission after a lost answer cannot start a second run — then the run's page. An `artifact` field is not rendered. The Run and Set up forms submit from `onSubmit`, not a form `action` — React resets an action form when it settles, which cleared the values and so the key — and a path is revalidated only after a mutation succeeded. The Run-now JSON dialog stays retired | `test/automation-contract.test.mjs`; e2e: the fixture creates the run only for exactly the declared input, typed (a number for money), and the page lands on it with the Manual trigger; axe on the open dialog; a refused start keeps the values and the key, and the same values then start the run; a refused set-up save stays in its dialog with the platform's answer and the typed value |
| 21.5.2 price and labels | #163 | A plan shows the provider's price (minor units, divided by an exponent stated per currency in `lib/plan-price.ts`; a currency it does not state is not guessed at) or "Price shown at checkout"; `workspace.rate` reads "Requests per minute"; a capability with no words is not printed | `test/billing-contract.test.mjs` (the formatter run on usd, eur, jpy and on currencies it refuses); e2e: `$5.00 per month`, "Price shown at checkout", no raw key; axe |
| 21.8.1 Archive | #169 | Archive on every subscription card, behind a confirmation that says it is one-way and gives the plan slot back; its own server action — the generic status action still refuses `archived` | `test/automation-contract.test.mjs`; e2e: Cancel returns focus and changes nothing; confirming leaves Add; axe on the dialog |
| 21.8.2 the switcher's keyboard | #170 | Opening focuses the workspace in use; ArrowUp/ArrowDown wrap, Home and End jump; Escape and a selection return focus to the trigger; while a switch is pending the options are `aria-disabled`, not `disabled`, so focus is not dropped | e2e, key by key, including a selection made from the keyboard |
| 21.8.3 this register | — | The NFR-35 and Round 5 rows above, the recipe, this section | — |
| 21.8.4 Dependabot #11 and #13 | — | `sharp` 0.35.3 → 0.35.4 and `js-yaml` 4.3.1 → 4.3.2 (through `@redocly/openapi-core` 1.34.19 → 1.34.20) — each PR's own lockfile change, applied unchanged, through this round's full gate | `npm ci` then `npm run verify` on the result |

**Findings above that this round closes:** F1 (the 409 is published as sent — backend
#164; the fixture's body now `satisfies` the generated `AccountDeletionResult`), F3 (the
portal takes no body — #165), F10 (the billing 502s are documented — #166), F20 (Archive —
#169), F39 (the bearer-only revocation 502 has its own code — #167; for a cookie caller
every 502 on that route still means "unknown", as #19 reads it), F45 (the fixture serves the
provider list without a session), F49 (the fixture's live automation declares a setting, so the Set up dialog is reached and tested). **Narrowed, not closed:** F26 — the account area has an
error boundary; the rest of the app has none; F27 — the session read is shared by the layout
and its page, the workspace list is still read by both; F38 — the fixture declares the
subscription PATCH for a set-up save and the archive, not for Pause or Go live.

**New findings this round — for the next web round:**

- **F50** `e2e/marketing.visual.spec.ts` screenshots a marketing page while the nav's own
  session check can still be in flight: once, under a concurrent image build, `/automation-builder`
  differed by 850 px — the nav showed its loading `…` where the baseline has "Sign in" (the
  suite's origin is unroutable, so that check ends in a DNS failure). Green on the re-run with
  nothing else running; the test waits for fonts, not for the nav.
- **F51** A server action or route handler sends the Edge a `Cookie` header with cookie
  attributes in it: `e2e-public-edge-session=owner; Path=/`. **Reproduced by #22's change
  audit on the merged tree**: 56 of 454 requests the website made to the Edge, every one
  from a server action or a route handler and none of the 276 from a page render; the
  fixture's single session cookie is enough. The line is `cookie: cookieStore.toString()`
  in `lib/platform-server.ts`, which predates Round 13 (`c1ee25af`). The real Edge still
  finds its own cookie in such a header — every action in the round's end-to-end run
  worked — so this is a correctness defect waiting for a cookie attribute the Edge's parser
  refuses, not an observed failure. The fix is to send `name=value` pairs only.
- **F52** The connections dialog shows a refusal twice — in the panel's alert
  (`app/account/connections/ConnectionsPanel.tsx:209`) and the dialog's (`:254`), two
  `role=alert` elements for one answer. Found by #22's change audit; the file has not changed
  since `43c2975`.

**Mobile's half is not this repository's** — backend BUILD-PLAN 21.9.1 lists what
`snoopy-mobile` adopts in its own round: the regenerated contracts, a Run control from
`runInput`, Archive, and a 429 read as "try again", never as signed out.

## Round 14 — the website completes against every published contract — 2026-09-28

Opened in `snoopy-backend` on the owner's word (BUILD-PLAN **Phase 22**, Gate 22). Its
backend half landed first, as backend #116 (`d663d69`):
- The authorize answer is published as the union it is, and it takes the replace intent
  (§12.1 #172).
- The team operations publish their schemas (#173).
- A connection that needs reauthorization is re-authorized, not reused (#175).

This repository then regenerated its client from that tree. Each generated file now names
the sha256 of the contract it came from.

| Item | Register | What changed here | Evidence |
| --- | --- | --- | --- |
| 22.3.1 | F51 | Server calls send the request's cookies as `name=value` pairs (`lib/cookie-header.ts`) | `test/session-contract.test.mjs` runs Next's own response-cookie store; the fixture refuses any `Cookie` header carrying an attribute, so every action in the suite would fail if it came back |
| 22.3.2 | F9 | Every write goes through a facade in `lib/*`, which encodes each id; the action files build no `/v1/` path | the contract tests of the automation, billing, connections and export modules |
| 22.3.3 | F8 | Connect, Reconnect, Replace account, Disconnect and Export are offered to an owner or admin only; a member is told who can | `test/tenancy-contract.test.mjs`; e2e "a member is offered no control the platform would refuse them" |
| 22.3.4 | F2 | A finished deletion lands on `/account-deleted` | e2e "a clean account deletion signs out and leaves" |
| 22.3.5 | F21 | A card lists each subscription under its scope; Add offers only the scopes the automation is not in yet, and falls back to one still offered after a re-render | `test/automation-contract.test.mjs`; e2e "a card lists each subscription under its scope …" (the fixture answers 409 if a used scope is sent again) |
| 22.3.6 | F22 | A notifications switch says in words what it switches | `test/automation-contract.test.mjs`; e2e (the set-up dialog) |
| 22.3.7 | F40, F41 | One rule for a session that ends while a page is open (`sessionEnded`): the deletion dialog and the linked-accounts section say so and give the way back in; a problem's `title` is shown only when it is a non-empty string | e2e "a session that ended while the settings page was open …"; `test/structure-contract.test.mjs` |
| 22.3.8 | F46, F47 | A refusal is explained in words, not the Edge's title; a 409 clears the memory of a lost answer | `test/account-deletion-contract.test.mjs`; e2e "a refusal says in words …" |
| 22.3.9 | F52 | One refusal, one alert, in each connections dialog | `test/structure-contract.test.mjs`; e2e (the pasted-key retry, the stale replacement) |
| 22.3.10 | F53 | `/automation-builder`'s sign-in link and the `?id=` redirect point at `/account/automations` | `test/structure-contract.test.mjs`. **The page's copy still describes the canvas that was removed — the owner's call, not rewritten here** |
| 22.3.11 | backend #114 | A 429 says how long to wait, from `retry-after`, on the server and in the browser | `test/session-contract.test.mjs`; e2e (a refused start and a refused save: "Try again in 30 seconds.") |
| 22.4.1 | F26 | `app/error.tsx` and `app/global-error.tsx` | `test/structure-contract.test.mjs` |
| 22.4.2 | F27 | The workspace list is read once per request (React `cache`) | `test/tenancy-contract.test.mjs` |
| 22.4.3 | F28, F29 | One `requireActiveWorkspaceId()` for every action module; one `EmptyRow` | `test/tenancy-contract.test.mjs`, `test/structure-contract.test.mjs` |
| 22.4.4 | F42 | Every sign-in return is built by `loginHref()` | `test/structure-contract.test.mjs` |
| 22.4.5 | F43, F44 | A `danger` Button variant; the dead `focus-visible:outline-none` removed (the global rule already won, so nothing renders differently) | `test/structure-contract.test.mjs`; the visual baselines are unchanged |
| 22.4.6 | F32 | `app/api/session` (no caller) and `getProject` (no caller) removed; F32's branch is not special-cased | `test/structure-contract.test.mjs`, `test/billing-contract.test.mjs` |
| 22.5.1 | — | Cancel on a `pending` or `running` run, confirmed first | e2e "a running run is cancelled from its page …" |
| 22.5.2 | F54 | The dashboard reads the platform's run tally since the first of the month (UTC), the automations and integrations lists, and names its recent runs as Activity does | e2e "the dashboard shows the workspace's own numbers …" |
| 22.5.3 | — | A `reused` answer says the account is already connected; **Replace account** is confirmed and names the exact connection; a stale one says the connection changed; Reconnect repairs a broken grant | e2e: reused, repair (#175), replace, stale |
| 22.5.4 | F55 | **Teams**: a Teams page (all teams for an owner or admin, with Create; your own teams otherwise), a team's page (members, and one control to add someone or change a role, for an owner, admin or the team's manager), and a project's "Teams with access" (the grant, for its owner or admin). No removal is offered, because no operation publishes one (backend #174). Teams have their own page because a team's manager may be a plain member, and the organization page is for owners and admins | e2e: an owner's teams, a manager's, an admin's organization page, a project grant; axe on both new pages |
| 22.6.1 | F30, F31, F34, F38, F48 | The fixture resets before every test; a personal workspace has its own billing; a deletion's 200 clears the cookie; Pause and Go live succeed; the personal workspace's reads are declared | e2e (every test starts from `/__fixture/reset`), and one test for each |
| 22.6.2 | F37 | axe scans all sixteen authenticated pages: the fourteen, plus the two Teams pages | `e2e/accessibility.spec.ts` |
| 22.6.3 | F50 | The visual test waits for the nav's "Sign in" (the baselines hold it) | `e2e/marketing.visual.spec.ts` |
| 22.6.4 | F6, F7 | `verify:platform-contracts` restores what it finds stale; each generated file names its contract's sha256 | `test/platform-contracts.test.mjs` runs the real script on a stale copy |
| 22.6.5 | F15, F24, F25 | One preflight module and one atomic lock for `verify` and the change audit; the audit runs `verify`'s gates, in order | `test/verify-gate.test.mjs` |
| 22.6.6 | — | CI runs the authenticated fixture suite | `.github/workflows/ci.yml` `fixtures` |
| 22.6.7 | backend §12.2 #8 | CI audits the runtime tree (blocking) and the tooling (reported), builds the image and scans it (fixable CRITICAL and HIGH block), and keeps a CycloneDX SBOM. The first real scan found 8 fixable HIGH in the base image's npm, which the image never runs; npm is now deleted from the runtime stage, as the platform image does | `.github/workflows/ci.yml` `scan`; the image rebuilt and rescanned (exit 0), serving `/` and `/login` |
| 22.6.8 | NFR-36 | The functional and axe suites run in Chromium, Firefox and WebKit; the visual baselines stay Chromium's, under their old names | `playwright.config.ts` projects |
| 22.6.9 | F14 | `audit:boundaries` refuses a raw hex colour outside `app/globals.css` and the OG image (comments are not code); `AGENTS.md` rule 3 states that rule, with no token count | `test/boundaries-contract.test.mjs` runs the real audit on planted files |
| 22.6.10 | backend §12.2 #83 | The facts file carries §9.2's four component rows, each with its command, summing to `components` | `test/repo-facts.test.mjs` |
| 22.7.1 | F13 | The documents re-read against the code: `AGENTS.md` rules 3, 4, 6 and 7, README, CONTRIBUTING, `docs/ARCHITECTURE.md`, `docs/REPO-STRUCTURE.md`, and the PR template. ~~`docs/STACK-HANDOFF.md`~~, ~~`docs/SOLUTION-DESIGN.md`~~, ~~`docs/DATABASE-MIGRATIONS.md`~~ and ~~`docs/AUTH-MICROSOFT-AZURE.md`~~ removed. `.claude/launch.json`'s Prisma Studio entry removed. `.prettierignore` no longer names paths that do not exist. No document names a file that does not exist: `scripts/audit-doc-references.mjs` lists every path the documents name, a path in the platform carries its `snoopy-backend/` prefix, and a removed file is struck through where a record names it | `test/structure-contract.test.mjs` (launch scripts; one Node major); `test/doc-references.test.mjs` runs the audit on this repository and on a planted one |

**Every row's disposition, as of this round:**

- **Closed here:** F2, F6, F7, F8, F9, F13, F14, F15, F17, F21, F22, F24, F25, F26
  (Round 13 narrowed it), F27 (narrowed there too), F28, F29, F30, F31, F32, F34, F37,
  F38 (narrowed there), F40, F41, F42, F43, F44, F46, F47, F48, F50, F51, F52, F54 — each
  with the evidence above.
  - F17 had `.nvmrc` since #15; a test now holds `.nvmrc`, CI and the Dockerfile to one
    Node major.
- **Closed before this round:** F1, F3, F10, F20, F39, F45 and F49 (Round 13); F12 (backend
  §9 has quoted the facts file since Round 5's close); F18 (#14); F33 (#19).
  - F23 is closed too: `npm audit` reports 0 on the runtime tree and on the whole tree at
    this round's tree, and the three Dependabot PRs merged (#12 in Round 5's close, #11 and
    #13 in Round 13).
- **Narrowed, not closed:** F53. The links and the redirect are fixed. The page's copy is
  the owner's call.
- **Not this repository's to change:**
  - F4: backend §12.1 #158 is the backend's account; this repository's Actions run.
  - F5: the checkout's iCloud sync is the owner's machine. Both gates refuse Finder copies,
    by the shared preflight.
  - F16: which CI jobs are *required* is a branch-protection setting, the owner's. The new
    `fixtures` and `scan` jobs, and `browser`, should be required.
- **New this round, both closed here:**
  - **F55**: the organization page admitted only its owner, while every operation on it
    admits owner or admin. It now admits both, and the nav shows it where it renders.
  - **F56**: four account pages read "Dashboard" in the small-screen header. Every page has
    its title, held by a test.

**The change review's ten findings** (`/code-review`, high, on `c974177`). Eight were fixed,
each with a test that was run red against the old code. One was accepted with a reason, and
one is the backend's:

1. **Fixed.** One failed read took the whole home page with it. The dashboard's lists were
   wrapped in `emptyWhenUnavailable`, which absorbs only a site with no backend, so a 404,
   429 or 503 from any of them rethrew. Each figure now stands alone: a figure the platform
   refuses reads "Unavailable", and recent activity says it could not be read. A session
   that ended still goes to the boundary. e2e: "a figure the platform cannot answer reads
   Unavailable …".
2. **Fixed.** The fixture's team rules were not the platform's. A team grant is now judged on
   the person's project role, as `requireEffectiveProjectRole` judges it: no role is 404,
   and a grant needs owner or admin. A non-manager asking for a team's members is 403. e2e:
   "anyone on a project reads the teams granted to it, and only its owner or admin is
   offered the grant".
3. **The backend's.** A project's owner who is a plain member of the organization sees only
   their own teams. `listTeams` shows everyone else only the teams they are on, while
   `grantProjectTeam` accepts any active team. So no operation lists the teams they may
   grant. Filed for `snoopy-backend` as SYSTEM-MANIFEST §12.1 #176 at this round's close.
   Until then the page says which teams can be offered.
4. **Fixed.** The authenticated accessibility scan named the fixture's own records. Those
   pages are now scanned against the fixture only. Every scanned page must now answer 200
   at the address asked for. A not-found page keeps the address and renders its text
   only once it is hydrated, so the first version of this check read the text. It
   passed in a fast run and failed under tracing. The status is what the check reads
   now.
5. **Fixed.** Cancel acted on the active workspace, not the workspace the page showed. After
   a switch in another tab, the 404 read as "already stopped" while the run went on. Cancel
   and billing now share one guard, `activeWorkspaceIfShown`. e2e: "Cancel on a run whose
   workspace was switched away in another tab …".
6. **Accepted.** The home reads the catalog and a page of runs. The catalog is what names a
   recent run, as Activity names it, and each read now degrades on its own (finding 1).
7. **Fixed.** Join-org's sign-in return dropped `?w=`, so a person came back to create an
   organization instead of joining one. `test/structure-contract.test.mjs`.
8. **Fixed.** The organization page labelled every admin "Member". The badge is now the role
   the platform holds. e2e: "an admin reaches the organization page …".
9. **Fixed.** The hex rule's comment stripper was a regular expression, wrong both ways: a
   `/*` in a glob string hid a real colour, and `href="#add"` failed as one.
   `audit:boundaries` now parses each script with TypeScript and reads its string
   literals, template text and JSX text, never an `href`. CSS drops only `/* */`.
   `test/boundaries-contract.test.mjs` plants each case.
10. **Fixed.** Replace account read a `reused` answer as a failure. It now says the account is
    already connected. `test/structure-contract.test.mjs`.

**Numbering.** F35 was never assigned; F11, F19 and F36 were closed or withdrawn as recorded
above. F55 and F56 are new here, and no number is reused.
