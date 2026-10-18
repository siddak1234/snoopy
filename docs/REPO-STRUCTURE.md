# Repository structure

The folders, routes, scripts, specs and records are listed in the generated
[MAP.md](MAP.md) (`npm run map`). This page keeps why each part is where it is.
The tree it held before: [REPO-STRUCTURE.archive.md](REPO-STRUCTURE.archive.md).

| Part | Why it is here |
| --- | --- |
| `app/`, `components/` | Routes, pages and server actions; Nocturne UI (`ui/`) and dashboard presentation ([app/CLAUDE.md](../app/CLAUDE.md)) |
| `hooks/`, `lib/` | The browser's session read; platform façades, generated contracts, session mapping |
| `e2e/`, `test/` | Browser, accessibility and local Edge fixture tests ([e2e/CLAUDE.md](../e2e/CLAUDE.md)); contract and structure tests (`npm run test:contracts`) |
| `scripts/` | `npm run verify` and its gates; `audit/` is the change audit's runner, marker writer and shared preflight; `githooks/` and `hooks/` enforce its marker on push; `kit/` is the common kit's docs check and map |
| `.claude/` | The agents, skills and hooks (AGENTS.md "Where to look") |
| `proxy.ts`, `instrumentation.ts`, `next.config.ts` | Backend-session route protection; the start-up check (production refuses a missing or bad origin); backend-origin validation and the same-origin rewrite |
| `Dockerfile`, `compose.yml` | The standalone non-root image; the web service on the platform's external network |

| Change | Location / rule |
| --- | --- |
| UI or marketing screen | `app/` and reusable `components/`; preserve Nocturne tokens |
| Browser API call | `lib/platform-api.ts` through `/api/platform/v1/*` |
| Server API call | `lib/platform-server.ts` with typed public response aliases |
| Session UI | `hooks/use-app-session.ts` or server-only `lib/app-session.ts` |
| Backend origin | `lib/backend-origin.ts`; never expose it as `NEXT_PUBLIC_*` |
| Generated API types | `lib/generated/platform-contracts/`; regenerate, never hand-edit |
| Product persistence or provider secret | Owning `snoopy-backend` service; prohibited here |
| OAuth login | Published backend provider policy only; no Supabase SDK or password route |
| Browser regression | `e2e/`; fixture-only tests must stay disabled outside their local runner |

The gate is `npm run verify` (README). Findings about this repository and their
dispositions are the register in
[the audit record](audits/2026-08-11-round-5-phase-1-status.md).
