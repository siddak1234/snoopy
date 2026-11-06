# Snoopy — Autom8x website

This repository owns the Autom8x website: public marketing, the authenticated
web app, and its same-origin gateway to the platform. It is not a database,
identity-provider, object-store, or connector-secret owner.

## Architecture boundary

- Next.js 16, React 19, TypeScript, Tailwind 4, and the Nocturne design system.
- The website consumes only published Edge API contracts generated from public
  OpenAPI documents. It does not author backend contracts.
- OAuth login is backend-mediated. The browser holds no provider token,
  Supabase key, database URL, or service credential.
- `BACKEND_API_ORIGIN` is the only website runtime/build configuration value.

See [Architecture](docs/ARCHITECTURE.md) and
[Repository structure](docs/REPO-STRUCTURE.md) for the current ownership model.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `BACKEND_API_ORIGIN` to a non-production Edge origin when exercising
authenticated features. Do not add cloud, OAuth, database, or provider secrets
to this repository or to `.env.local`.

## Verification

```bash
npm run verify
```

One command, the whole offline gate, in this order: `format:check`,
`check:docs` (each changed area's doc changed with it, each fact in its one
place, and every file a changed doc names exists: `docs/docs-map.json`),
`map -- --check` (`docs/MAP.md` is what `npm run map` builds from the tree),
`lint`, `typecheck`, `audit:boundaries`, `test:contracts`, `verify:platform-contracts`
(the generated contract types and the platform's block fixtures match the
backend's), `build:no-backend` (the site with no backend, as a Vercel preview
builds it), `probe:no-backend` (that build served as a preview serves it: the
public pages load, the account area sends a visitor to sign in, and readiness
says "not configured"), `build` with `BACKEND_API_ORIGIN=https://backend.invalid` plus the
`/api/platform` rewrite assertion CI makes, `test:browser`, and
`test:browser:fixtures`. Locally, the browser suites run in Chromium and
Firefox. WebKit runs in GitHub CI on Linux, where it passes. CI runs all three
engines (NFR-36), and all-green needs every one. On the owner's Mac,
Playwright's WebKit fails dozens of the fixture suite's tests that pass in CI,
even on unchanged `main`, so it was left to CI (the owner's decision of
2026-10-14, register F104). Every local browser run says so as it starts.
`AUTOM8X_WEBKIT=1` runs WebKit locally on purpose. The marketing screenshots
are Chromium's baselines alone. A run in
which every gate ran green ends by emitting
this repository's facts file to `.autom8x/repo-facts/snoopy.json` (gitignored;
`snoopy-backend` commits it as `snoopy-backend/docs/repo-facts/snoopy.json`). Run it on the
exact Node version `.nvmrc` names: every CI job reads that file, and the container's
`node:22-alpine` is the same major. Vercel builds and serves production on its
own latest 22.x (`engines` `22.x`; it offers majors only), so the Node CI tests
and the Node production runs can differ within 22.x (a minor or a patch). Running it while `/audit-change` runs, or the reverse,
is refused — both build into `.next` and serve on ports 3001 and 3443, so they
share one lock, and a port anything already listens on is refused before either
starts (the preflight binds each one; `lsof` cannot see a renamed `next-server`).

**The backend's contract, copied.** The generator, its check and the
contract tests read six backend paths — `snoopy-backend/docs/openapi.yaml`,
`snoopy-backend/docs/openapi/automations.yaml`,
`snoopy-backend/docs/openapi/connections.yaml`,
`snoopy-backend/docs/repo-facts.schema.json` and the
`packages/contracts/fixtures/blocks/` and `block-rules/` folders — from a
byte-for-byte copy committed at
`lib/generated/snoopy-backend/<the same paths>`, with `SHA256SUMS` beside it
(`scripts/backend-contract.mjs`). `npm run generate:platform-contracts` writes
the copy whenever it runs from a backend checkout (`SNOOPY_BACKEND_ROOT`, else
`../snoopy-backend`), and copies nothing when it runs from the copy itself.
`npm run verify:platform-contracts` reads `SNOOPY_BACKEND_ROOT`, else the
sibling, else the copy, so it runs everywhere: the copy against `SHA256SUMS`,
each generated header against the copy's bytes, then a regeneration compared
with what is committed — a stale file or copy is reported and left as found.
The YAMLs stay tied to production by the Deployed contract job.

