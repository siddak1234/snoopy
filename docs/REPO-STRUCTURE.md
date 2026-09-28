# Repository structure

```text
snoopy/
├── app/                  Next.js routes, pages, server actions
├── components/           Nocturne UI (`ui/`) and dashboard presentation
├── hooks/                Client hooks (the browser's session read)
├── lib/                  Platform façades, generated contracts, session mapping
├── e2e/                  Browser, accessibility, and local Edge fixture tests
├── test/                 Contract and structure tests (`npm run test:contracts`)
├── scripts/              `npm run verify`, contract generation, boundary audit,
│                         the documents' file references, repository facts;
│                         `audit/` is the change audit's gate
│                         runner, marker writer and their shared preflight;
│                         `githooks/` and `hooks/` enforce its marker on push
├── docs/                 Website architecture and the audit register
├── .claude/              The change-auditor agent, `/audit-change`, its hook
├── .github/              CI and the pull-request template
├── Dockerfile            Standalone non-root website image
├── compose.yml           Web service on the external platform network
├── proxy.ts              Backend-session route protection
├── instrumentation.ts    Start-up check: production refuses a missing or bad origin
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

The gate is `npm run verify` (README). Findings about this repository and their
dispositions are the register in
[the audit record](audits/2026-08-11-round-5-phase-1-status.md).
