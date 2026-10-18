# e2e/: the browser, accessibility and fixture suites

Loaded when you work here. The router is [AGENTS.md](../AGENTS.md); what each
suite covers is README "Verification" ([README.md](../README.md)).

## Ports

- 3001 (the site) and 3443 (the fixture Edge) are exclusive. `npm run verify`
  and `/audit-change` refuse a port anything holds (`scripts/audit/preflight.mjs`
  binds each one; `lsof` misses a renamed `next-server`). A suite run on its own
  does not check, so a stale server there is tested instead of your build.
- Never leave a `next dev` or `next start` running. Stop every server you start
  before the next gate, and before you return.

## Engines

- Locally: Chromium and Firefox. WebKit runs only in GitHub CI, on Linux, where
  it passes and `all-green` needs it. `AUTOM8X_WEBKIT=1` opts in locally.
- Why: the header of `playwright.config.ts` (the owner's decision of 2026-10-14,
  register F104).

## Commands

- `npm run test:browser`: the public pages, their accessibility and the
  marketing baselines, against the build `npm run build` made.
- `npm run test:browser:fixtures` (`scripts/run-browser-fixtures.mjs`): builds
  against the loopback HTTPS fixture Edge (`e2e/fixtures/public-edge.ts`), signs
  in with a cookie-only session and scans every signed-in page with axe.
- A new fixture spec joins the runner's list in `scripts/run-browser-fixtures.mjs`
  and README's spec count; `test/verify-gate.test.mjs` checks the list.

## Writing a fixture spec

- Start as `e2e/account-surfaces.spec.ts` does: `test.use({ storageState })`
  from `PLAYWRIGHT_AUTH_STORAGE_STATE`, skip unless `E2E_PUBLIC_EDGE_FIXTURE=1`,
  and `fixtureControl("reset")` before each test.
- Share `e2e/helpers.ts`: `expectNoAxeViolations`, `fixtureControl`,
  `fixtureRead`, `settledPage`. Each test starts from the fixture's first state.

## Visual snapshots

- `e2e/marketing.visual.spec.ts`, Chromium only: `<page>-darwin.png` is the
  Mac's baseline and `<page>-linux.png` is CI's. Marketing pages stay
  byte-identical, so re-record only for a design change the owner approved.
- First show the old baseline fails. Then, after `npm run build`:
  `npx playwright test e2e/marketing.visual.spec.ts --project=chromium --update-snapshots`
  on the Mac for darwin, and the same command in CI's pinned Playwright image
  (`.github/workflows/ci.yml`, job `browser`, Node 22) for linux. Commit both.
