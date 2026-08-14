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

`AGENTS.md` is a separate governance-document modification. It does not map to
a Round 5 implementation item and must remain outside a Round 5 commit until
its ownership is confirmed.

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
  inputs: `docs/openapi.yaml`, `docs/openapi/automations.yaml`, and
  `docs/openapi/connections.yaml`.

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
- removed `lib/workspace-invites.ts` from the transitional database allowlist.

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
- Domain discovery and join creation exist in `docs/openapi/access.yaml` only
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
`docs/openapi.yaml`, `docs/openapi/automations.yaml`, and
`docs/openapi/connections.yaml` documents only.

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
`docs/openapi.yaml`, `docs/openapi/automations.yaml`, and
`docs/openapi/connections.yaml`. The contracts matched that commit without a
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
non-production-authentication cases. Marketing screenshot baselines remained
unchanged.

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

After the scoped Snoopy PR is merged and the required human keyboard pass is
recorded, the backend-owned master plan and Round 5 card must be updated by an
authorized `snoopy-backend` session. This repository does not edit those private
governance records.
