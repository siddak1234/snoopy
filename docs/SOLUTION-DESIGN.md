# Snoopy / Autom8x solution design

Status: **Historical proposal — backend/data/auth sections superseded**

The living cross-repository architecture and current decisions are in
[`SNOOPY-LIVING-ARCHITECTURE.md`](../../SNOOPY-LIVING-ARCHITECTURE.md). The current
website boundary is in [`ARCHITECTURE.md`](ARCHITECTURE.md). Do not use this
historical proposal to configure Supabase, Vercel, uploads, or login.
Date: 2026-08-06
Scope: `snoopy`, `snoopy-mobile`, and the repository currently named `snoopy-n8n`

This document is an evidence-based target design. It separates what exists in
the repositories from recommendations and decisions that still require an
explicit product or engineering choice.

## 1. Executive recommendation

Keep the two client applications and replace the n8n runtime with a dedicated,
code-first backend:

```text
Website (Next.js) ─┐
                   ├──> Snoopy API ───> PostgreSQL / object storage / token vault
Mobile (Expo) ────┘          │
                             ├──> durable execution service
                             └──> code workers ───> connector and AI adapters
```

The first backend shape should be a **modular monolith plus separate worker
processes**, not a collection of microservices. The API owns authentication
verification, tenancy, authorization, automation definitions, connection
metadata, run control, outputs, and the client contract. Workers own external
calls and long-running execution.

For workflows that can wait for approvals, retry external calls, resume after
process failure, or run on a schedule, use a durable workflow engine as a
candidate execution substrate. Temporal is the leading candidate to validate in
a vertical slice; it models code-defined workflows, event history, activities,
and signals/updates well. This is a recommendation to test, not a ratified
vendor decision.

The API—not the website, mobile app, connector provider, or worker—must be the
single client-facing boundary. PostgreSQL is the system of record for product
data; object storage is the system of record for uploaded artifacts; provider
tokens are server-side secrets; execution history is exposed to clients as
normalized run and step events.

## 2. What the repositories prove today

### `snoopy` — website and current server boundary

- Next.js 16 App Router, TypeScript, custom Nocturne UI, Supabase Auth, Prisma,
  PostgreSQL, and Google Cloud Storage are present in the repository.
- `/account` and `/onboarding` are protected by `proxy.ts`; the account layout
  performs a server-side session check.
- The current workflow builder persists a React Flow graph as one JSON document
  in the `Workflow.definition` field. The current persisted schema version is
  `1`; it is a canvas/storage shape, not yet an executable runtime contract.
- Website workflow actions call Prisma directly from Next server actions. This
  works for the current website but cannot be the shared mobile/backend
  boundary.
- Invoice, candidate, and job-description uploads write to GCS and then notify
  n8n with webhook calls. The candidate and JD paths use Supabase-managed tables
  such as `resume_review` and `job_postings`; invoice files/read paths use
  `gl_code_line_items`. These tables are not represented in the current Prisma
  schema.
- `docs/ARCHITECTURE.md` describes n8n as a separate runtime that writes results
  to the same Postgres database. This creates a shared-database contract without
  a single backend owner.

Relevant evidence: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md),
[`prisma/schema.prisma`](../prisma/schema.prisma),
[`app/account/workflows/actions.ts`](../app/account/workflows/actions.ts),
[`lib/workflow-types.ts`](../lib/workflow-types.ts), and the upload routes under
[`app/api`](../app/api).

### `snoopy-mobile` — product design and prototype client

- Expo Router defines an auth stack and a five-tab application shell.
- The actual tab routes are Home, Flows, Solutions, Activity, and Settings.
  The README/design copy sometimes calls the third surface Build. This naming
  difference must be resolved before API route names and navigation analytics
  are finalized.
- The Nocturne design includes Home metrics/recent runs, flow detail and
  builder, solution setup, run timelines, needs-review approvals, notifications,
  workspace settings, and reusable connections such as Gmail, QuickBooks, and
  Slack.
- Live integration does not exist yet: screens use `lib/fixtures.ts` and local
  React state. There are currently no API, session, OAuth, secure-storage, or
  database modules in the mobile source/dependency tree.
- The mobile design contract already separates Autom8x login from workspace
  provider connections and states that provider refresh credentials should be
  owned by the service, not exposed to the app.

