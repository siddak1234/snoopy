# Repository structure (website)

This repository owns the Autom8x website and Nocturne presentation layer. Target
product capabilities live behind `snoopy-backend` APIs.

```text
snoopy/
├── app/                  Next.js routes, pages, server actions
├── components/           Nocturne UI and product presentation
├── hooks/                client hooks
├── lib/                  API/session contracts and transitional server logic
├── prisma/               legacy-cutover schema/migrations; not the new owner
├── public/               static assets
├── scripts/              architecture/boundary audits
├── docs/                 website design and migration evidence
├── proxy.ts              backend-session route protection
├── instrumentation.ts    production backend-origin validation
└── next.config.ts        redirects and same-origin backend rewrite
```

## Placement rules

| Change | Location / rule |
| --- | --- |
| UI or marketing screen | `app/` plus reusable components in `components/`; preserve Nocturne tokens in `app/globals.css` |
| Browser API call | Use `lib/platform-api.ts`; call a versioned `/v1/*` path through `/api/platform` |
| Session UI | Use `hooks/use-app-session.ts` or server-only `lib/app-session.ts`; both validate `lib/session-contract.ts` |
| Backend origin | `lib/backend-origin.ts`; do not duplicate parsing or expose it as `NEXT_PUBLIC_*` |
| Product logic/persistence | Add to its owning `snoopy-backend` service, not a new website database route |
| OAuth login | Backend identity contract only; no Supabase SDK or manual-password route here |
| Artifact upload/file | Project-scoped backend route; no object-store SDK or credential here |
| New database access | Prohibited. Existing callers are frozen by `scripts/audit-boundaries.mjs` until migrated |
| Readiness | `app/api/ready/route.ts` reflects backend readiness |

## Required checks

```bash
npm run audit:boundaries
npm run typecheck
npm run lint
npm run build
```

The exact transition state is documented in
[`audits/2026-08-06-backend-boundary-cutover.md`](audits/2026-08-06-backend-boundary-cutover.md).
