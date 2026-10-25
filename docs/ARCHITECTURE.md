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
- Public response types are generated from the three published OpenAPI inputs.
  A web change cannot invent a request, response, cursor interpretation, billing
  flow, invite flow, or OAuth-provider policy.
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
- **A choice is a drop-down**: a flow's `select` field and a list's filter
  are the website's drop-down (`components/ui/Dropdown.tsx`) — a pill for a
  filter, a field's box in a form, its panel glass — never a row of buttons
  and never the browser's own `<select>`.
- **A row that opens a page** is `PageRow` (`components/dashboard/PageRow.tsx`):
  a closed section's box and height, the arrow at its end.
- **Every run's page** ends with the Run details row, then View flow;
  Duration, Steps done, the steps, Started, Ended, Trigger and the Run ID are
  on its details page, `/account/runs/[runId]/details`. What a run read comes
  first, under "{Run word} details", in its result line's place.
- **A flow with items** is its items: no Dashboard, no Steps.
- **A file's page** shows the original in place where a browser draws it,
  then Download and Share, then what was read from it (`FileView`).

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
the one a page says or offers. Each document is a closed row headed in its
flow's word — the catalog entry's `documentWords`, "Invoice 1 of 3" for Invoice
Processing, else "Document 1 of 3" (backend BUILD-PLAN 27.5.1) — with
`{vendor} · {total}`, that opens on its own; no page holds code for one flow
(`test/no-flow-code.test.mjs`); its Format is read from
the job's uploaded files (`RunDetail.files`): its own file, else the only one.

A run's page and its details page ("Screen standards") are one `RunLive`,
read alike (`app/account/runs/[runId]/run-page-data.ts`). A held job is
decided where it waits: step 4 on its details page offers the one
Approve and Deny pair (`app/account/approvals/ApprovalDecision.tsx`, Deny the
danger variant) to a role the job's newest approval names, and says who can
otherwise; a decision draws the page again (the action revalidates it by
the job id the platform answers with). A run can turn held while its page is
open, or the page can read it before its approval is listed. Then the browser
reads the job and its approvals again through `/api/platform`, every 2 s, one
re-read (the job and its approvals, two requests together) at a time and at
most ten times, until the approval is listed or the run
leaves held (`rereadForApproval` in `lib/run-progress.ts`), and works out step
4's pair from what it read (`waitingDecision`). So Approve and Deny appear
with no reload. A read that fails costs only itself: the page stays as it
was, as the app's does. A job whose approval is listed is not read again for
it. On Approvals each row names its flow and the step it waits at, "{flow} ·
{step title}" (`approvalTitle`), never the step id; when the flows or the
catalog cannot be read, the row loses those words and keeps its buttons. A
decided row fades and folds away, its pill saying the decision, and the last
one leaving goes to Activity; under reduced motion it leaves at once.

A job that has documents and has ended or is held has a run package (backend
ADR-0045): View package, Download PDF and Download Excel replace Download
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
page, `/account/flows/[subscriptionId]/items/[itemId]`, shows its tiles —
Total, then the flow's `items.verdictWords` with the item's `positiveCount`
and `negativeCount`, green and red (`itemTiles`; none for a flow that
declares no verdict words); the `items.file.title` row, opening the item's
file page; "Add {run}" — the run's file and Start, staying on the page — only
where a run can start (`canAddRun`); its runs in exactly `readItem`'s order,
each a `PageRow` of its rank, title and score, a run going "Reading…", an
untitled one its status, a failed one in the muted colour; and Archive,
behind a confirmation, for an owner or admin only. The item's file page,
`…/items/[itemId]/file`, shows the file (`readItemFile`) and then its
`sections`, all closed. A run with a `title` and a `score` is headed by
them; a run of an item opens with "View {file}" — its version's first file
field's title (`runFileTitle`) — to the run's file page,
`/account/runs/[runId]/files/[fileId]` (`readRunFile`); its `sections` are
rows that open and close, the first open, under the flow's `items.runWords`.
A file page (`components/dashboard/FileView.tsx`, the rules in
`lib/run-files.ts`) frames a PDF, JPEG or PNG through its own view route (`app/account/runs/[runId]/files/[fileId]/view/route.ts`, the item's alike)
— the platform's signed link read on the server (`lib/file-view.ts`), inline
in that type, any other type an attachment, never cached, framed by this site
alone and asked only by its pages (`Sec-Fetch-Site`) — then Download, the
signed link followed only when https, and Share where the browser hands
files to the share sheet, the bytes read from that same route
(`siteFileBlob`); a section's
link is drawn only when it is `http:` or `https:` and opens outside the site
(`components/dashboard/SectionRows.tsx`). A file field that names its
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