Relevant evidence: [`DESIGN-CONTRACT.md`](../../snoopy-mobile/DESIGN-CONTRACT.md),
[`DESIGN-GAPS.md`](../../snoopy-mobile/DESIGN-GAPS.md),
[`app/_layout.tsx`](../../snoopy-mobile/app/_layout.tsx),
[`lib/fixtures.ts`](../../snoopy-mobile/lib/fixtures.ts), and the tab screens
under [`app/(tabs)`](<../../snoopy-mobile/app/(tabs)>).

### `snoopy-n8n` — legacy automation runtime

- The tracked repository contains Docker/Compose, scripts, CI/CD, and
  documentation for a self-hosted n8n 2.8.3 container.
- n8n uses a persistent local SQLite volume for workflows, credentials, and
  executions. The repository's ignored `data/` directory is runtime state, not
  a portable application data model.
- The documented pipelines cover invoice/receipt processing, GCS, Gemini, and
  Gmail ingestion. The tracked source does not contain a code backend or a
  tracked set of exported workflow definitions.
- The production image and deployment workflow are named `snoopy-n8n` and the
  runtime container is named `snoopy-n8n`.

Relevant evidence: [`README.md`](../../snoopy-n8n/README.md),
[`CLAUDE.md`](../../snoopy-n8n/CLAUDE.md),
[`Dockerfile`](../../snoopy-n8n/Dockerfile), and
[`docker-compose.yml`](../../snoopy-n8n/docker-compose.yml).

## 3. Product model to ratify

The following nouns are required by the existing UI and the desired product.
Their ownership and lifecycle should be made explicit in the API and database.

| Product noun | Meaning | Required invariants |
| --- | --- | --- |
| User | An Autom8x identity | Never enough by itself to authorize workspace data |
| Workspace | Personal or organization boundary | Every automation, connection, run, and output has a workspace scope |
| Membership | User-to-workspace relationship | Role and permissions are evaluated server-side |
| Project | Optional business/data grouping already present on web | Relationship to workspace and automation must be explicit |
| Connection | A workspace-authorized provider account | Never return access/refresh tokens to either client |
| Automation | User-facing reusable automation | Points to an immutable published version when active |
| Automation version | Validated executable definition | Published versions are immutable; edits create a new version |
| Trigger | Event, schedule, webhook, or manual entry point | Provider-specific trigger capabilities are declared, not assumed |
| Run | One execution instance | Has idempotency key, status, timestamps, and tenant scope |
| Step attempt | One attempt at a runtime step | Captures status, retry number, error classification, and timing |
| Approval | Human decision that can pause a run | Decision is authorized, idempotent, audited, and resumes the run |
| Artifact | Uploaded or generated file | Stored outside the database with metadata and tenant scope |
| Output | Structured result written for users or another connector | Uses a versioned contract and idempotent commit |

“Automations on the fly for businesses any size anywhere” implies that a new
customer should be represented by workspace configuration, connections,
permissions, and data—not by cloning a workflow or deploying a new n8n
instance. Scale controls must therefore include per-workspace quotas,
concurrency limits, backpressure, fair scheduling, and an explicit data-region
policy. The limits and regions remain decisions, not assumptions.

## 4. Target client experience

The website and mobile app should expose the same dashboard information
architecture and the same API states. They may use platform-specific layout and
navigation, but they must not invent separate automation or connection models.

```text
Home       → health, counts, recent runs, held items, failed connections
Flows      → active/draft/paused automations, detail, builder, templates
Solutions  → reusable automation templates and guided setup
Activity   → run history, notifications, approvals, run detail/timeline
Settings   → profile, workspace, members, connections, preferences, billing*
```

`*` Billing appears in the prototype but its provider, entitlements, and source
of truth are not established. It must not be treated as live backend scope until
ratified.

The existing website project/invoice/candidate pages should become data views
reachable from the shared dashboard and project context. They should read
through the same API and output contracts as mobile. Existing visual components
and Nocturne tokens are reusable; fixture data, direct n8n calls, and client-side
connection booleans are not production integration points.

## 5. End-to-end target flows

### 5.1 Sign in and select a workspace

1. The website or mobile app asks the identity service to authenticate the
   Autom8x user.
