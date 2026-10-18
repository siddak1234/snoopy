# New page checklist

Copy into the pull request body and tick each line with its evidence.

## Parts and data

- [ ] `app/<route>/page.tsx` is built from `components/ui` and
      `components/dashboard` parts; no new component copies one (AGENTS.md rule 2).
- [ ] Data comes through `lib/platform-server.ts` (server) or
      `lib/platform-api.ts` (browser), typed from `lib/generated/platform-contracts/`;
      no `fetch` of its own (rule 4).
- [ ] No hex colour outside `app/globals.css` (rule 3; `npm run audit:boundaries`).
- [ ] With no workspace, and with nothing to list, the page shows one `EmptyRow`.
- [ ] Linked from the side menu? Its link and its small-screen title are both in
      `components/dashboard/DashboardNav.tsx` (register F56).

## Plain words ([app/CLAUDE.md](../../../../app/CLAUDE.md))

- [ ] The fewest questions; nothing asked that a connected app already knows.
- [ ] Few visible steps, numbered where a person follows them.
- [ ] No jargon and no explanations on the page; team and flow, never project or
      automation.

## Parity with the app

- [ ] The mobile app has the same screen, or the gap is recorded as a finding
      for the round (app/CLAUDE.md "Parity with the app").

## Tests

- [ ] `test/<slug>.test.mjs` passes, and fails when the line it guards is broken.
- [ ] `e2e/<slug>.spec.ts` runs in the fixture suite (in the list in
      `scripts/run-browser-fixtures.mjs` and its copy in
      `test/verify-gate.test.mjs`) and its axe scan passes; the fixture Edge
      (`e2e/fixtures/public-edge.ts`) serves the operation the page reads.

## Docs and gates

- [ ] README's spec count and its fixture-suite paragraph name the new spec;
      `docs/ARCHITECTURE.md` or `README.md` describes the page (docs-map rule `app`).
- [ ] `npm run map` run and `docs/MAP.md` committed.
- [ ] `npm run verify` green on the committed tree, then `/audit-change`.
