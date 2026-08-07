# Snoopy website architecture

Status: **Backend-boundary migration in progress**
Last verified: **2026-08-06**

This repository owns the Autom8x website and its existing Nocturne UI/UX. It is a
client/BFF of `snoopy-backend`; it is not the target owner of identity, product
data, artifacts, connector credentials, or automation execution.

The cross-repository source of truth is
[`SNOOPY-LIVING-ARCHITECTURE.md`](../../SNOOPY-LIVING-ARCHITECTURE.md). The exact
cutover evidence and remaining allowlist are in the
[`backend boundary audit`](audits/2026-08-06-backend-boundary-cutover.md).

## Current stack

| Layer | Current code | Target ownership |
| --- | --- | --- |
| UI | Next.js 16, React 19, Tailwind 4, Nocturne components | `snoopy` |
| Login | Same-origin `/api/platform` calls to backend OAuth/session routes | Edge API + Supabase Auth adapter |
| Product APIs | Browser dashboard calls to `/api/platform/v1/*` | Edge API and owning backend services |
| Legacy server data | Prisma/PostgreSQL in 17 pinned server files | Access and Automation Catalog services |
| Artifacts | Browser multipart requests to backend artifact routes | Artifact service + object store |
| Execution | No website webhook or runtime dependency | Execution service/workers |

The website no longer depends on a Supabase SDK, Google Cloud Storage SDK, or
execution-webhook configuration. It must not receive credentials for the new
Supabase project.

## Request boundary

```text
browser ──same origin──> /api/platform/*
                            │ Next rewrite
                            v
                       Edge API
                            ├──> Supabase Auth (login identity only)
                            ├──> Access service (planned)
                            ├──> Automation Catalog (planned)
                            ├──> Output service (planned)
                            └──> Artifact service (planned)
```

`BACKEND_API_ORIGIN` is the only target backend location configured in Vercel.
`next.config.ts` validates it and rewrites the same-origin path. `proxy.ts` and
server components resolve sessions through `/v1/session`. Browser code never
receives the backend origin or a Supabase key.

## Login identity

- Product login is OAuth-only: Google, Microsoft, and Apple.
- Password signup/login, magic link, verification, and reset-password routes are
  absent.
- OAuth start and callback terminate at `snoopy-backend` through the same-origin
  gateway.
- The backend owns PKCE, signed transaction state, code exchange, HttpOnly
  cookies, refresh, logout, and identity linking.
- Snoopy validates the wire session and maps `user.userId` to the established UI
  shape `user.id`.
- Login identity OAuth is not Gmail/Slack/QuickBooks connector authorization.

See [`ADR-0008`](../../snoopy-backend/docs/adr/0008-backend-mediated-oauth-login.md)
and [Microsoft setup](AUTH-MICROSOFT-AZURE.md).

## Product data and artifact routes

Dashboard clients call explicit backend paths for candidates, job postings,
invoice projections, GL accounts, invoice edits, and protected files. Upload
forms call project-scoped invoice, candidate, and job-posting artifact paths.

The matching backend routes authenticate requests, enforce first-party origin on
mutations, and currently return RFC 9457 `503 NOT_CONFIGURED` until their owning
service adapters exist. They do not return fake empty data. This preserves UI code
without pretending the new empty Supabase project has an application schema.

## Transitional database boundary

Seventeen server-side files still import `lib/db.ts` for projects, workspaces,
memberships, invites, onboarding, workflow drafts, and legacy invoice mutations.
They remain because replacement Access/Catalog/Output APIs are not implemented.

`npm run audit:boundaries` pins the exact list, rejects new direct database
callers, rejects Supabase/GCS/webhook dependencies, and verifies removed direct
auth/upload/file routes do not return. `POSTGRES_URL` and
`POSTGRES_PRISMA_URL` are legacy-cutover variables only; never point them at the
new Supabase project.

Cutover is complete only when the allowlist is zero, response compatibility and
negative tenant tests pass, Prisma/database packages are removed from this repo,
and Vercel no longer holds database credentials.

## Operations

- `GET /api/health` is website-process liveness.
- `GET /api/ready` proxies backend readiness and returns 503 when the backend is
  absent, unreachable, or not ready.
- Production startup fails closed if `BACKEND_API_ORIGIN` is absent or malformed.
- The public marketing UI can still be built without production secrets.

## Verification

```bash
npm run audit:boundaries
npm run typecheck
npm run lint
npm run build
```

UI changes require comparison against the recorded source checksum and route
inventory. Presentation components and `app/globals.css` are not removed as part
of backend migration.