2. The API validates the resulting session and resolves the user's workspace
   memberships and permissions.
3. The client stores only an Autom8x session: an HttpOnly cookie on the web, or
   the mobile session in platform secure storage. It does not store provider
   refresh tokens.
4. The API returns a workspace summary and the selected workspace. A user with
   multiple workspaces must be able to switch explicitly; silently choosing the
   first membership is only the current website behavior, not a target contract.
5. Protected routes are enforced by the app shell/API boundary, not by trusting
   every screen to check itself.

The mobile contract requires authorization-code OAuth through an external user
agent, PKCE, state correlation, and no client secret in the native bundle. RFC
8252 and Expo AuthSession support this boundary; the exact identity provider and
session issuer remain decisions.

### 5.2 Connect Slack, Gmail, QuickBooks, or another provider

1. The client requests a connection attempt for a stable provider ID and
   workspace. The requested scopes come from the selected automation/solution.
2. The API creates a one-time state/PKCE attempt and returns an authorization
   URL or opaque attempt handle.
3. The provider callback terminates at the backend. The backend exchanges the
   code, validates the account and granted scopes, encrypts the refresh
   credential in a server-side secret store, and persists only token metadata
   and the external account identity in PostgreSQL.
4. The connector adapter normalizes provider-specific account selection,
   expiry, refresh rotation, revocation, rate limits, and errors.
5. The client receives connection metadata and status: connected,
   reconnect-required, denied, failed, or disconnecting.
6. Disconnect/reconnect behavior is explicit for automations currently using the
   connection. A revoked connection must create a visible run/configuration
   state, not silently fail forever.

The connector registry is the extensibility point. A provider is not a display
name; it is an adapter with stable ID, OAuth configuration, scope policy,
capability list, credential lifecycle, and error mapping.

### 5.3 Build, configure, validate, and publish an automation

1. The builder edits a client-safe draft definition.
2. The API validates the graph: node types, edges, required inputs, capability
   availability, connector references, scopes, output contract, and limits.
3. The API compiles the graph into an executable, versioned definition. UI-only
   coordinates and notes remain presentation metadata; runtime node config is
   separately versioned and schema-validated.
4. Publishing freezes the version and creates/updates trigger registrations.
5. Activation is blocked when required connections, scopes, or configuration are
   missing. The client receives actionable setup requirements.
6. Editing an active automation creates a draft/new version; existing runs keep
   using the version they started with.

The current web `Workflow.definition` JSONB graph is a useful migration source
for drafts, but it must not be assumed to be executable. A runtime compiler and
node capability registry are required.

### 5.4 Receive a request, run the automation, and write output

```text
Client/provider event
  → API ingress authenticates + validates + assigns request ID
  → idempotency check
  → input/artifact metadata transaction
  → outbox event
  → execution service starts a run for an immutable automation version
  → workers execute typed activities through provider/AI adapters
  → append step attempts and run events
  → pause for approval when required, or continue
  → validate and commit output transactionally/idempotently
  → notify clients and external destinations
  → API serves the updated table/run/activity state
```

The website should not wait for the whole run in a request/response cycle. A
request returns an input ID and run ID; clients then observe status through
polling, server-sent events, or a later push mechanism. The first implementation
should choose one mechanism and define reconnect behavior.

For file inputs, the preferred path is a short-lived upload URL or a bounded
stream to object storage, followed by a metadata-only API request. The current
GCS-first pattern is reusable, but the backend must create the input record and
idempotency key before dispatching work so an accepted request cannot be lost
between storage and execution.

### 5.5 Write to a table or downstream connector

Use two output layers:

1. **Canonical product tables** for stable surfaces such as invoices, job
   postings, candidates, allocations, approvals, and run history. These power
   the website and mobile dashboard with typed, indexed queries.
2. **Versioned automation records/tables** for customer-specific structured
   output that is not yet a first-class product domain. These need a declared
   schema, column types, row-level workspace scope, provenance, and versioned
   writes. JSON may carry flexible payload details, but it must not be the only
   authorization or query model.

Every output write includes source run/version, workspace, producer step,
schema version, created/updated timestamps, and an idempotency key. A connector
action such as posting to Slack or creating a QuickBooks bill is also an output
side effect and must have a retry/duplicate policy declared by its adapter.

