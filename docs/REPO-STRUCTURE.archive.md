# REPO-STRUCTURE.md's tree before the engineering standard (archive)

Archive: closed and dated history, append-only, grep-only. On 2026-10-18
[REPO-STRUCTURE.md](REPO-STRUCTURE.md) replaced its heading and tree, below,
with a link to the generated [MAP.md](MAP.md); its change table and closing
paragraph stayed. Verbatim:

````text
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
````
