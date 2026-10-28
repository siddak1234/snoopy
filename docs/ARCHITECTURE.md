# Snoopy website architecture

This describes what the code does. Where the project stands — the round, the
open repository, what is next — is `snoopy-backend`'s MASTER-PLAN §0.1.

Snoopy is the Autom8x web client and same-origin BFF surface. The backend Edge
API owns identity, tenancy, product data, provider credentials, artifacts,
entitlements, execution, and their secrets.

## Request boundary

```text
browser ──same origin──> /api/platform/v1/* ──> Edge API ──> owning services
```

`BACKEND_API_ORIGIN` is the website's only build/runtime setting. Next bakes the
same-origin rewrite into the production build; the origin is never exposed as a
browser configuration value. Server components, actions, and proxy session
lookups forward the request's cookies to Edge as `name=value` pairs and nothing
else (register F51); the Edge's host-only session cookies are the only cookies
this origin holds.

## Rules enforced in this repository

- Browser calls use `lib/platform-api.ts`; server calls use
  `lib/platform-server.ts`; proxy session rotation uses `lib/platform-proxy.ts`.
- Public response types are generated from the three published OpenAPI inputs,
  and the platform's block fixtures beside them
  (`lib/generated/platform-contracts/block-fixtures.ts`, one sha256 over the
  fixtures' bytes in filename order — the rule both clients share), and its
  block rules the same way (`block-rules.ts`: `BLOCK_WORDS`,
  `BLOCK_SPACING` and the search and sort cases, its own sha256 over
  `fixtures/block-rules/`), and each block type's required fields
  (`block-required.ts`: `BLOCK_REQUIRED`, from `automations.yaml`, headed
  by its sha256).
  A web change cannot invent a request, response, cursor interpretation, billing
  flow, invite flow, or OAuth-provider policy. One exception, for one round:
  `lib/pending-contract.ts` holds the narrowest local types of the platform
  round's setup `select` and a held run's review (Round 21, F1 and F2), which
  the backend's contracts add in the same round. It is deleted when
  `npm run generate:platform-contracts` reads the backend's merged head, and
  its importers then read the generated names.
- No Prisma, direct database, Supabase SDK, object-store SDK, browser secret,
  manual password login, or provider credential belongs here.
- Tenancy state comes from typed Edge responses. Mutations have unique
  idempotency keys, while a user retry reuses its one explicit intent key.

## Screen standards

Build 28's (Round 19, plan §3), the same on the app
(`snoopy-mobile/DESIGN-CONTRACT.md`); each is drawn by one part, which a new
page reuses:

- **Flows by department**: the Flows list groups its cards under their
  department, the departments A–Z (`app/account/flows/departments.ts`).
- **A choice is a drop-down**: a flow's `select` field, a setup `select`
  (`app/account/flows/SelectField.tsx`) and a list's filter are the website's
  drop-down (`components/ui/Dropdown.tsx`) — a pill for a filter, a field's
  box in a form, its panel glass — never a row of buttons and never the
  browser's own `<select>`. A field that allows several (`multiple`) keeps
  the panel open with a tick on each chosen row, and the closed box says
  "Choose", "{first}, {second}" or "{n} chosen" (`lib/choices.ts`); it is
  sent as the list chosen, and a required one left empty says "Choose at
  least one." under each before anything is sent (`missingChoices`).
- **A row that opens a page** is `PageRow` (`components/dashboard/PageRow.tsx`):
  a closed section's box and height, the arrow at its end — or, `boxed`
  false, a row of one card of divided rows (`LIST_CARD`): a list block's
  rows, a flow's items, Activity's runs and Home's recent runs.
- **The spacing table** (backend `BLOCK_SPACING`, ADR-0048 amendment 1; the
  owner's Q8), the same names on the app: the numbers are the platform's
  (`lib/generated/platform-contracts/block-rules.ts`), and their classes
  here are [`lib/spacing.ts`](../lib/spacing.ts), the one place either is
  written. The parts carry them: the account shell the edge and the bottom
  (`EDGE`), `SectionCard` the card, `Group` a band of it (`GROUP_BAND`) with
  its title (`SectionTitle`) and what that heads, `PageRow`, `Tile` and the
  list card the rows. A title sits `title` above what it heads and `group`
  below what came before it — a form's title ("Add candidate") and a label
  block ("Candidates") alike (F3); a group of related rows is one card with
  dividers; nothing above the first group. `test/spacing.test.mjs` holds it:
  every padding, margin and gap class under components/ and app/account is
  one of the table's, but for older classes counted file by file in
  `test/spacing-baseline.json`, which only goes down and names nothing under
  app/account (the public pages, the plain controls and the chips are left);
  and no screen there types a band or a section title of its own.
- **Search, sort and pages** (ADR-0048 amendment 1, decision 4; the bar is
  `components/blocks/ListTools.tsx`; its words and numbers are the
  platform's, never typed here: `BLOCK_WORDS` and `BLOCK_SEARCH` in
  [`block-rules.ts`](../lib/generated/platform-contracts/block-rules.ts),
  held by `test/block-words.test.mjs`): a search box on every flow list
  whatever its length — a flow's items (`FlowItems`), an item's runs
  (`searchable`) and Activity; past one page of rows (`BLOCK_SEARCH`'s
  page size), the sort, the order sent first, and the pages. A list or
  table in the blocks is wrapped in `Paged` (searching, sorting and paging
  in the browser by `lib/block-sort.ts`'s rules, which pass the platform's
  cases), a flow's items sort by name or newest first, and Activity keeps
  `q`, `sort` and `page` in its address (`ActivityControls`) and sends
  them, with the outcome as `status` and the time as `since`, to the
  platform, which searches and counts (`total`) — plain Activity too, its
  sort and page always sent (`runsQuery`), while Home reads the newest
  100; it never sends `needsReview`. A search that finds nothing says so,
  in `BLOCK_WORDS`' words.
- **Every run's page** ends with the package's buttons when it has them,
  then the Run details row, then Cancel run while it goes on and View flow;
  Duration, Steps done, the steps, Started, Ended, Trigger and the Run ID are
  on its details page, `/account/runs/[runId]/details`. What a run read comes
  first, under "{Run word} details", in its result line's place.
- **A page body is the platform's blocks** (backend ADR-0048): the run, item
  and file pages draw their fixed header and footer, then the blocks the
  one-run and one-item reads send with `shape=blocks` (`BLOCKS_SHAPE`), each
  by one renderer per type (`components/blocks/`, keyed by the generated
  `Block` union, no hooks — but for the two client parts they hand on to, a
  picture's read and a long list's search, sort and pages), as sent and in
  order. A tone is a theme token; a
  link is https only, checked again, its host under its title; a press is a
  typed target this site maps to its route. A type, form or page part this
  build does not know draws `FALLBACK` (`components/blocks/Fallback.tsx`),
  an unknown tone neutral, an unknown step state the "unknown" look, an
  unknown target no press; an answer with no blocks, the fallback alone.
  A known type without a field its schema requires, or of another basic
  type, or of another value where the schema gives a `const` (a group's
  entry not a `section`), is the fallback in that block's place, and the
  next block still draws (Round 21, design D2.6): `BlockList` checks it before drawing
  (`components/blocks/drawable.ts`, reading `BLOCK_REQUIRED` in
  [`block-required.ts`](../lib/generated/platform-contracts/block-required.ts),
  generated from `automations.yaml`'s `Block` union), so a page's first
  draw, on the server where no boundary catches, keeps its page (the file,
  run and item pages; RunLive and ItemLive are first drawn there with
  `initial`); and each block is wrapped in `BlockBoundary`, which catches a
  renderer that throws in a redraw in the browser, and draws a re-read's
  other block in a caught one's place (`contentKey`). Every block fallback
  — those two, an unknown type, an unknown form (`form.kind`), a chart with
  no points, a group entry not a section, an absent body (`unknown`,
  `no blocks`) and a body that is not a list (`unknown`, `not a list`) —
  logs `console.error("block not drawn", { type, error })` (`notDrawn`): the
  block's type (or `unknown`) and the missing field's name or the caught
  error, never a value. A page's first draw, on the server, logs to the
  Vercel project `snoopy`'s runtime logs at each request (the file, run and
  item pages). A boundary's catch, and a redraw in the browser, log only to
  that viewer's console, once for each type and reason until the page is
  loaded again, though the live pages draw again at each poll. The site has
  no other logging.
  Since block set 2, thirteen types: an `image` is one of the run's own
  files drawn in the page (`Picture`, read once from its file page's view
  route through `siteFileBlob`; a JPEG or PNG, at most its frame's height
  (`components/blocks/Picture.tsx`), in its page's link, a PDF in a frame;
  while it opens, a file no longer kept and one that could not open each
  say so, with Try again, in the file page's words in
  [`lib/run-files.ts`](../lib/run-files.ts)); a `chart` a bar or line chart
  in SVG, read aloud as its `alt`, its words text nodes; a `group`
  (`GroupCard`, the owner's F6 and Q6) its title, then one card of its
  sections as drop-downs, divided, the first open and several open at
  once; a list is one card of divided rows, each score in its `valueTone`
  (green or red, the run's verdict) beside its chip. The
  flow page draws its parts in `Subscription.pages.flow` order (`pageParts`),
  else today's. No page reads documents, sections, details or a flow's
  document, verdict or run words (`test/no-flow-code.test.mjs`), and both
  clients draw every block fixture to its words (`test/blocks-parity.test.mjs`).
- **A flow with items** is its items: no Dashboard, no Steps.
- **A file's page** shows the original in place where a browser draws it,
  then Download and Share, then what was read from it (`FileView`).
- **Download, then Share, on every document** (the owner's F4 and Q7):
  `FileActions` (`components/dashboard/FileActions.tsx`) on both file pages,
  a run package's PDF and Excel (Download PDF, Download Excel, then Share,
  the PDF) and Settings › Data's two exports. Share sends the file itself,
  as a `File` — never its signed link — and reads nothing until it is
  pressed, as the app: where the page already holds the bytes (a file
  page's frame and the package page's, each read once by `usePageFile`;
  the workspace summary's JSON) they go to the share sheet at the first
  press; elsewhere (the run page, the complete export, a file not shown in
  place) the first press reads them, Share busy, and the next opens the
  sheet with the file kept (`pressShare`: a browser opens it only in a
  press, never after a wait). It shows only where the browser takes that
  file (`navigator.canShare`). A package's documents and the complete export
  are read through `app/account/share/route.ts` (`?run={id}&format=` or
  `?export={id}`): its ask and its signed link read on the server, the
  bytes an attachment of no type, never cached, `nosniff`, for this site's
  pages alone (`Sec-Fetch-Site`, `lib/file-view.ts`'s `askedHere`); the
  workspace summary shares its own JSON.
- **A run's score** is in its verdict's colour (the owner's F1 and Q5):
  the positive green and the negative red, with the flow's word for it as a
  chip ("Advance", "Decline"; `RunScore`, `lib/run-verdict.ts`, the one
  place that reads the flow's verdict words); with no verdict, plain and
  alone.

## Identity and connections

Login is backend-mediated OAuth. The website renders only the provider policy
published by Edge; OAuth client registration, redirect allowlists, PKCE, token
exchange, refresh, and provider secrets stay backend-managed. Connector OAuth
is distinct from login identity and follows the public connection-provider
contract: Reconnect keeps the connected account, and **Replace account** is a
separate, confirmed owner-or-admin intent that names the exact connection it
replaces (backend ADR-0019 §4, ADR-0026). A grant that already holds what the
provider asks for is reused without consent, and the page says so. Connections
and a flow step's vendor rows start a connect the same way
(`app/account/connections/start-connect.ts`). A member sees a flow's
integration and does not change it, with one exception: on a newly added
flow's Set up, the member makes its first choice, a connected vendor or None
(backend ADR-0043 §2), as the app's Set up allows.

## Runs and approvals

A job is its first run (backend ADR-0044): the platform lists each job once,
by that run's id, and reads any id in a job as the whole job — every step,
the held run's and the ones after its approval, in one timeline. So the run
page draws a held step done once the job went on, and nothing here links one
run of a job to another. The job's newest approval, by when it was asked, is
the one a page says or offers. What a run read is the platform's blocks
("Screen standards"): each document a closed section headed in its flow's
word — "Invoice 1 of 3" for Invoice Processing, else "Document 1 of 3" —
with `{vendor} · {total}` and its chip, that opens on its own; the
platform's composer words it (backend `apps/runs/src/pages`), and no page
holds code for one flow (`test/no-flow-code.test.mjs`).

A run's page and its details page ("Screen standards") are one `RunLive`,
read alike (`app/account/runs/[runId]/run-page-data.ts`). A held job is
decided on its page: under the result line, "Waiting for approval.", the
platform's approval form (`questions{approval}`), drawn as the one Approve
and Deny pair (`app/account/approvals/ApprovalDecision.tsx`, Deny the danger
variant) to a role the form names (`mayDecide`), and says who can otherwise;
step 4 on its details page keeps the step's state alone (build 28's review,
finding 1). A decision draws the page again (the action revalidates it by
the job id the platform answers with). A run can turn held while its page is
open, or the page can read it before its approval is asked. Then the browser
reads the job again through `/api/platform`, every 2 s, one read at a time
and at most ten times, until its form comes or the run leaves held
(`rereadForApprovalForm` in `lib/run-progress.ts`); its details page reads
the job and its approvals together until the approval is listed
(`rereadForApproval`). So Approve and Deny appear with no reload. A read
that fails costs only itself: the page stays as it was, as the app's does. On Approvals each row names its flow and the step it waits at, "{flow} ·
{step title}" (`approvalTitle`), never the step id; when the flows or the
catalog cannot be read, the row loses those words and keeps its buttons. A
decided row fades and folds away, its pill saying the decision, and the last
one leaving goes to Activity; under reduced motion it leaves at once.

A held run that offers changes (its form `questions{review}` with
`decisions`, Round 21's F2) is a review, in the same component: each change
a row, "{label} · {detail}", with Accept and Deny (Deny the danger pill) to
a role the form names; Save review once every row has an answer, "Accept or
deny each change." until then; a member reads the rows and "Only an owner or
admin can review this." Saving sends every answer (`{decisions: [{id,
decision}]}`) and the job always goes on; a refusal says "The review wasn't
saved. Try again." On Approvals such a row says "Review {n} changes",
opening the run, in place of the pair. Once saved, the step that waited
says "{a} accepted · {d} denied" on the run's details page, even while the
job goes on (`reviewTally`, `trackerRows`): a run's page reads the job's
approvals whenever a step reported `held`, not only while it is held
(`readsJobApprovals`). A gap, named: words.md also puts the count in
Approvals, but Approvals lists only what waits and a review is saved on the
run's page, so no Approvals row ever holds a saved review; the default
until the owner says otherwise is the count on the run alone. A held run
without changes is unchanged. The words are ICD-10 Code Check's words.md
section 3, the app's too.

A job that has documents and has ended or is held has a run package (backend
ADR-0045; the platform says so, `RunDetail.packageAvailable`): View package, Download PDF and Download Excel replace Download
JSON. A download asks the platform for the file through `/api/platform` in the
browser's zone and goes to the signed link it answers — an attachment, so the
browser saves it and nothing crosses origins; a platform busy building others
(503) is asked once more after its `retry-after` (`askPackageOnceMore` in
`lib/run-documents.ts`, the package route's ask too). The browser follows a
signed link only when it is https (`lib/signed-link.ts`, the complete
export's Download file too), as the server and the app do. Anything else is
never followed, and the page says "Could not download. Try again." The package page,
`/account/runs/[runId]/package`, shows the PDF itself: the platform's links are
attachments only, so the site's own route (`app/account/runs/[runId]/package/file/route.ts`, server
only) asks for the PDF, reads the signed link on the server
(`platformSignedFile` in `lib/platform-server.ts`) and answers it
`application/pdf` and `inline`, never cached, framed by this site alone, and
nothing over the platform's 25 MiB bound. That route's call to the platform is
a mutation a GET makes, so it refuses a request another site started, or one
that does not say where it came from (`Sec-Fetch-Site`), and names this site's
origin as the page that asked does. Its ask may take 30 s (the platform builds
for at most 20 s), and the route states `maxDuration = 60`.

## A flow's items

A flow may declare items (backend ADR-0046; Round 19): things a person makes
once, from a file, that its runs then belong to. Every word for them is the
platform's — `items.words`, `items.runWords`, each field's `title` and
`options` — and the rules that draw them are pure, in `lib/flow-items.ts`, the
same as the app's. A flow page whose version declares `items` draws them
(`app/account/flows/FlowItems.tsx`) and no run start form, since each run
names an item (`createRun`'s `itemId`); Turn on stays. They are grouped by the flow's `groupField`, the
groups A–Z and the rows A–Z, under its filter — "All {field, many}" first,
then each value the items carry, A–Z — each row "Reading…", "Couldn't read"
or "{n} {runs} · Top {score}", read again every 2 s while one is being read;
a list the platform could not answer is "Unavailable". "Upload {item}", for an owner or admin,
opens the upload card (`UploadItemCard.tsx`): a select of the field's options,
the values typed before (`listItems`' `choices`, each held by its words, so a
re-read while the card is open never changes the pick) and "Other", whose own
box, labelled Other, takes 40 characters; a text box; the file, uploaded
through a run's own upload path; then `createItem` with a key made with the
card ("Nothing was uploaded…", and a refused field under its field). An item's
page, `/account/flows/[subscriptionId]/items/[itemId]`, shows its header,
then its body as the platform's blocks ("Screen standards"): its tiles —
Total, then the flow's verdict words with the item's tallies, green and red
(none for a flow that declares no verdict words); its file's row, opening
the item's file page; the run form ("Add {run}": the run's file and Start,
staying on the page, drawn by `RunStart` only where a run can start,
`canAddRun`); its runs in exactly `readItem`'s order, each a `PageRow` of its
rank, title and score, a failed one in the muted colour; and Archive,
behind a confirmation, for an owner or admin only. It is read again while
the platform says it is `going`. The item's file page,
`…/items/[itemId]/file`, shows the file (`readItemFile`) and then its
reading (`item.blocks`), every section closed, in its flow's `pages.file`
order. A run with a `title` and a `score` is headed by them; a run of an
item opens with "View {file}" to the run's file page,
`/account/runs/[runId]/files/[fileId]` (`readRunFile`; headed by its
version's file field's title, `runFileRows`); its sections open and close,
the first open, under "{Run word} details".
A file page (`components/dashboard/FileView.tsx`, the rules in
`lib/run-files.ts`) frames a PDF, JPEG or PNG through its own view route (`app/account/runs/[runId]/files/[fileId]/view/route.ts`, the item's alike)
— the platform's signed link read on the server (`lib/file-view.ts`), inline
in that type, any other type an attachment, never cached, framed by this site
alone and asked only by its pages (`Sec-Fetch-Site`) — then Download, the
signed link followed only when https, and Share where the browser hands
files to the share sheet, the bytes read from that same route
(`siteFileBlob`); a block's link is drawn only when it is `https:` and
opens outside the site (`components/blocks/look.ts`). A file field that names its
`acceptedContentTypes` offers those, sends a Word file as it is, offers Take
photo only where a JPEG is taken, and refuses another type in words that name
what it takes (`app/account/flows/run-file-image.ts`); without them, a PDF,
JPEG or PNG as before.

## Container and operations

The Docker image uses Next standalone output and the non-root `nextjs` user.
`compose.yml` joins the backend's external `autom8x_default` network and uses
the internal Edge address `http://api:8080`. The web process exposes liveness at
`GET /api/health`; `GET /api/ready` reflects Edge readiness.

Infrastructure resource allocation and production secret management are
deployment concerns. This repository deliberately proves the interfaces with
typed, credential-free fixtures rather than storing local resource settings.

What each round changed is recorded in the backend-owned BUILD-PLAN; this
repository's findings and their dispositions are the register in
`docs/audits/2026-08-11-round-5-phase-1-status.md`. A screen or control the
app has and this website does not is a parity finding there (Build 23: F105,
Activity's time range and outcome pickers).

## Verification

Run the commands in the README. The fixture browser audit provides disposable
HTTPS, an authenticated cookie-only session, and deterministic public Edge
responses; it is not a substitute for a real non-production OAuth-provider
observation when that environment is provisioned — whose provider registration
must then allow the audit origin `http://127.0.0.1:3001` explicitly.