## 6. Backend boundary and modules

The first code backend should have these modules in one deployable codebase,
with separate API and worker entry points:

```text
snoopy-backend/
├── apps/
│   ├── api/                 HTTP API, auth boundary, webhooks, health
│   └── worker/              execution workers and provider activities
├── packages/
│   ├── contracts/           OpenAPI, event schemas, status/error enums
│   ├── domain/              tenancy, automations, runs, outputs, approvals
│   ├── connectors/          provider registry and adapters
│   └── execution/           workflow compilation and orchestrator integration
├── migrations/              database migrations
├── infra/                   deployment, secrets, observability, local dev
└── docs/                    ADRs, runbooks, provider and schema contracts
```

The exact framework and monorepo layout are implementation decisions. The
module ownership is the important boundary.

| Module | Owns |
| --- | --- |
| Identity/tenancy | session verification, workspace membership, RBAC, audit context |
| Automation | drafts, versions, validation, compilation, publish/activate/pause |
| Trigger/ingress | manual requests, provider webhooks, schedules, idempotency |
| Execution | run lifecycle, durable waits, retries, cancellation, concurrency |
| Connectors | OAuth attempts, encrypted credentials, provider capabilities/actions |
| Files | upload authorization, object metadata, signed URLs, retention |
| Outputs | canonical tables, flexible records, schema validation, idempotent writes |
| Approvals | pending decisions, eligible approvers, decision events, resume control |
| Notifications | in-app activity, email/push/Slack notifications as adapters |
| Observability | structured logs, traces, metrics, run correlation, diagnostics |

Do not let workers write arbitrary rows directly into product tables. They call
domain commands or a restricted output interface so authorization, schema
validation, audit, and idempotency remain centralized.

## 7. Initial API contract

Use a versioned REST/OpenAPI contract because both a browser application and a
native app must consume the same boundary. Generate typed clients for the web
and mobile repositories from the backend contract; do not duplicate provider
logic in either client.

```text
GET    /v1/session
GET    /v1/workspaces
POST   /v1/workspaces/:id/switch

GET    /v1/automations
POST   /v1/automations
GET    /v1/automations/:id
POST   /v1/automations/:id/versions
POST   /v1/automations/:id/publish
POST   /v1/automations/:id/pause

POST   /v1/connection-attempts
GET    /v1/connection-attempts/:id
GET    /v1/workspaces/:id/connections
POST   /v1/connections/:id/reconnect
DELETE /v1/connections/:id

POST   /v1/inputs
POST   /v1/files/upload-urls
POST   /v1/automations/:id/runs
GET    /v1/runs
GET    /v1/runs/:id
GET    /v1/runs/:id/events
POST   /v1/runs/:id/cancel
POST   /v1/runs/:id/retry

GET    /v1/approvals
POST   /v1/approvals/:id/decisions
GET    /v1/activity
GET    /v1/notifications

GET    /v1/tables
GET    /v1/tables/:id/rows
GET    /v1/domain/invoices
GET    /v1/domain/candidates
GET    /v1/domain/job-postings
```

These are boundary examples, not a final API. Every mutating endpoint needs
request validation, workspace authorization, request ID, idempotency behavior,
typed error codes, and audit semantics before client implementation.

## 8. Data model direction

The current `User`, `Workspace`, `Membership`, `Project`, and invite models are
useful starting points. The current `Workflow` model should evolve into
automation metadata plus immutable versions rather than being reused as the
entire runtime model.

Minimum target groups:

```text
identity:       users, workspaces, memberships, projects, invites
automation:     automations, automation_versions, triggers, templates
connections:    providers, connection_attempts, connections, scope_grants
execution:      runs, run_steps, step_attempts, run_events, idempotency_keys
human control:  approvals, approval_decisions, notifications, audit_events
files:          artifacts, input_items, object_references
outputs:        domain tables, output_schemas, automation_tables, table_rows
integration:    outbox_events, webhook_deliveries, schedules, usage_counters
```

Database rules:

- Every tenant-owned row carries a workspace key, directly or through an
  explicitly indexed parent.
- Authorization is checked in the API/domain layer and backed by database
  policies or restricted credentials where supported.
