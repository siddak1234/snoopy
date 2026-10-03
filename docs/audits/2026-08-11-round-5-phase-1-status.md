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
- **F10** Undocumented 502s on the billing operations (`snoopy-backend/apps/api/src/modules/entitlements/billing-routes.ts:323,351,368`).
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
- **F18** the web had no handling for the contract's `archived` subscription status (now treated as absent, #14). **F21** ~~`app/account/automations/page.tsx`~~ `byTemplate` is keyed by `templateId`, last-wins over a `created_at DESC` list — with project-scoped subscriptions the oldest hides the newer. **F22** `AutomationSetupField.notifies` renders the raw wire token (`run-succeeded`, `approval-expiring`, …).
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
- **F42** The sign-in return URL is still hand-built at four sites (`proxy.ts`, `app/account/layout.tsx`, ~~`app/account/projects/page.tsx`~~, `app/(marketing)/automation-builder/page.tsx`) with slightly different rules (the proxy keeps the query string); #19 added `loginHref()` beside `safePlatformReturnTo` in `lib/platform-api.ts` and uses it in the deletion dialog — the other four should call it (#19's review).
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
    `fixtures`, `scan` and `build-no-backend` jobs, and `browser`, should be required.
- **New this round, all six closed here:**
  - **F55**: the organization page admitted only its owner, while every operation on it
    admits owner or admin. It now admits both, and the nav shows it where it renders.
  - **F56**: four account pages read "Dashboard" in the small-screen header. Every page has
    its title, held by a test.
  - **F57**, found by this round's Compose journey. A new organization could not create
    its first team project. The Projects page offered "team" only when one of an
    organization's projects was visible, and a new organization has none. The create action
    also put a team project in the first organization listed, not the one the person was
    working in. Now the team option follows the active workspace. The action creates the
    project in the organization the dialog named, while it is still active, through the
    shared guard.
    - `test/tenancy-contract.test.mjs`.
    - e2e: "an organization with no project yet creates its first team project …" and
      "working in a personal workspace, a team project is not offered …".
  - **F58**, found by this round's first CI run. CI's Firefox could not launch, in both
    browser jobs. A container job's HOME is `/github/home`, owned by the image's `pwuser`,
    and Firefox will not start as root under a HOME another user owns. Chromium and WebKit
    do not mind. A local `docker run` of the same image has HOME `/root`, so every local
    run passed in all three engines. Both jobs now set HOME to `/root`, and
    `test/structure-contract.test.mjs` holds every job in the image to it.
  - **F59**, found by the same run. The document check looked for a file on disk, so a
    built checkout passed three references that CI's clean one failed: they name
    `.next/`, `node_modules/` and `.autom8x/`, which exist only after an install or a build.
    A path is now found in what git sees: tracked files, and untracked ones it does not
    ignore (the facts file's basis). A path git ignores is a build output and is reported
    as not checked. `test/doc-references.test.mjs` plants one on disk and one not, and both
    are not checked.
  - **F62**, found by this PR's Vercel preview, which failed while CI was green. Round
    14's settings page read the person's role before it had a session. A Vercel preview
    builds with no `BACKEND_API_ORIGIN`, so that read threw while the page was
    prerendered, and the build failed. CI builds with the origin set: the page reads its
    cookies first, so it is never prerendered and CI could not see the failure.
    Reproduced by `npm run build` with the origin unset: `main` passes, and the round's
    tree fails on `/account/settings`. The cause was in `lib/platform-server.ts`: a
    server read asked for the origin before it read the request's cookies, and reading
    them is what makes a page dynamic. Cookies are read first now, so no page is
    prerendered around a platform read, with or without a backend
    (`test/session-contract.test.mjs`). The settings page also reads the role only with
    a session, as it reads the workspace list (`test/tenancy-contract.test.mjs`).
    `npm run build:no-backend` builds as a preview
    does. It runs in `npm run verify`, in the change audit, and in CI's own
    `build-no-backend` job, and `test/structure-contract.test.mjs` holds that job.
- **Found by this round's change audit, open for the next round** (its verdict PASS; these
  did not block it):
  - **F60**: a session that ends while a page loads is told it was not signed out. The home
    page sends a figure's 401 to the account boundary on purpose (`figure()` in
    `app/account/page.tsx`), and the boundary (`components/dashboard/PlatformUnavailable.tsx`)
    says "You have not been signed out, and nothing was lost." That is untrue for a 401.
  - **F61**: the shared preflight cannot see the one server it exists to catch. It asks
    `lsof` for a listener on 3001 and 3443, and lsof 4.95 reports nothing for the process
    Next renames `next-server (v16.3.3)`; `lsof -p` on it is empty too. Observed: a
    standalone server answering 200 on 127.0.0.1:3001 while
    `lsof -nP -iTCP:3001 -sTCP:LISTEN` exited 1, and a plain Node listener on 3443
    reported. The browser gates still refuse a stale server, because they run with
    `CI=1`, which turns off `reuseExistingServer`. Binding each port would ask the
    question directly.
  - **F63**: the change audit's evidence file cannot show the browser suites' counts.
    `scripts/audit/run-gates.mjs` keeps the last 30 lines of stdout, then stderr. For the
    browser gates that is the web server's stderr, so the Playwright summary is cut off,
    and the evidence records only exit codes and durations.
  - **27 surfaces the change audit probed in a browser and no test asserts.** Each probe
    passed; each is a test to write. A static test that reads the source does not count
    as covering an interaction:
    1. the home's recent-run link opens the run;
    2. recent activity when the runs read fails, and in an empty workspace;
    3. a figure's 401 goes to the boundary, the navigation stays, Try again recovers (F60);
    4. the sidebar's Teams link, and Teams and Organization hidden in a personal workspace;
    5. the small-screen title of every account page, and the menu's Teams link;
    6. the unavailable panel's wait, in the account area and in onboarding;
    7. `/contact`'s 429 wait, and a problem with no usable title;
    8. the sign-in returns for a join link, setup-org, projects and a team's page;
    9. the builder's sign-in link and the `?id=` redirect's 307;
    10. the focus ring on the 21 controls F44 touched;
    11. Delete Account's danger colours and focus ring (F43);
    12. a 409 after a lost answer, then a 401 (F47);
    13. Disconnect, then the provider offers Connect;
    14. Replace answered `reused` names the account the platform answered with. The
        platform never gives that answer to a replace, so this is the defensive branch,
        held today by a static test;
    15. an unmet connection's link, the version notice and a disabled Go live;
    16. Cancel on a run another tab already stopped;
    17. Approvals: the empty state, a decision, and a member offered none;
    18. billing's 503;
    19. a team project refused after another tab switched workspace;
    20. the Teams pages' remaining states: personal, an unknown team, no teams, a plain
        member, Back;
    21. a team's member form refused after a switch;
    22. `app/error.tsx` and its Try again;
    23. `app/global-error.tsx`, which nothing in this tree can trigger, so it needs a build
        or a unit render that can;
    24. `GET /api/session` answers 404;
    25. `GET /api/ready` keeps its 503;
    26. the workspace list read once per request, counted at the fixture;
    27. "A team you are not on", and a project's owner who is a plain member with no
        team to offer.

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

