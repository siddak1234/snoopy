---
name: new-page
description: Add a signed-in page to the website: the page from the dashboard's parts, its contract test, and its fixture e2e spec with an axe scan, from the templates here. Use when a new route under app/ is asked for.
---

Adds one signed-in page that lists what the platform returns. The templates in
`templates/` are modeled on `app/account/connections/page.tsx`, a contract test
such as `test/build22-screens.test.mjs`, and `e2e/account-surfaces.spec.ts`.

## Inputs

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `__route__` | the URL path | `/account/vendors` |
| `__slug__` | the test and spec file name | `vendors-page` |
| `__Name__` | the PascalCase name | `Vendors` |
| `__Title__` | the page title, plain words | `Vendors` |
| `__purpose__` | one sentence: what a person does here | `The vendors a flow can use.` |
| `__contract__` | the generated contract: `platform`, `automations` or `connections` | `connections` |
| `__operationId__` | the operation the page reads | `listConnections` |
| `__apiPath__` | its path after the workspace's | `/connections` |
| `__listKey__` | the response's list field | `connections` |
| `__itemLabel__` | the field each row shows | `providerId` |
| `__emptyText__` | the one line when the list is empty | `Nothing here yet.` |

## Steps

1. Read [app/CLAUDE.md](../../../app/CLAUDE.md) and [e2e/CLAUDE.md](../../../e2e/CLAUDE.md).
   Find the operation in `lib/generated/platform-contracts/` (never hand-edit
   those files; a missing operation is a finding for `snoopy-backend`).
2. Fill the templates (set each variable first; `ROUTE` starts with `/`):

   ```bash
   T=.claude/skills/new-page/templates
   fill() { sed -e "s|__route__|$ROUTE|g" -e "s|__slug__|$SLUG|g" -e "s|__Name__|$NAME|g" \
     -e "s|__Title__|$TITLE|g" -e "s|__purpose__|$PURPOSE|g" -e "s|__contract__|$CONTRACT|g" \
     -e "s|__operationId__|$OP|g" -e "s|__apiPath__|$API|g" -e "s|__listKey__|$LIST|g" \
     -e "s|__itemLabel__|$LABEL|g" -e "s|__emptyText__|$EMPTY|g" "$1"; }
   mkdir -p "app$ROUTE"
   fill $T/page.tsx.tmpl > "app$ROUTE/page.tsx"
   fill $T/page.test.mjs.tmpl > "test/$SLUG.test.mjs"
   fill $T/page.spec.ts.tmpl > "e2e/$SLUG.spec.ts"
   ```

3. Shape the page with existing `components/ui` and `components/dashboard`
   parts. Data stays on `lib/platform-server.ts` (server) or
   `lib/platform-api.ts` (browser); no hex outside `app/globals.css`.
4. Linked from the side menu: add its link and its small-screen title to
   `components/dashboard/DashboardNav.tsx` (register F56).
5. The spec: add `e2e/$SLUG.spec.ts` to the fixture list in
   `scripts/run-browser-fixtures.mjs` and to that list's copy in
   `test/verify-gate.test.mjs`, which fails until both agree; if the fixture
   Edge (`e2e/fixtures/public-edge.ts`) does not serve the operation yet, add
   it there.
6. Check the plain-words rule and mobile parity with `templates/checklist.md`.
7. Docs, in the same commit: README's spec count and fixture paragraph, and
   `docs/ARCHITECTURE.md` or `README.md` for the page (docs-map rule `app`).
8. Run, in order:

   ```bash
   npm run map
   npm run format
   git status --short        # stage only this page's files, by name
   # ALSO: each of these that steps 4, 5 and 7 changed, space-separated:
   # components/dashboard/DashboardNav.tsx e2e/fixtures/public-edge.ts docs/ARCHITECTURE.md
   git add "app$ROUTE/page.tsx" "test/$SLUG.test.mjs" "e2e/$SLUG.spec.ts" \
     scripts/run-browser-fixtures.mjs test/verify-gate.test.mjs docs/MAP.md \
     README.md $ALSO && git commit
   git status --short        # nothing of this page's left behind
   npm run verify
   ```

   then `/audit-change` ([skill](../audit-change/SKILL.md)).

## Stop when

- The operation is not in the generated contracts: stop and record a finding.
- The page needs a secret, a database or a second fetch path: stop (AGENTS.md
  rules 4 and 5).
- `npm run verify` is red: fix it before `/audit-change`, never push around it.

## Output

`app/<route>/page.tsx`, `test/<slug>.test.mjs`, `e2e/<slug>.spec.ts`, the
fixture list and its copy, `docs/MAP.md`, and the checklist ticked in the pull
request body.
Each test is shown to fail when the line it guards is broken.

## The docs-map rule

`app/**` and `components/**` need `docs/ARCHITECTURE.md` or `README.md`;
`e2e/**` and `scripts/**` need `README.md` or `CONTRIBUTING.md`
(`docs/docs-map.json`; `npm run check:docs` checks).