**No silent skips.** CI's gates job runs `verify:platform-contracts`, and the
contract tests fail when any test is skipped or left todo (TAP's `# skipped`
and `# todo`, read with `set -o pipefail`; `test:contracts` asks for TAP by
name, so a Node whose default reporter changes keeps it), there, in main's
smoke, and locally in `npm run verify`, the pre-push hook and the change audit
(`scripts/audit/preflight.mjs`, `scripts/githooks/pre-push`). The
browser suites collect only what they run (`playwright.config.ts`): the
fixture specs only with the fixture Edge, the keyboard journey only with
`KEYBOARD_JOURNEY=1`, the two touch-camera tests in Chromium alone by their
`@chromium-only` tag. Under CI a committed `test.only` fails (`forbidOnly`),
and `scripts/no-skipped-browser-tests.mjs` fails the browser job, each
fixture leg, and verify's and the change audit's `test:browser`, when
Playwright's JSON report (`test-results/`, emptied by each run) counts a skip. The scan job's
dev-dependency audit and its report of vulnerabilities with no fix stay
report-only by design; the runtime audit and the fixable CRITICAL/HIGH scan block.

**Pinned, and kept current.** Every action in the workflows is pinned by commit
with its `# vX.Y.Z`, the Dockerfile's `node:22-alpine` by index digest with its
tag, the Playwright image the browser jobs run in by its tag and digest, and
Node by `.nvmrc`. `.github/dependabot.yml` moves two of them weekly: one pull
request for the actions, one for the Dockerfile's image (a new Node major is
ignored); the docs check lets a Dependabot commit that touches only bump files
through (`scripts/kit/check-docs.mjs`). The rest move by hand, in the round's
deliberate dependency step (backend §12.1 #278), which also carries the npm
bumps Dependabot does not make (its security updates stay on): `.nvmrc`, with
each Node 22 security release, and the Playwright image, whose tag must be
`package-lock.json`'s `@playwright/test` (`test/structure-contract.test.mjs`),
so the two move in one commit.

**Nightly.** `.github/workflows/nightly.yml` runs every job of `ci.yml` at
09:27 UTC on `main`'s tip, calling it as main.yml's `full` does. When that
run is not green, its own `Nightly red` job opens one "Nightly red" issue, or
comments the run on the open one; that job alone may write issues.
`ci.yml` grants `contents: read`; `main.yml` writes nothing: its `full` job is
`contents: read`, and its other jobs use the repository's read-only default
token. GitHub's limits
stand: a night can start late, or be dropped at high load. In a public
repository a scheduled workflow is switched off after 60 days with no
activity; then no night runs and no issue opens until
`gh workflow enable nightly.yml`. The schedule has its own file so that this
never switches off `ci.yml`, the merge gate. And GitHub emails a scheduled
run's failure only to whoever last changed its cron line, as their Settings →
Notifications → Actions allow: whether a red night reaches the owner by email
is that setting's.

`npm run test:browser:fixtures` starts a loopback-only HTTPS Edge fixture with
a temporary certificate and scans every authenticated page with axe. Here it
runs in Chromium and Firefox; CI runs it once per engine, WebKit's leg
included (register F104). Its tests drive the published operations the website calls — flows and runs, archiving
a flow and the archived ones, adding a flow (it goes to the department of its
category, which the platform makes when there is none, and its Set up opens;
a catalog with nothing to add; the one flow card, its icon and
description, on the Flows cards and the archived rows, with no department
line), the dashboard (Today's three tiles, counted
from the browser's midnight and each opening Activity from it; the approvals
banner while something waits; Add a flow and Flows; YOUR FLOWS, its
department drop-down and Search flows over a card per flow, always open —
the one flow card, its run's fields and Start run inside it, its run opening
from the flow; a flow with items read as Home opens, on its newest ready
item, its run opening from that item, back to it and then its flow; a
member's Open — and a workspace with no flow yet), a flow's page (its live Dashboard, its five
Steps — titles only, Step 1 holding the run's fields and Start run, step 2 its
integration, step 4 titled by the flow's choice, step 5 who gets the email —
and Edit setup; no Connections and no move to another version), its Set up
(Turn on, or Save; a member sees it read-only under "Only an owner or admin
can change this flow.", as Add, Pause and Archive flow are, and a save refused
as a member's says it), its
Connect integration page (a tap saves and goes back; a vendor connected from
it comes back chosen, one connected meanwhile is reused, and a refused
connect is said under its row; a member sees the integration and no row is a
choice; a flow still on an older version
with no vendor to choose is sent to Connections instead), who gets its email
(an owner or admin adds and removes addresses, each saved at once, at most
ten; a member reads them), a run's steps face while it goes on, waits,
failed or was cancelled (every step from the start — its integration and its
email among them, the running one spinning — read again while it goes on,
turning to its result in place when it succeeds, a held job's step 4 its
state alone, Cancel run, then the Run details row last), its details page
(its metadata alone: Duration, Steps done, Started, Ended, Trigger, Run ID),
a run's page (a held
job's Approve and Deny under its result line, or a review's Accept and
Deny for each change then Save review, appearing with no reload when
the job reaches it while its page is open, as docs/ARCHITECTURE.md's "Screen
standards" says; its body the platform's blocks
(`shape=blocks`, backend ADR-0048), which the fixture builds by the
platform's rules (`e2e/fixtures/page-bodies.ts`, held to the platform's
bodies by `test/fixture-page-bodies.test.mjs`; an item's runs searchable,
each toned by its verdict, since block set 2) and, for `blocks-{name}` runs,
serves as the platform's
block fixtures hold them; each document it read a closed section of its own
that opens in place, headed as "Screen standards" says; the
package's buttons when the platform offers the package, then View flow,
then Run details last — and View package, Download PDF and Download Excel, each
download to the platform's signed link, an https one only), the run
package's page (the PDF itself, read once from the site's inline route that
answers it `application/pdf` inline and shown in a frame, Share handing on
those bytes, a busy platform asked once more; Share reading nothing until it
is pressed, there, on the run page and in Settings; its
downloads, an https link only; a job with no package yet), Approvals (each
row its flow and step, fewer words when those cannot be read; a decided row
leaves, and the last one goes to Activity; a run page that keeps itself
through refused re-reads, and tells a member watching a job turn held who can
decide), a document headed in its flow's word or else "Document", the A8X
mark's near-black #212121 on the light ground of the site, the account, Sign
in and Set up your organization, every run by its
full id, a run's file (PUT straight to the fixture's object store, across
origins), a webhook flow's address, connections (one row each — mark, name, the account's email or its
state, one button — each disconnect confirmed first; every row pinned in both palettes, read as data:
its mark, words, colours and height, the app's row snapshot's half), departments (a
department is a project in the platform's contract: its members, asking to
join and the answers), setting up an organization
(a refused domain claim retried on the organization made), the organization's
join link,
unlinking a sign-in account (each refusal, and a platform with no unlink yet),
billing (Free, Plus and Pro — the platform's, or the one the website draws
while the platform lists none — and a second plan refused), the quick and the
complete export (its link followed only when https), account deletion, and the platform's refusals —
without real accounts or credentials, and each test starts from the fixture's
first state. Nine specs: `e2e/accessibility.spec.ts`,
`e2e/accessibility-authenticated.spec.ts` (every page behind sign-in,
scanned with axe), `e2e/keyboard-journey.spec.ts` (below),
`e2e/public-edge-fixture.spec.ts`, `e2e/account-surfaces.spec.ts` (every
surface a change audit probed and no test asserted — Round 21 v2's among them:
the image block, a group of drop-downs, a long list's and table's search, sort
and pages, Activity's search, sort and pages as the platform is asked for
them, and Share refused; Round 21's review of each change and Approvals'
"Review {n} changes"; Stage 2's outside sign-in screen, drawn by the
account area's error screen from one read naming the workspace, and an
Approve a disconnect expired, said in its row; Set up's drop-down of several, and build 34's
sheet for a select whose choices carry groups (Category, Search all, a
group's own Search, "No matches.", Back, one choice or several, each a chip,
the label said and the value saved) and several files in one upload (all into one run, one file a list of one; exactly
`maxFiles` taken, past it refused, a photo past it keeping the files held; a
full queue said; a photo added), a public app connected with no
Connect step and, as a step's choice, Connected and chosen in place, a batch run's page, and a flow
whose list row carries no settings still drawn and saved from its one-flow read (backend §12.1 #319), a flow id that is not a UUID, one the platform does not know and a flow it answers archived each "not found", its integration's save refused once it is archived, and a run's details page still drawn when its flow is archived or cannot be read, in `e2e/public-edge-fixture.spec.ts`), `e2e/dialogs.spec.ts`
(every dialog's Escape, click outside, focus return and hold, one row each),
`e2e/health-data.spec.ts` (Round 21, Stage 2: the health data agreement on
Add, on Start run and on an item's upload — the owner's dialog, anyone
else's one line, nothing published yet, the add, run or item sent again
under the refused one's key, signed once when that repeat is refused — the
organization's Documents and a signed copy, one whose id is not one not
found), `e2e/ehr-connect.spec.ts` (Connect your EHR: the FHIR address, a vendor
picker only for two or more vendors, each refusal in words, the row named
by the clinic's host)
and `e2e/flow-items.spec.ts` (a made-up flow with items, Round 19: the Flows
list by department A–Z; its items grouped A–Z under its group filter, the
website's drop-down, on its page with no Dashboard, no Steps and no run start
form, searched, and past 25 sorted and paged; the upload card's drop-down, "Other" and the values typed before; an
item's runs ranked in one card of divided rows, each as tall as a closed section's bar, each score in
its verdict's colour with its word as a chip, searched, its tiles and
its file page — the file in place, its route for this site's pages alone,
Download to its signed link, Share, then its reading's sections, and a
reading's table sent without its rows drawn as the fallback with the
sections after it, never the error page (Round 21, D2.6); a run
headed by its title and its score in its verdict's colour with View {file}
and its file page (a file no longer linked framed by this site's route), its
sections under "{Run word} details" and its Run details page, the metadata
alone — every body the platform's blocks; a run opened from its job going
back to it (G1), and Start on a job opening the new run's page from it (G4);
Archive, an owner's buttons a member
does not see and a member's presses refused in words, an unanswered list
said "Unavailable", and an upload refused with the queue full said in the
owner's words, its file kept), sharing `e2e/helpers.ts`. The spacing table
(`lib/spacing.ts`) is measured as drawn, from each box's edges: an item's
titles and Settings' groups, and the page's edge at 390 and 900 px wide. The playbook's human keyboard
traversal (NFR-35) has a hand-over test in the same suite:
`KEYBOARD_JOURNEY=1 node scripts/run-browser-fixtures.mjs --headed --grep "keyboard journey"`
opens the built site against the fixture, signed in, and pauses for the person
at the keyboard; no other run collects it.

## Container

The website image is standalone and runs as the non-root `nextjs` user. Start
the platform stack first from `../snoopy-backend`, then run:

```bash
docker compose up -d --build web
```

`compose.yml` joins the platform's external `autom8x_default` network and
passes `http://api:8080` as the internal Edge origin. Production resource and
secret provisioning belongs to the deployment configuration round, not here.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run verify` | The whole offline gate in one command; emits the facts file |
| `npm run build` | Production build |
| `npm run build:no-backend` | The build a Vercel preview makes: no `BACKEND_API_ORIGIN` |
| `npm run probe:no-backend` | Serve that build as a preview does, and check what a visitor gets |
| `npm run test:contracts` | Public-contract and boundary behavior tests, and the common kit's own (`scripts/kit/kit.test.mjs`, its scratch repositories kept off an inherited `GIT_DIR`: snoopy-backend §12.1 #342) |
| `npm run check:docs` | Each changed area's doc changed with it, and each fact in one place (`docs/docs-map.json`) |
| `npm run map` | Rebuild `docs/MAP.md` from the tree; `-- --check` fails when it is stale |
| `npm run generate:platform-contracts` | Regenerate the typed client from `../snoopy-backend`'s published contracts, its block fixtures, its block rules (`block-rules.ts`: the words, the spacing table and the search and sort cases) and each block type's required fields (`block-required.ts`) |
| `npm run verify:platform-contracts` | Report a generated type that differs from its contract; changes nothing |
| `npm run audit:boundaries` | Reject browser secrets, direct DB access, manual fetches, and raw hex colours |
| `npm run test:browser` | Public accessibility in Chromium and Firefox (and WebKit in CI), and Chromium's visual baselines |
| `npm run test:browser:fixtures` | Credential-free authenticated suite, in Chromium and Firefox (and WebKit in CI) |

CI (`.github/workflows/ci.yml`) runs these gates as jobs on every pull request,
plus what `npm run verify` cannot run offline: the dependency audit, a scan of
the built image, and its SBOM. On `main`, `.github/workflows/main.yml` runs a
smoke (lint, format, typecheck, the contract tests) when the merged commit's
tree is the one its pull request's all-green passed, and the whole suite
otherwise. `npm run hooks:install` arms the pre-push hook
(`scripts/githooks/pre-push`), which requires the change-audit marker and runs
the seven fast gates `npm run verify` begins with (see "Verification"; ~30 s):
every gate before its builds but the map's check, which `test:contracts` makes
too (`test/kit-repo.test.mjs`). CI is the authority for the rest; its
Architecture gates job runs `check:docs` and the map's check on the pull
request's commits.