**The second change review** (`/code-review`, high, on `9854232`, `ca777bf` and
`ec52e15`, the commits after `c974177`) found nine things. Five are fixed, each with a
test that was run red against the old code. Four are accepted, each with its reason:

1. **Fixed.** Both repositories' document checks ran only when their own URL equalled
   `file://` plus the path they were started from. A URL percent-encodes a space, and the
   owner's checkouts live under `Business Infra/`, so there the check never ran and exited
   0: a silent pass. It now compares paths. `test/doc-references.test.mjs` runs it from a
   folder with a space.
2. **Fixed.** The check read only tracked documents, but looked files up among untracked
   ones too, and counted a file deleted on disk as present. The documents and the files
   are now one view: what git sees, less what is deleted. The same test plants an
   untracked document and a deleted file.
3. **Fixed.** Replace, answered `reused`, named the row's account rather than the one the
   platform answered with. The platform never reuses a grant it was asked to replace
   (`snoopy-backend/apps/connections/src/postgres-attempts.ts`), so no fixture gives this
   answer. A static test holds the name (`test/structure-contract.test.mjs`), and the
   interaction stays on the list of surfaces to test.
4. **Fixed.** On a team project in an organization with no team yet, its owner was told
   they could give access to "the teams you are on", and that owners and admins see every
   team. That was true, and no help. They are now told the organization has no teams yet,
   with a link to the Teams page. e2e: "an organization with no team yet tells its owner
   where teams are made …".
5. **Fixed.** The fixture's created projects had nine characters in their id's first
   group from the tenth on; now always eight. The finding's other half, that a plain
   member may create a project, is the platform's own rule (`requireWorkspaceMembership`),
   so the fixture keeps it.
6. **Accepted.** Only `snoopy-backend/…` and `../snoopy-backend/…` name the platform, so a
   deeper relative link or a root-absolute one reads as missing. The check fails closed,
   so such a form cannot pass unnoticed, and no document uses one.
7. **Accepted.** `figure()` on the home page is a third degradation helper. On a site with
   no backend it reads "Unavailable" where the lists' helpers read empty. It is meant to
   differ, because a figure the platform refuses is not zero. And on a site with no
   backend the account area is not reachable: the layout finds no session and sends the
   person to sign in.
8. **Accepted.** `audit:boundaries` still refuses a fragment that reads as a colour outside
   an `href` (`router.push("#add")`, `querySelector("#cafe")`). None exists, and the rule
   fails closed: one would be reported by file and line.
9. **Accepted.** A team grant resolves its project through `findAccessibleProject`: one
   read of the workspaces, and one of each workspace's projects. Every project action
   resolves its project that way. A grant is an owner's or admin's occasional act, far
   inside a person's 120 requests a minute.

**`/security-review`** on 22.3.1, 22.3.3, 22.5.3 and 22.5.4, and on the rest of the diff:
no finding at the bar. The website's server holds no platform credential and sends the
browser's own cookies and Origin, so the Edge makes every decision. Its one functional note
is fixed here:
- A team grant posted to the active workspace, while a project's page can show a project
  from another workspace. The grant now resolves the project's workspace on the server,
  as every project action does.
- The same pass put Create team and a team's member control behind the shared guard, so
  a stale tab cannot create a team in another organization.
- e2e: "Create team on a page whose workspace was switched away …" and "a grant on a
  project from a workspace that is not the active one …".

**Numbering.** F35 was never assigned; F11, F19 and F36 were closed or withdrawn as recorded
above. F55 to F63 are new here, and no number is reused.

## Round 15 — the backend's backlog, and the web halves that wait on it — 2026-09-28