- Run events and audit events are append-only. Mutable summary fields are
  projections, not the only history.
- Definitions and schemas have explicit versions. Published versions are
  immutable.
- Secrets are references to a secret manager/key-encryption boundary, never
  plaintext columns or client payloads.
- Unique constraints and idempotency keys make retries safe.
- Retention, deletion, export, and legal-hold behavior must be defined before
  production data is accepted.

## 9. Technology recommendation and decision gates

| Area | Recommended starting point | Why it fits the evidence | Decision gate |
| --- | --- | --- | --- |
| Backend language | TypeScript/Node | Web, mobile contracts, and current server code are TypeScript/Node | Confirm team/runtime preference |
| HTTP API | REST + OpenAPI | One contract for web and native; supports generated clients | Ratify error/versioning conventions |
| Persistence | Managed PostgreSQL | Existing app already uses Prisma/Postgres and needs relational tenancy/run/output data | Inventory and reconcile existing external tables |
| File storage | Keep GCS behind an object-store adapter initially | Existing uploads already use GCS | Confirm region, retention, signed URL, and migration policy |
| Execution | Durable workflow engine; Temporal is leading candidate | Existing UI requires retries, run history, approvals, and cloud-running agents | Build invoice vertical slice and compare operations/cost |
| Secrets | Managed secret store plus envelope encryption | Provider refresh credentials must remain server-side | Select provider and key rotation procedure |
| Queueing | Engine task queues or a managed queue, not ad-hoc in-process jobs | Requests must survive restarts and scale across workers | Define throughput, fairness, and retry limits |
| Observability | Structured logs, metrics, traces, run/event correlation | Failures must be visible from dashboard to provider call | Define SLOs and retention |
| Client sync | API reads plus a defined active-run update mechanism | Web and mobile need the same run/approval state | Choose polling, SSE, WebSocket, and push responsibilities |

Temporal's official documentation describes code-defined workflows, durable
event history, external calls in activities, and message passing for stateful
workflow control. That maps well to approvals and resumable runs, but the team
must validate operational fit before committing.

## 10. Migration and rename plan

### Phase 0 — ratify the contract before changing runtime

- Approve this design's product nouns and the decision list below.
- Inventory the live Postgres tables, RLS policies, GCS buckets/paths, n8n
  webhook payloads, provider credentials, and any data in the ignored n8n
  SQLite volume.
- Freeze new n8n workflow behavior except production fixes.
- Capture representative invoice, JD, candidate, approval, retry, and connector
  cases as contract fixtures. Do not use fixture UI data as production truth.

### Phase 1 — create `snoopy-backend` foundation

- Create the API/worker project with CI, migrations, environment validation,
  health/readiness, structured logging, request IDs, and OpenAPI.
- Implement identity verification, workspace context, RBAC, idempotency, and
  the outbox pattern.
- Add the shared domain schema without deleting current tables.

### Phase 2 — one complete vertical slice

Implement and verify one existing business path end to end:

```text
invoice upload → object storage → code worker / AI adapter
→ structured extraction + validation → canonical output table
→ run timeline → dashboard refresh → retry/approval path
```

The slice is complete only when a failed worker can resume/retry, duplicate
requests do not duplicate output, and both website and mobile can show the same
run and output state.

### Phase 3 — connector and trigger foundation

- Implement the provider registry and connection lifecycle.
- Add the first connector set based on ratified product priority. The design
  currently references Gmail, Slack, Google Sheets, QuickBooks, and HubSpot;
  that reference is not a prioritization decision.
- Add webhook/polling/schedule trigger adapters as each provider requires.

### Phase 4 — integrate the clients

- Keep the current Nocturne component/design system.
- Replace mobile fixtures and local booleans with API-backed hooks, session
  restoration, secure storage, loading/empty/error states, and explicit sync.
- Point website account surfaces and the builder at the same API contracts.
- Keep existing domain pages during migration, but remove direct n8n calls and
  make output ownership explicit.

### Phase 5 — builder, solutions, and broader automation

- Define executable node types and capability schemas.
- Convert templates/solutions into versioned automation definitions.
- Add publish validation, connection requirements, approvals, schedules,
  per-workspace limits, usage metering, and customer-visible diagnostics.

### Phase 6 — cut over and retire n8n

