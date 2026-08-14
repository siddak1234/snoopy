# Repository structure

```text
snoopy/
├── app/                  Next.js routes, pages, server actions
├── components/           Nocturne UI and dashboard presentation
├── e2e/                  Browser, accessibility, and local Edge fixture tests
├── lib/                  Platform façades, generated contracts, session mapping
├── scripts/              Contract generation and boundary audits
├── docs/                 Website architecture and audit evidence
├── Dockerfile            Standalone non-root website image
├── compose.yml           Web service on the external platform network
├── proxy.ts              Backend-session route protection
└── next.config.ts        Backend-origin validation and same-origin rewrite
```

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

Required checks are listed in the README. The Round 5 completion evidence is
recorded in [the audit record](audits/2026-08-11-round-5-phase-1-status.md).