Opened in `snoopy-backend` on the owner's word (BUILD-PLAN **Phase 23**, Gate 23), with
the owner's four decisions of that day. Its backend half landed first:
- a team member can be taken off a team, and a team's access to a project withdrawn
  (§12.1 #174), and a grant may name only a team its caller can see (#176);
- a webhook automation's address is read and issued through the Edge, by an owner or
  admin (#91, #109), and a subscription says what starts its runs (`triggerKind`);
- a subscription moves to a newer version in place (#126);
- a person uploads a file for a run straight to the store (FR-14), its size signed (#139);
- a workspace is exported whole, as one file (#39).

This repository then regenerated its client from that tree.

| Item | Register | What changed here | Evidence |
| --- | --- | --- | --- |
| 23.7.1 | F64 | `.btn-ghost:hover` and `:active` draw the text in `--ghost-active-text` — the accent's 400 step in the dark theme and its 200 step in the light — where the accent on its own tint fell to 4.06:1 and, pressed, 3.60:1 (dark). _Corrected at Round 15's close: this row first said `--accent-strong` at "4.6:1 or better on every surface, both themes"; the change audit then measured the light theme's band at 4.23:1 hovered and 3.87:1 pressed (F-1), and `--ghost-active-text` is the fix_ | e2e "a ghost button keeps AA contrast when hovered and when pressed (register F64)", RED with `main`'s colours, and the pixel-measured marketing test (F-1) |
| 23.7.2 | backend #174, #176 | Remove on each member of a team (an owner, admin or the team's manager) and on each team with access to a project (its owner or admin), each confirmed first, in one new `components/dashboard/ConfirmRemoveButton.tsx`; the team's removal acts on the workspace the page showed | e2e "taking someone off a team …" and "a project's owner removes a team's access …"; `test/tenancy-contract.test.mjs` |
| 23.7.3 | backend #91, #109 | Webhook address on a webhook-started automation, for an owner or admin: create it, see the secret once, make a new one; the secret is never kept | e2e "an owner makes a webhook automation's address …" and "… offered to an admin and to no plain member"; `test/automation-contract.test.mjs` holds the refusal words to the contract's reasons |
| 23.7.4 | backend #126 | Move to vN on a subscription pinned to an older version, confirmed first, each refusal the platform names said in words | e2e "a subscription pinned to an older version moves …" and "a move the platform holds for a pending approval …"; `test/automation-contract.test.mjs` |
| 23.7.5 | backend FR-14 | The Run form renders an `artifact` field: choosing a file uploads it straight to the signed URL, cross-origin and with no cookie, and the form carries only its id; Start run waits for it | e2e ×3 in "a file for a run (backend FR-14)", the first reading at the fixture which file the run was given; `test/automation-contract.test.mjs` |
| 23.7.6 | backend #39 | Export everything, beside the quick export: followed until ready, and its link asked for again when Download is clicked, because one is signed for minutes | e2e "everything is prepared as one file …" (the third read's link) and "… has been removed is said so …"; `test/export-contract.test.mjs` |
| 23.8.1 | F60 | The account area's boundary asks the platform for the session before it claims anything: a session that ended reads "Your session has ended" with the way back in; one that is there still reads "You have not been signed out" | e2e "3, F60 — …" and the kept case in "a page whose own read fails …"; `test/session-contract.test.mjs` |
| 23.8.2 | F61 | The shared preflight binds each port on 127.0.0.1, 0.0.0.0 and `::` rather than asking `lsof` | `test/verify-gate.test.mjs` "the preflight refuses a port a server holds, whatever its process is called (register F61)", seen failing on the old preflight |
| 23.8.3 | F63 | The change audit's evidence keeps each gate's runner counts and both output tails | `test/verify-gate.test.mjs` "… keeps the runner's summary and counts …", seen failing on the old script |
| 23.8.4 | the 29 surfaces | The register's 27 and F62's two run-time paths, each held: 25 in `e2e/account-surfaces.spec.ts` (each titled with its number), #12 (F47) beside its siblings in the fixture spec, #23 by rendering `app/global-error.tsx` in `test/global-error-render.test.mjs`, F62's session that ends between the proxy and the render in the surfaces spec, and the site with no backend by `npm run probe:no-backend`, a gate in `verify`, the change audit and CI | Each surface's mutation run RED — 27 browser, 1 render, 1 probe (below) |
| 23.8.5 | the two mutations | `router.refresh()` left `CancelRunButton` inside #24, so that mutation names code `main` never held. `cancelRun`'s two `revalidatePath` calls each refresh both the run's page and Activity under Next 16.3.3 — a server function's revalidation "causes all previously visited pages to refresh when navigated to again", which Next's own `revalidatePath.md` calls temporary — so neither alone can go red. Both are kept, and the pair is held | e2e "the cancelled run reads as cancelled on its page, and Activity reached by Back says so too": both removed RED; each alone green, as the document says |
| 23.8.6 | Round 14's NEXT | The document check reads what `snoopy-backend`'s copy reads: a strike only for a file a commit once added (a one-commit clone says "not checked"), strikes paired within a paragraph, a link from its own document's folder, another repository never read from disk unless asked, no link inside a code span, and titled, angled and defined links | `test/doc-references.test.mjs`: 11 new plant tests and one changed, each of the twelve seen failing on the old script |

**Found this round, and closed in it:**

- **F65**: CI's `gates` job cloned one commit deep, so the document check could never confirm
  a strike: every struck path read "not checked". It now fetches the whole history
  (`fetch-depth: 0`), held by `test/structure-contract.test.mjs`.
- **F66**: a docs-only change audit ran lint and `format:check` and no document check — the
  one check a docs-only change most needs. `scripts/audit/run-gates.mjs` runs it, and
  `record-pass.mjs` requires it.
- **F67**: the `audit-change` skill told the auditor to check the ports with `lsof`, the check
  F61 found blind. It now describes the preflight's bind.
- **F68**: this register named a platform file without its `snoopy-backend/` prefix (F10's
  `billing-routes.ts`). The old check never read it, because it could not strip a list of
  line numbers; the ported one did, and the path now carries its prefix.
- **Not a finding, a fact the probe established**: a production runtime with no
  `BACKEND_API_ORIGIN` refuses to start (`lib/env.ts`); a Vercel preview is
  `VERCEL_ENV=preview`, which serves without one, so the probe runs as a preview.

**Bites.** Every new assertion was run RED against the code it guards, each file restored
with its hash checked:
- browser, 43: the web halves' 13 (one first stayed green — the dialog also clears the
  secret when it opens, so both clears were removed), the surfaces' 27 and three more
  (Delete Account's colours, the kept session, the pair of revalidations);
- contract, 19: C1–C13 on the web halves, C14–C19 on F60, F65, F62's gate, the render and
  `verify`;
- the probe, 1: with the proxy letting a site with no platform through, a visitor lost
  their return address, and the probe said so.

**Numbering.** F64 was filed by Round 14's fresh audit in `snoopy-backend`'s §0.1 and enters
this register here. F65 to F68 are new, and no number is reused.

**Review of this round's web half, 2026-09-28.** An adversarial review of the diff above
found fourteen issues, numbered here as it numbered them. Thirteen are fixed, each held by
a test seen failing with its fix taken out and the file restored with its hash checked; one
is declined:

1. A secret, a move's refusal or a removal's refusal was lost to Escape or a backdrop click
   while its request was pending: fixed — `components/ui/Modal.tsx` takes `dismissible`,
   false while the webhook, move and removal dialogs wait. e2e "a webhook address's dialog
   cannot be dismissed …", "a move's dialog cannot be dismissed …", "a removal's dialog
   cannot be dismissed …".
2. One shared upload flag, never reset, with no abort and no timeout: fixed — uploads are
   held per field, reset on close, stopped when the field goes, a superseded answer changes
   nothing, and the PUT is given up after the signed URL's 15 minutes. e2e "a form closed
   mid-upload stops the upload …", "an abandoned upload that ends never releases Start run
   …", "an upload the store never answers is given up …".
3. The complete export stopped following at one failed read, dropped a rejected read
   unseen, and scheduled a read after the page had gone: fixed — a failed read is asked
   again after twice the wait, three in a row are said with Export everything offered
   again, and nothing is scheduled off the page. e2e ×4 in "following a complete export
   when a read of it fails".
4. Both exports acted on the session's workspace, not the page's: fixed — they carry the
   workspace the page showed (register F28). e2e "an export from a page whose workspace was
   switched away in another tab says so, and exports nothing (register F28)".
5. A refused file stayed in its chooser, so the same file chosen again was no change:
   fixed — it is emptied. e2e "a file of a type the automation does not take …".
6. Declined: every 404 on the webhook read is "no address yet". The contract's
   `readWebhookEndpoint` says only "404 when no address has been issued" and names no
   reason, and the platform's read answers a bare 404 whether or not the subscription
   exists, so nothing tells the two apart. Issuing an address for one that is gone is
   refused, and said.
7. `artifact_unavailable` read as "check each value": fixed — said in its own words, and
   the file field emptied to choose again. e2e "a file the platform will no longer take …";
   `test/automation-contract.test.mjs` holds the words to `createRun`'s reasons.
8. The no-backend probe missed a server killed by a signal and then waited for an exit
   already gone: fixed. `test/verify-gate.test.mjs` "the no-backend probe stops at once
   …".
9. The preflight bound the ports before taking the lock: fixed — the lock first, given back
   when a port is refused. `test/verify-gate.test.mjs` "the preflight takes the lock before
   it asks about a port …".
10. The evidence's counts read TAP only: fixed — node:test's spec summary too, in the F63
    test.
11. The account boundary said "could not answer" while it asked: fixed — a neutral
    "Loading…" until the answer. e2e "F60 — while the boundary asks for the session it
    claims nothing …".
12. Focus fell to the page after a move or a removal, and a new secret was not announced:
    fixed — focus goes to the card's or the list's heading, and a polite status says a new
    secret was made (never the secret). Asserted in the move, removal and webhook tests.
13. A manager who took themselves off a team refreshed into not-found: fixed — they go to
    their teams, as leaving a project does. e2e "a team's manager who takes themselves off
    it goes back to their teams …".
14. The switcher's focus test never checked the focus was on an option: fixed, in "10 — …".

The backend's own review of its half (`snoopy-backend` BUILD-PLAN 23.6.3, merged as
`215697c`, #118) changed three contracts this website reads, and the client is regenerated
from that tree:

- A move is also refused while a run of the automation is pending or running (409
  `runs_in_flight`). It is said in words ("A run of this automation is still going. Wait
  for it to finish, then move."). The e2e test "a move refused while a run of the
  automation is still going …" went red without the words (it read "Conflict"), and
  `test/automation-contract.test.mjs`'s check of `MOVE_REFUSALS` against the spec went red
  before they were added.
- A run's file is checked against the run's own pinned limits, and one outside them is
  `artifact_unavailable`. That is item 7's words: nothing new to say.
- The complete export states its one-file ceiling (`too_large`, already in words here), and
  a deleted workspace withdraws its export (`workspace_deleted`), which no page of a
  deleted workspace can show.

**Change audit of `97021f9`, 2026-09-28.** It found **F-1**: in the light theme a ghost
button's hovered and pressed text on the marketing band measured 4.23:1 and 3.87:1. Fixed by
`--ghost-active-text`, and held by the pixel-measured e2e "a ghost button keeps AA contrast
hovered and pressed: … (register F64)" in `e2e/accessibility.spec.ts`, which went red at 4.23
without the light step. It also listed 21 surfaces that worked and that no test held. Each is
now held by a test that was seen failing against the code it guards, with each file restored
and its hash checked. The fixture Edge has a control for each refusal, reset by
`initialState()`. The tests are in `e2e/public-edge-fixture.spec.ts` unless marked AS
(`e2e/account-surfaces.spec.ts`) or VG (`test/verify-gate.test.mjs`): 1 → "each refusal of a
move the platform names …"; 2 → "a webhook address the platform will not read …"; 3 → "an
address the platform will not make …"; 4 → "an address the platform has no public origin for
…"; 5 → "a file the store refuses … no cookie of the browser's" (the session cookie is
SameSite=Lax and never crosses to the store's scheme anyway, so the test holds a cookie that
may cross); 6 → "a file the store took but the platform finds did not arrive …"; 7 → "an empty
file is refused in words …"; 8 → "each refusal of a file the platform names …"; 9 → "the Run
dialog dismissed by Escape or by a click outside it mid-upload …"; 10 → "an export that failed
says why …"; 11 → "an export that is ready but partial …"; 12 → "Export everything the platform
refuses …"; 13 → "a download whose fresh link the platform cannot read …"; 14 → "a download
after another tab switched workspace …"; 15 → AS "a team member's removal after another tab
switched workspace …"; 16 → "a team's access the platform will not withdraw stays …"; 17 → AS
"F60 — when the boundary's own session read fails …"; 18 → "a dialog that sends nothing yet
closes on a click outside it …"; 19 → F-1's test; 20 → VG "a docs-only change audit runs the
gates its marker requires …"; 21 → VG "the browser fixture run passes every spec that needs the
fixture Edge, and no other".

**Change audit of `f5e8493`, 2026-09-28.** It found **F-2**: the webhook address dialog read
and issued for the ACTIVE workspace, so after a switch in another tab it read the other
workspace's 404 as "no address yet". Both webhook actions now take the workspace the page
showed (`activeWorkspaceIfShown`), fixed in `a2e6d74` and held by AS "a webhook address opened
after another tab switched workspace is refused, never read as \"no address yet\" (register
F28)", with the fixture answering the personal workspace's read with a 404 as the platform
does; it went red with the fix taken out. The audit of `a2e6d74` then PASSED, with 14
surfaces probed and passing that no test held — test debt, carried in `snoopy-backend`'s
MASTER-PLAN §0.1 NEXT.

## Round 15's close — the findings it made, fixed before it closed — 2026-09-29

`snoopy-backend`'s close of Round 15 ran this repository's `verify` at `main` `de40e65` and a
`/code-review` of `97021f9..de40e65`, and measured the marketing band. On the owner's word
("complete the items then merge … i dont want buggy items"), each finding is fixed here rather
than carried.

- **F69**: the ghost text AT REST on a section band — "Contact support" on
  `/automation-builder` — measured 3.92:1 (dark) and 3.99:1 (light) at its worst pixel. A band
  now carries `section-band` (`components/ui/Section.tsx`), and a ghost button on one draws its
  text in `--ghost-active-text` at rest too. The marketing test measures each ghost button AT
  REST as well as hovered and pressed; without the rule it went red at 3.87–3.99:1. The marketing
  baselines are unchanged: the recoloured text is within Playwright's default per-pixel
  threshold, and all six pages still pass.
- **F70**: every action on the automations, approvals and connections pages acted on the
  workspace active NOW — after a switch in another tab, Add and Connect wrote into a workspace
  the person was not looking at, and the rest read its 404 as this page's answer. Each now
  sends the workspace its page rendered and is refused in words (`WORKSPACE_CHANGED`) once that
  is not the active one: ~~`app/account/automations/actions.ts`~~ (Add, Set up, Run, Pause and Go
  live, Archive, Move, Approve and Reject), `upload-actions.ts` (a run's file),
  `app/account/connections/actions.ts` (Connect, Reconnect, Replace, a pasted key, Disconnect).
  Held by `test/tenancy-contract.test.mjs` "no server action acts on the workspace active NOW
  …", which walks every `"use server"` module. Browser tests switch the workspace in another
  tab, use each control, expect the refusal words, and find nothing changed once switched
  back:
  - automations, two tests: Add, Pause, Move, Archive, Run, and a file refused as it is opened;
    then Set up and Go live;
  - approvals, two tests: Approve and Reject, each still pending at the platform;
  - connections, two tests: Reconnect, Disconnect, a pasted key and Replace; then a fresh
    Connect, which asks the provider for no consent;
  - "a file opened before another tab switched workspace is refused as it completes …".

  Eight mutations — each guard handed the ACTIVE workspace, as the old code did — each ran RED.
  The first version held only 11 of these 16 controls; the change audit found the other five
  (below).
- **F71**: the review's test findings. The fixture said a refusal control holds "until the
  next control" — it holds until reset. The pixel measure could score a sample outside the
  screenshot as transparent black; it now refuses a box outside the image. F64's button was
  measured two ways, by pixels in one test and by axe in the other: both tests now measure it
  with one `worstContrast` in `e2e/helpers.ts`, and the account test still scans the rest of
  its page with axe.
  Proving F69 found two timing faults in that test, each measured before it was changed: a
  stored theme fades every colour in on load, and a read at 17–92% of that fade gave 4.30:1 —
  it now waits for the page's finite transitions (`settledPage`); and in WebKit the hero was
  replaced once the nav's session check answered — it now waits for that answer, as the visual
  test does (F50). 18 cases × 5 repeats in three engines: 90 of 90.
- **F72**: "a move's dialog cannot be dismissed while the platform decides …" pressed Escape
  the moment the refusal showed, but `setError` after an `await` inside `startTransition`
  renders before the transition's `pending` ends — 1 red in 30 WebKit runs on `main`'s code. The
  test waits for Move to be enabled first, as its sibling does: 0 in 120.

  That was half of it. The change audit of `b134a4f` met it again, once in WebKit, after the
  wait: Move enabled, Escape pressed, the dialog still open. `Modal` synced `dismissible` into
  its ref in a passive effect, which runs after the commit that enables Move, so an Escape in
  that gap was ignored. This register had said a layout effect was "not the cause". That was
  measured without the wait, when the dialog was rightly not dismissible, so it could not show
  this. Measured before it was changed: a test that presses Escape the instant Move is enabled
  again kept the dialog open 15 of 15 times in three engines. `Modal` now syncs the ref in a
  layout effect, in the same commit, and the same test closed it 15 of 15. That test is now in
  the suite ("a move's dialog closes on an Escape pressed the moment its answer enables Move
  again"). With the passive effect put back, it failed 6 of 6.
- **F73**: "4, 20 — the sidebar's Teams link opens Teams …" failed once in Firefox, in `verify`
  on this change's tree: `page.goto: NS_BINDING_ABORTED`. The switch's action can show the new
  workspace before the `router.refresh()` after it returns, and the test navigated then. Firefox
  cancels a page's requests when a navigation starts, before `pagehide`. Next reads that cancelled
  refresh as a failure and falls back to a browser navigation back to `/account/teams`
  (`Failed to fetch RSC payload … Falling back to browser navigation`). That navigation aborts
  the test's. Measured before it was changed:
  - the test's own steps failed 1 in 100 in Firefox under CPU load, with that console line;
  - with the refresh held, a navigation during it failed 5 of 5 in Firefox and WebKit, and one
    after it ended passed 15 of 15.

  The test now waits for the refresh to end, finished or failed: Chromium's Next can abort it
  itself once the action's answer is shown. It passed 60 of 60 in three engines, and 100 of 100
  in Firefox under the same load. The fallback itself is Next's, and a person would meet it only
  by starting a browser navigation in that instant, so the website is not changed.

- **F74**: the fixture Edge answered a Connect after a Disconnect as "reused", already
  connected. The platform does not: a disconnected grant is not connected (backend ADR-0019
  §2). The change audit of `fd93da4` found it (A-1). The fixture now asks for consent, and test
  13 follows Connect to the provider's consent page; with the old rule it timed out.

- **F75, F76, F77**: the change audit of `a06d43e` mapped every dialog `Modal` serves (15),
  and found three older faults. Each was fixed on the owner's word, with a test proved red
  without its fix:
  - **F75**: Leave project did not give focus back to its button when closed. The Confirmation
    field's `autoFocus` took focus before `Modal` recorded what opened it. `Modal` still focuses
    that field first.
  - **F76**: Leave project closed on Escape while the leave was on its way, and the platform's
    refusal was then shown nowhere. It now holds, as Move does.
  - **F77**: Create project listened for Escape itself as well as through `Modal`, so one
    Escape asked for the project list twice. Only `Modal` listens now.

F69 to F77 are new, and no number is reused.

**Filed for this repository's next round** — found by the same audit, not fixed here:

- 51 dialog behaviours no test holds: Escape, the backdrop and focus return across the 15
  dialogs; the hold on Cancel run, Delete account, the organization's Remove member, Replace
  account and a team's access; the Escape-at-re-enable case on every dialog that holds but
  Move. The organization's Remove member, Leave project and Add team members were never
  opened by a test. The audit's sketch of each is its verdict's `required_tests`.
- Create project and Add team members do not hold while their request is on its way, as F76
  did not (read in the code, not probed).
- The audit also measured that `a06d43e` closes the Escape-at-re-enable gap on all 8 dialogs
  that hold, not only Move: with the passive effect put back, all 8 ignored it.

The `/code-review` of this change found eight things. Four were `snoopy-backend`'s, in the same
round (§12.1 #182). Two are fixed here:

- a transition cancelled by the next state rejects its `finished`, which failed the wait for it
  (`settledAnimations` now treats that as settled, as `settledPage` does);
- the account test had lost its axe scan of the rest of the page when it moved to pixels.

`cancelRun` now reads the shown workspace with the same helper as the rest of its file. Two are
accepted, with the reason:

- F69 recolours a marketing page's ghost text at rest, where `AGENTS.md` rule 2 asks for byte-identical
  marketing pages. That recolour is the fix, and the screenshot diff still passes at Playwright's
  default threshold.
- Four action modules each read `workspaceId` from their form in one line. A shared helper
  across modules is a refactor of code this change did not otherwise need.

The change audit of `fd93da4` passed, and named seven required tests: five controls no test
used after a switch, a Reject no test clicked, and a fresh Connect. On the owner's word each
is added here, not carried:

- Set up and Go live refused, with nothing saved and the automation still paused;
- Reject refused and still pending, and Reject recorded as rejected (the fixture's `counts`
  now reads each approval's status);
- a file refused as it completes, with no file recorded;
- a fresh Connect refused, with no consent asked for;
- Connect after a Disconnect goes to consent (F74).

The comment that said the automations test refused a completion is corrected. Five mutations
each turned its test red: the shared guard, a completion unguarded, a fresh Connect
unguarded, the fixture reusing a disconnected grant, and Reject sending "approved".

## Round 16 — Flows and Teams, as the app has them — 2026-10-02

The owner's decisions after build 7 (backend BUILD-PLAN 24.11): "Flows will be the name we use
from now on"; a team is the sub-organization with its own flows — what the platform's contract
calls a project; a person asks to join one, is on it or leaves it; an organization's owners and
admins see every team; the old Teams (people groups granted onto projects) go; Unlink now; the
website matches the app end to end. This repository's half is 24.11.11, on `snoopy-backend`
#138–#140, matching `snoopy-mobile` #31 and #32.

- **Flows for Automations.** `/account/automations` is `/account/flows`; the nav, the page, the
  home and every sentence on the signed-in pages say flow. Archive is **Archive flow** (build
  9's decision 4, below; it read Remove flow until then), in the app's words: "It stops and
  moves to Archived flows. Its runs stay in Activity, and you can add it again later." Archived
  flows are listed last on Flows, each with the day it was archived, read by name
  (`status=archived`, backend §12.1 #203); only archived rows are kept, since a platform from
  before the SEVENTEENTH promotion answers the live list. The webhook dialog's first sentence
  says what the address is for.
- **Teams for Projects.** `/account/projects` is `/account/teams`. Teams lists every team the
  person is on, in every workspace, grouped by workspace. Create a team takes the kind from a
  dropdown, "Other" opening a field for their own words (`lib/team-types.ts`, the app's list) —
  in the workspace being worked in, since build 9 (below). In each organization, the teams they can ask to join:
  Request, or Requested and Withdraw, confirmed first (backend 24.11.2, 24.11.4). A team's
  page: its members (Add members, a role, Remove, Leave), the requests to join for its owner or
  admin and the organization's (Approve, Deny), and Delete for its owner. An organization admin
  who is not on a team sees it and decides, with nothing to leave (24.11.3). The directory and
  the requests answer 404 before the promotion: the asking parts are left out, never the page.
  The delete sentence no longer promises that anything reattaches — creating makes a new team.
- **The old Teams are gone**: their pages (~~`app/account/teams/[teamId]/page.tsx`~~,
  ~~`app/account/teams/CreateTeamForm.tsx`~~), a project's team grants
  (~~`app/account/projects/[id]/ProjectTeamGrantForm.tsx`~~), and the team functions in
  `lib/tenancy.ts`. The old addresses redirect (308): `/account/automations`,
  `/account/projects` and `/account/projects/:id` land on Flows, Teams and the team.
- **Unlink** on Settings' linked accounts: on a linked account, never the primary, confirmed
  first. It is called from the browser through `/api/platform`, so the renewed session cookie
  the answer carries reaches the browser, which a server action would drop. A refusal is said in
  the app's words for the reason the platform names (build 9, below) — never a problem's title
  (F41).
- **F57 and F28, revisited — then restored.** F57 held that a team project is created in the
  organization being worked in, and refused once another tab changed it. For a while Create a
  team named its workspace in the form — the organization picked, as the app then did — and the
  server accepted any workspace the person was in, without `WORKSPACE_CHANGED`. Build 9's
  decision 2 reverses that (below): F57's rule is back, for a personal workspace too. A team's
  other changes act on the workspace that holds it, resolved on the server, as a project's
  always did, and F28's walk of every action module still finds none that reads the active
  workspace unguarded.
- **F78** (new): a team's member list kept the rows it was first given, so someone added with
  Add members, or approved onto the team, appeared only after a reload — older than this round;
  Round 15's close filed that no test had opened Add members. It now follows the server's list
  after each refresh. Held by "a team's owner adds someone …" and "a team's owner approves …".
- **F79** (new): `worstContrast` (`e2e/helpers.ts`) took its hiding rule away and returned while
  the text faded back in from transparent, so the F64 test's axe scan, run next, could read it
  half-faded: "Remove flow" (now Archive flow) pressed measured 2.33:1 in Chromium. The button was never
  disabled — a probe read it enabled, with no dimmed ancestor, at every step. It now waits for
  the text to settle before returning.
- **Vocabulary.** `test/structure-contract.test.mjs` parses the account pages and the dashboard
  components and fails on "project" or "automation" in copy; the code keeps the contract's
  names. The marketing pages keep "automation" where it names what Autom8x is.
- **The fixture** (`e2e/fixtures/public-edge.ts`) answers the directory and the requests (and
  who may decide them), keeps a team's members in state (add, remove, approve), lists linked
  accounts and answers Unlink with the platform's refusal sentences, reads the archived flows by
  name, offers Microsoft as a provider, publishes `requiredConnections` on the catalog as the
  platform does, and can be a platform from before the promotion (`team-access-missing`). The
  old team routes and their switches are gone, and the export carries no `teams`, as the
  platform's does not.
- Contracts regenerated from `snoopy-backend` main at #140.

### The owner's decisions on build 9 — 2026-10-02

Build 9 gave twelve decisions (backend BUILD-PLAN 24.12), and build 10 one shared wording that
the backend, the app and this website use word for word:

1. a team IS its kind — no separate name; one team per kind in a workspace, an archived team
   freeing its kind;
2. teams in the personal workspace too, made in the workspace the person is in, with no picker;
   in an organization only its owners and admins create one (the owner's word that day: "owners
   and admins can create a team in an org. but on personal it shouldnt matter. personal is
   private.");
3. no description on create;
4. "Archive flow" and "Archived flows";
5. the join link: an organization accepts only people at its verified email domain — today's
   platform rule, no backend change — and a personal workspace stays private;
6. the centred empty state on whole empty screens only;
7. plans Free (saying Enrolled when on it), Plus — the `team` plan renamed, its id kept — and
   Pro once the owner creates its price; each card its name and its price, filling the screen;
8. a plan picked opens the provider's checkout for it; once paying, a change goes through Manage
   billing;
9. Connections is third-party integrations only;
10. Settings in categories, Sign out at the bottom;
11. bigger type across the app;
12. "Other" kind words, 2 to 60 characters.

This repository's half:

- **A team is its kind** (decisions 1–3, 12). Create a team is the kind of team alone, from the
  app's list, "Other" opening a field for the person's own words, 2 to 60 characters — the
  platform's limit on a team's name, since the kind is sent as both its name and its type. There
  is no name, no description and no workspace picker: one line says where it goes ("In Fixture
  Organization." or "In your personal workspace."), and the team is made in the workspace being
  worked in, a personal one included. In an organization only its owners and admins create one;
  a plain member is offered no Create (F8). One team per kind: the platform's refusals are the
  app's sentences — `team_kind_taken` (409, matched without case, an archived team not counted)
  "This workspace already has a team for Finance.", and 403 "Only an owner or admin can create a
  team here." The success line names people only where there can be any. A team's title is its
  kind, said once — on Teams, in the asking list and on a team's page, whose line under it no
  longer starts with the kind; a team made before keeps a separate name at the platform, which
  is not shown.
- **F57 restored** (decision 2). `createProjectAction` again compares the workspace the page
  showed with the active one (`activeWorkspaceIfShown`) and refuses with `WORKSPACE_CHANGED`
  once another tab has changed it, and creates in the one the server resolved.
  `app/account/teams/actions.ts` is back in both of `test/tenancy-contract.test.mjs`'s lists,
  and the browser tests main had are back for the new dialog ("Create a team on a page whose
  workspace was switched away …", "19 — a team created after another tab switched workspace
  …"). The action no longer refreshes the page under its dialog: the dialog's close does, as it
  did, and on an empty Teams page the refresh had taken the dialog away with the empty screen
  before it could say the team was made.
- **Archive flow and Archived flows** (decision 4), in the build 10 wording: the button, its
  dialog, the list's note ("An archived flow keeps its history here. Add it again any time."),
  each row's day ("Archived Sep 30, 2026"), the two refusals ("An archived flow cannot move.",
  "An archived flow has no address.") and the team delete line ("… until you archive them in
  Flows."). The dialog's variant for a team's flow went with the sentence that needed it.
- **Copy join link** (decision 5), on the organization page its owners and admins alone reach:
  the join page's address for the organization, on the clipboard, with "Copied" said; a refused
  clipboard leaves the address selected in a field to copy by hand. The line under it
  (`joinLinkLine`, the app's words) says what the link does, by the joining policy of the
  verified domain people can find the organization through: approval "People at example.test
  can ask to join. You approve them here.", automatic "… join as soon as they open it.", invite
  only "Joining at … is invite only, so the link lets no one in."; a verified domain not shown
  for matching emails "People at … cannot find it until "Show for matching verified email
  domains" is on."; none "Verify your email domain first — only people at it can ask to join."
  The platform's rule is unchanged (only a person at a verified, shown domain can ask), so a
  personal workspace stays private, and no element is named for an invite (D4, 4.6.4).
- **Who is asking, and which account** (backend 24.12.2, 24.12.4; the contracts regenerated from
  its #142). A join request shows the person's name and address, not their id; each linked
  sign-in account shows the address its provider reports, so two accounts can be told apart.
- **A team is its kind everywhere** (decisions 1 and 2): the dashboard's team list and Flows'
  "Team: …" read a team's kind, as Teams does; the dashboard's Create a team, with no team yet,
  is offered to an owner or admin of the active workspace alone, as on Teams.
- **Whole empty screens** (decision 6). `EmptyRow` takes an optional title, icon and action;
  with a title it is the app's empty screen — centred, an accent-tinted icon, the title, one
  line, somewhere to go — used only where a whole page is empty: Teams ("No teams yet", whose one
  Create a team replaces the top row's while it is empty), Activity ("No activity yet", Browse
  flows) and Approvals ("Nothing needs review"), in the app's words. Without a title it is F29's
  row, and every section inside a page keeps it.
- **Billing** (decisions 7 and 8). Three cards side by side: Free, then the platform's plans by
  price — the platform lists them by id, Pro before Plus, and one whose price the provider cannot
  state goes last. Each is its name and its price; Free, which the platform does not list since
  nothing buys it, is drawn here at "$0.00 per month". The workspace's plan says Enrolled, with
  its status and when it renews or ends, and Manage billing. With nothing paid, a plan picked
  opens the provider's checkout for that plan; once paying, any other card opens Manage billing
  (ADR-0025), and so does a checkout the platform refuses with `plan_exists` (backend 24.12). No
  card prints a capability. A member still sees billing gated, with no action.
- **Unlink in the app's words.** `PlatformApiError` keeps the problem's `details` (an object)
  in place of its `detail`. A 404 naming a method and a path is a platform with no unlink yet
  ("Unlinking isn't available yet."); any other 404 is "That sign-in account is not linked.";
  the reasons `primary`, `last` and `refused` are their sentences; anything else is "The account
  could not be unlinked."
- **Found on the way:**
  - **F80** (new): a connection read "Used by 1 live automation" — the vocabulary test reads only
    copy with a space or a capital, so the one lowercase word passed it. It reads "flow".
  - **F81** (new): `formatWhen` lost its comment when `formatDay` was put between them
    (`lib/automations.ts`); the comment is back above it.
  - **F82** (new): the join page said "Join your team" for an organization — older than this
    round. It names the organization ("Join Fixture Organization").
  - **F83** (new): CI's dependency scan failed on this change's first push — a critical advisory
    published 2026-09-30, GHSA-vcvr-r3jv-pc5j (Node `ImageResponse` from `next/og`, remote code
    execution where a request's values reach the image), covers `next` 16.2.0–16.3.5, and this
    site pinned 16.3.3. Its one `ImageResponse` (`app/opengraph-image.tsx`) draws fixed text, so
    nothing a request sends reaches it, and the advisory names such sites unaffected. `next` is
    16.3.6, the first release with the fix; `npm audit --omit=dev --audit-level=high` finds 0.
- **The fixture** creates a team in the organization or the owner's personal workspace — an
  organization's by its owner or admin only (403), one per kind (409 `team_kind_taken`) — and
  lists each workspace's own; offers Plus and Pro at the provider's prices, by id, refuses a
  second plan (409 `plan_exists`) and can leave Pro's price unstated (`plan-price-unstated`);
  refuses an unlink with any reason (`unlink-refused?reason=`), says a not-linked 404 with its
  sentence, and can be an Edge with no unlink route (`unlink-route-missing`); and can leave the
  organization's domain unverified (`domain-pending`). Its counts list the teams created and
  the checkouts asked for.
- **Not here.** Decisions 9–11 — Connections, the settings categories and the bigger type — are
  the app's in this change. The wording's accessibility label "Archive {name}" is not given to Archive flow: a name that does
  not hold the button's visible words fails WCAG 2.5.3 (label in name), and the dialog it opens
  names the flow. The wording's empty catalog and empty Connections were not in this change.

Proved red by hand, each file restored by SHA-256:

| Guard | Broken by | Red |
| --- | --- | --- |
| The signed-in pages say Flows | the nav saying Automations | the vocabulary test |
| Archived flows are the archived ones | the filter keeping every row | "archived flows are read by name …" (re-proved under its build 9 name) |
| No directory yet is not a failure | the 404 thrown | the tenancy test, and the browser test "before the platform has a directory …" |
| A team is made in the workspace the page showed, while it is still the active one (F57, build 9) | the shown id taken as it came, never compared | "Create a team on a page whose workspace was switched away …"; the tenancy test "a team is its kind, created in the workspace the page showed …" |
| The member list follows the server (F78) | the list frozen | "a team's owner adds someone …" |
| An unlink refusal is the app's sentence for its reason (build 9) | a 400 not read for its reason | "Unlink takes a linked sign-in account off …" |
| Approve approves | Approve sending deny | "a team's owner approves …", 10 of 10 |
| The contrast measure reads settled text (F79) | the wait removed | F64, 10 of 10 in Chromium |
| One team per kind, said in words | `team_kind_taken` not recognised | "a kind the workspace already has a team for …" (it read "Conflict"); the tenancy test "Create's refusals …" |
| A plain member's create, refused in words | the 403 not recognised | "a plain member of an organization is offered no Create a team …" (it read "Forbidden") |
| A plain member is offered no Create a team | the owner-or-admin check always true | "a plain member of an organization is offered no Create a team …" |
| The kind is the team's name too | " team" added to the name | "Create a team is the kind alone …" |
| Other's words are 2 to 60 characters | the lower bound removed | "Create a team is the kind alone …" (it read "Bad Request") |
| The dialog says where the team goes | the line replaced | "Create a team is the kind alone …" |
| A personal team's success names no one to add | the organization's line for both | "working in the personal workspace, a team is made there …" |
| A team's title is its kind | the team's page titled by its name; the Teams list titled by its name | "a plain member on a team sees no requests …"; "a plain member asks to join a team …" |
| An empty Teams page has one Create a team | the top row drawn while empty | "an organization with no team yet shows the empty screen …" (two buttons) |
| Creating a team leaves its dialog to say so | the action's refresh put back | "an organization with no team yet shows the empty screen …" (no Done) |
| A whole empty page is the app's empty screen | Activity's title removed; Approvals' title removed | "Activity with no run is the app's empty screen …"; "17 — Approvals: nothing waiting …" |
| A section inside a page stays one line | the untitled row restyled | the structure test "a whole page with nothing on it …" |
| Archive is said Archive | the button saying Remove flow | "archiving is its own confirmed action …" |
| The cards are in price order | the sort removed | "three cards side by side …" (Pro second); the billing test "three cards: …" |
| Free is Enrolled on the free floor | Free never the workspace's | "three cards side by side …" |
| No card prints a capability | the capabilities printed | the billing test "a plan card is its name and its price …" |
| Once paying, another card opens Manage billing, never a checkout | the portal branch never taken | "a plan picked opens the provider's checkout …" (two checkouts asked for, not one) |
| A `plan_exists` refusal opens Manage billing | the reason not recognised | "a checkout for a workspace that already has a plan …"; the billing test "the two hosted hand-offs …" |
| Copy join link says Copied | Copied never set | "Copy join link puts …" |
| A refused clipboard leaves the link to copy by hand | no field shown | "a refused clipboard leaves the join link …" |
| The domain line names the verified domain | a pending domain looked for | "Copy join link puts …" |
| An unlink 404 naming a route is a platform with no unlink yet | the method read as a number | "each unlink refusal is said …" (it read "not linked") |
| The browser keeps a problem's details | the details dropped | "each unlink refusal is said …" |
| A connection's count says flows (F80) | "automations" back | "a connection says how many live flows use it …" |
| The join page names the organization (F82) | "Join your team" back | "domain discovery creates an approval request …" |
| The join link's line follows the domain's joining policy | the automatic policy read as approval | the tenancy test "the join link's line follows …" |
| A join request names the person, not an id | the id shown | "organization request controls use the public join-request operation …" |
| A linked account names its address | the address not drawn | "Unlink takes a linked sign-in account off …" |
| The dashboard titles a team by its kind | the dashboard titled by the name | "the dashboard titles a team by its kind …" |
| The dashboard's Create a team is an owner's or admin's | Create offered to everyone | "the dashboard titles a team by its kind …" |
| Flows' "Team: …" is the team's kind | the scope labelled by the name | "a card lists each subscription under its scope …" |

F78 to F83 are new, and no number is reused. Build 9's proofs ran in Chromium, each test alone,
against the fixture.

### The owner's build 10 decisions — 2026-10-03

Build 10 gave nine decisions (backend BUILD-PLAN 24.13), and build 11 one shared wording that
the backend, the app and this website use word for word. Three reach this website:

- D2 — Billing: compact cards at their natural height — name, price, the status line — and Pro
  drawn at "$10.00 per month" until its price exists at the provider, not tappable; a Pro the
  platform lists replaces the drawn one;
- D4 — Teams: a flow is added to a team, in both clients, with no whole-workspace choice; with no
  team yet an owner or admin reads "Create a team first." and a plain member "An owner or admin
  creates the first team."; the flows added to the whole workspace before stay, labelled; the
  platform is unchanged;
- D6 — Flows: the website's catalog with nothing to add is the whole-page empty screen, "No flows
  to add yet" / "More are on the way."

This repository's half:

- **Compact cards, and Pro drawn** (D2). A plan's card is as tall as its name, its price and
  whatever its status adds: the minimum height and the bottom-pinned status went
  (`app/account/billing/BillingPanel.tsx`), and a card is not stretched to the tallest in its
  row. Pro is drawn last, at "$10.00 per month", while no listed plan is named Pro — by the
  name a person reads, since a plan's id is the platform's to choose and the fixture's Pro
  (`fixture-pro`) is not production's — with no control at all: a checkout for it would be
  refused (the Edge answers 404 for a plan it does not list) and the portal has no Pro to change
  to, so it opens neither door, paying or not. The platform's Pro, once listed, takes its place
  and can be bought. The order stays Free, Plus, Pro.
- **A team when adding** (D4). Add offers the teams the flow is not in yet, and no whole
  workspace (`app/account/flows/page.tsx`, `app/account/flows/AddAutomation.tsx`); the team is
  sent every time, and an Add that names none is refused before any call with the shared
  wording's "Pick a team." (`app/account/flows/actions.ts`). With no open team in the workspace
  nothing can be added, and the card says so in the app's words: an owner or admin reads
  "Create a team first." with a Create a team link to Teams, where Create a team is; a plain
  member, whom the platform would refuse, reads "An owner or admin creates the first team." —
  the role is the workspace list's (F8) — and, where the organization already has a team the
  member could ask to join (the team directory, read only in that state), "Ask to join a team
  first." with a See teams link instead: the change audit of this branch found the first line
  false there (**F84**). Neither is offered Add, and nothing is sent. A flow in
  every team shows its rows and nothing to add, as before. A flow added to the whole workspace
  before stays listed, labelled "Whole workspace" — the platform still accepts the scope, and
  this website never sends it again.
- **No flows to add yet** (D6). The catalog with nothing in it is the whole-page empty screen
  — `EmptyRow` with its title, the flow icon and one line, "More are on the way." — in place of
  the one-line section row; `test/structure-contract.test.mjs` lists Flows with Teams, Activity
  and Approvals.
- **The fixture** (`e2e/fixtures/public-edge.ts`) can list no Pro (`plan-pro-unlisted`), and a
  checkout for a plan it does not list is 404, as the Edge answers; can answer an empty catalog
  (`catalog-empty`); and accepts a flow added to a team a test created, each team's row with its
  own id. The no-team cases use the control that was there, `org-without-projects`.
- **Tests flipped to the decided behaviour, and said so here**: the F21 browser test ("a card
  lists each subscription under its team …") no longer expects "Whole workspace" among the
  options and makes a second team so there is a choice; "subscription refusals render only the
  two documented entitlement states" makes that second team first, since the plan-limit flow is
  already in the fixture's one team and had nowhere left to be added — it went red in the full
  run before this; the F70 surfaces test reads Add with nothing to choose, where it read a
  two-option list; the automation contract test's `projectId ? { projectId } : {}` is now the
  body that always carries the team.
- **Not here.** D1, D3, D5, D7, D8 and D9 are the app's; the platform's Pro row (A1) and device
  push (A2) are the platform's.

Proved red by hand, each file restored by SHA-256:

| Guard | Broken by | Red |
| --- | --- | --- |
| Pro is drawn only while the platform lists none | the platform's Pro never looked for, so a second Pro drawn beside it | the billing test "Pro is drawn at the owner's price …"; "three cards side by side …" (four cards) |
| The drawn Pro opens no door | a Choose plan button on the drawn card | "a platform listing no Pro: Pro is drawn last …" |
| No whole workspace to add to | the entry put back first in the offer | "a card lists each subscription under its team …" (a list to choose from where there was one team); the surfaces test "every automation control on a page whose workspace another tab switched away …" (Add read "Pick a team.", not the workspace line); the automation test "a flow is added to a team …" |
| No team yet is said, not nothing | `return null` with no team | "with no team yet, no flow can be added …"; the automation test "a flow is added to a team …" |
| A plain member reads who makes the first team | the owner's line for everyone | "with no team yet, no flow can be added …" (the member's half) |
| A plain member where a team exists is told to ask to join it (F84) | the ask-to-join branch never taken | "a plain member on no team, in an organization that has one, is told to ask to join it …" |
| The team is sent every time | the body sent without it when empty, and no refusal | the automation tests "a flow is added to a team …" and "a card lists every subscription it has …" |
| An empty catalog is the whole-page empty screen | the one-line row put back | "a catalog with nothing to add is the app's empty screen …"; the structure test "a whole page with nothing on it …" |

**F84** (new): a plain member on no team, in an organization that has a team, read "An owner or
admin creates the first team." on every flow card — false there; the Teams page offered "Ask to
join Operations" at the same moment. Found by this branch's change audit (probe p04), fixed above.
The fixture's directory now lists the teams a test creates, and lists its fixed Operations team
only while the organization has teams at all, as the platform's directory would. F84 is the last
number. Build 10's proofs ran in Chromium, each guard's tests alone, against the fixture.