- Run the new backend in shadow or controlled parallel mode where safe; compare
  outputs and side effects before enabling customer-visible writes.
- Migrate only data with a defined mapping. Do not treat n8n's encrypted SQLite
  credential store as a portable source of provider tokens.
- Disable new n8n ingress, drain/complete legacy runs, preserve a read-only
  archive/runbook, then remove the old runtime path.

### Repository rename: `snoopy-n8n` → `snoopy-backend`

Do not rename the directory while it still semantically means “the n8n
runtime.” Rename after the foundation branch establishes the backend boundary.
Use an in-place repository rename to preserve history:

1. Add an archive tag/readme identifying the last n8n runtime and its data
   backup/restore instructions.
2. Rename the repository and local directory to `snoopy-backend`.
3. Rename the image, container, CI variables, deployment path, docs, scripts,
   and health checks. Remove `N8N_*` configuration as code replaces it.
4. Keep compatibility redirects/aliases for old image names, webhook URLs, and
   deployment paths only for the defined migration window.
5. Never copy the n8n SQLite database into the new product database without a
   deliberate, tested migration. Credentials require provider reauthorization
   or a separately approved secret migration.

The intended steady-state repositories are:

```text
snoopy/          responsive website and web client
snoopy-mobile/   native client using the same API contracts
snoopy-backend/  API, workers, connector adapters, execution, and migrations
```

## 11. Decisions required before implementation

| ID | Decision |
| --- | --- |
| D1 | Does Supabase remain the identity authority, or does the new backend own identity/session issuance? |
| D2 | Can a user select among multiple workspaces, and what is the exact workspace/project authorization model? |
| D3 | Which current Supabase-managed tables are production data, who owns their schema, and how are they tenant-scoped? |
| D4 | What is the executable node/capability contract behind the current canvas graph? |
| D5 | Which automation is the first paid/customer-critical vertical slice? |
| D6 | Which providers are launch-critical, and which OAuth scopes/account-selection behaviors do they require? |
| D7 | Are connections workspace-owned, user-owned, or both? What happens when a connection is removed? |
| D8 | Which outputs are canonical product tables versus customer-defined tables/records? |
| D9 | What approval roles, timeouts, escalation, rejection, and replay semantics are required? |
| D10 | Temporal versus another durable execution substrate; managed versus self-hosted operations? |
| D11 | What are expected throughput, max file size, run duration, concurrency, retention, and data-residency requirements? |
| D12 | What are the deployment, secret management, backup, restore, and observability requirements? |
| D13 | Is billing in this backend scope now, or only after automation execution is stable? |
| D14 | When is the n8n repository renamed, and what is the exact legacy cutover window? |

## 12. Definition of done for the first production milestone

- Website and mobile authenticate against the same identity/session contract and
  display the same selected workspace.
- Home, Flows, Solutions, Activity, Settings, run detail, and approvals read
  live API data; no production path depends on `lib/fixtures.ts`.
- A user can connect a provider through a verified OAuth flow; provider tokens
  never appear in client state, URLs, logs, or API responses.
- A manual request creates an idempotent run, records step events, survives a
  worker restart, and writes a validated output to the intended table.
- Approval, retry, failure, cancellation, and reconnect-required states are
  visible and actionable in both clients.
- Every read/write is workspace-authorized; tenant isolation is tested with
  positive and negative cases.
- Run IDs, request IDs, provider calls, output rows, and audit events can be
  correlated for support and incident response.
- The new backend can be deployed, backed up, restored, health-checked, and
  rolled back without depending on the n8n container.

## 13. Working rule for future changes

Every implementation PR should identify whether a statement is:

- **Verified** — supported by current code, data, or an accepted contract;
- **Proposed** — a design recommendation awaiting ratification; or
- **Decision required** — blocked on an explicit product, security, or
  operations choice.

That distinction is required until the current fixtures, direct database paths,
n8n webhooks, and draft mobile contracts have been replaced by the shared API
and execution contracts.

## References

- [Temporal workflows](https://docs.temporal.io/workflows)
- [Temporal TypeScript message passing](https://docs.temporal.io/develop/typescript/workflows/message-passing)
- [RFC 8252 — OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Expo authentication guide](https://docs.expo.dev/guides/authentication/)
