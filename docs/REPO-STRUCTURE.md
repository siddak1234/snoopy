# Repository structure (website)

This repo contains **only the marketing/website application**. n8n and the database server live in separate repos or infrastructure.

## Top-level layout

```
snoopy/
├── app/              # Next.js App Router — routes, pages, API
├── components/       # React UI components (no route logic)
├── hooks/            # Shared React hooks
├── lib/              # Shared runtime logic (DB, config, utils)
├── prisma/           # Database schema and migrations (website’s DB access)
├── supabase/         # Reference SQL (deploy never runs these)
├── prompts/          # n8n LLM-prompt source copies (not imported by the app)
├── running-total/    # n8n Code-node source copies (not imported by the app)
├── public/           # Static assets (images, favicon, etc.)
├── docs/             # Architecture and runbooks (this folder)
├── proxy.ts          # Route protection (Next proxy convention)
├── instrumentation.ts # Env validation at server startup
├── .env.example            # Required env vars for deployment (copy to .env.local; never commit real secrets)
├── next.config.ts
├── prisma.config.ts
├── package.json
└── README.md
```

## Where to put what

| Add this | Put it here | Notes |
|----------|-------------|--------|
| New marketing page | `app/(marketing)/<path>/page.tsx` | Route groups: `(marketing)` = Nocturne nav/footer shell; `(auth)` = centered auth shell; `app/account/` = dashboard shell (protected, incl. the builder canvas at `/account/builder`). Groups do not affect URLs. |
| New API endpoint | `app/api/<name>/route.ts` | Export `GET`, `POST`, etc. |
| Shared UI primitives | `components/ui/` | `Button`, `Card`, `Kicker`, `Section`/`Container`, `NumberedStep`, `ImagePlaceholder`, `FormInput`, `Modal` — named exports; reuse before re-implementing. |
| Marketing-specific components | `components/marketing/` | Nav, footer, pipeline art, marquee, scroll story, typing headline, contact form. |
| Design tokens / theme | `app/globals.css` | The Nocturne token sheet (dark default + `html[data-theme="light"]`). Never hard-code hex/px/fonts in TSX — lint enforces it. |
| Nav data | `lib/nav.ts` | Single source for marketing nav + footer columns. Dashboard nav: `components/dashboard/DashboardNav.tsx`. |
| Modal / popup dialog (button-triggered) | `components/ui/Modal.tsx` | Use `<Modal onClose={...} ariaLabelledBy="...">` so the card is viewport-anchored and does not shift when the cursor moves. Do not build custom fixed overlays for new dialogs. |
| Icons | `@phosphor-icons/react` | The design system mandates Phosphor; static SVGs in `public/`. |
| Database access | Use `lib/db.ts` | Import `db` from `@/lib/db`; do not create new Prisma client instances. |
| App/site config (name, tagline) | `lib/site.ts` | Constants used across the app. |
| Env validation | `lib/env.ts` | `validateEnv()` — in production runtime, throws if required vars missing. Wired at startup via `instrumentation.ts` (`register()`, nodejs runtime). |
| Auth config | `lib/auth.ts`, `lib/auth-supabase.ts` | `ensureDefaultWorkspaceForUser()` in auth.ts; `getAppSession()`, `provisionUserFromSupabaseAuth()` in auth-supabase.ts. |
| Route protection | `proxy.ts` | Protects `/account` (incl. `/account/builder`) and `/onboarding` (redirects to `/login` if unauthenticated). |
| Liveness | `app/api/health/route.ts` | `GET /api/health` — 200 always; no DB (build-safe). |
| Readiness | `app/api/ready/route.ts` | `GET /api/ready` — 200 with DB check when env set, or 503 if DB down. |
| Schema changes | `prisma/schema.prisma` | Then run `npm run db:migrate -- --name <name>`. |
| Docs / architecture | `docs/` | Keep ARCHITECTURE.md and REPO-STRUCTURE.md up to date. |

## Conventions

- **Imports**: Use the `@/` path alias for app code (e.g. `import { db } from "@/lib/db"`).
- **No business logic in `app/`**: Keep route handlers thin; call into `lib/` or services.
- **API routes**: Only under `app/api/`; return JSON and appropriate status codes.
- **Secrets**: Never in code. Use env vars; copy `.env.example` to `.env.local` and fill in locally.

## What this repo is not

- **Not the n8n app**: Workflow/automation logic and n8n config live in a separate n8n repository.
- **Not the database server**: Postgres is external (managed or separate container); this app connects via `POSTGRES_URL` at runtime (with `POSTGRES_PRISMA_URL` as optional direct fallback).
- **Not a monorepo**: One app only. Other services (n8n, future backends) are separate repos or images.
