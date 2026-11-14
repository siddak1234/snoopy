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
- Public response types are generated from the three published OpenAPI inputs
  (read, with the fixtures, rules and repo-facts schema below, from their
  hash-checked copy in `lib/generated/snoopy-backend/`; README "Verification"),
  and the platform's block fixtures beside them
  (`lib/generated/platform-contracts/block-fixtures.ts`, one sha256 over the
  fixtures' bytes in filename order — the rule both clients share), and its
  block rules the same way (`block-rules.ts`: `BLOCK_WORDS`,
  `BLOCK_SPACING` and the search and sort cases, its own sha256 over
  `fixtures/block-rules/`), and each block type's required fields
  (`block-required.ts`: `BLOCK_REQUIRED`, from `automations.yaml`, headed
  by its sha256).
  A web change cannot invent a request, response, cursor interpretation, billing
  flow, invite flow, or OAuth-provider policy. The platform round's setup
  `select` and a held run's review (Round 21, F1 and F2) are the generated
  names too (`AutomationSetupField`'s `options` and `multiple`, `HeldDecision`,
  `ReviewAnswer`, `Approval.decisions`, the `review` question form, the
  decision body's `decisions`); ~~a hand-written interim contract module (on the PR branch only, never on main)~~
  until the regeneration from backend PR #255. Platform round 2's B1–B4
  are generated too (`AutomationSelectOption`, the run input's `multiple`,
  `HeldDecision.group`, the `Healthcare` category, block set 4), and B5's
  `publicProviders` (`PublicConnectionProvider`): the platform never lists a
  public service in `providers`, so `listConnectionProviders` in
  `lib/connections.ts` adds each to the one provider list as `authType`
  `none` (`keylessProviders` in `lib/connection-rows.ts`, whose
  `PublicProvider` and `ProviderAuthType` are the generated types, the
  latter with `none` added), the keyless set Connections, Set up, a flow
  page and its vendor page read. The batch addendum (ADR-0048 amendment 4)
  is generated too: the run input's `maxFiles`, `Run.batch` and `Run.unit`,
  the run page's `batch` part, and 429 `queue_full`.
- A page that shows one flow reads it by its id (`readSubscription` in
  `lib/automations.ts`, `GET …/subscriptions/{id}`; backend §12.1 #319 step
  2): the flow's page, its Set up and Connect integration pages, the
  integration's save and a run's page. It carries the flow's `setup` from the
  version it pins, archived included; a 404, or the 400 the platform answers
  for an id that is not a UUID, is the page's "not found". The
  list still carries `setup` for builds before 34, but no page reads it there;
  adding a flow's duplicate check reads the list.
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
  The header names the department, so a card says neither it nor a price:
  its name, its description, each flow added (its status and Open) and Add
  or Added ✓ (the owner's build 34 F4).
  The departments are the platform's seventeen team kinds, Healthcare the
  newest (platform round 2's B4, `lib/team-types.ts`); the website names a
  department in words and draws no icon for one.
- **One flow card** (the owner's builds 37 and 39, items 1 and 4: "Make a
  standard for flow cards … Icon, short deacription and live. Not meta data
  under."; `components/dashboard/FlowCard.tsx`): the flow's icon — the
  catalog's `icon` name through one map, `lib/flow-icons.ts`, the app's
  `iconFor` names over the same Phosphor set, `Sparkles` read as `Sparkle`,
  an unknown name the neutral `CircleDashed` — its name, its short
  description, and one thing at its end: Live, the day it was archived, or
  Add. Never a line of metadata under it: no department, no "Whole
  workspace", no run counts. Drawn on the Flows cards (each flow added, Open
  and its pill, under it) and the archived rows; Home's cards are its
  compact face, icon and name with no description and no Live, a flow with
  jobs its job pill at their right (see "Home's YOUR FLOWS" below, the
  owner's build 41, item 14, and build 42, item 16); a flow's page
  and its Set up keep "Department: {kind}" under their title (`place.ts`).
  ~~The website draws no flow icon~~ until then: a flow's icon is the
  catalog's, a department still has none.
- **The quick-access card** (the owner's build 43, item 17, 2026-11-13;
  `RunStart` `compact`, `RunFileField`): A quick-access card (Home's YOUR
  FLOWS today, and any card added later that starts a run in place) is two
  rows: the flow's icon and name (a job pill on their right where the flow
  has jobs), then its actions. A run input of one file field has exactly two
  buttons, Upload and Start. Upload opens the browser's own chooser at once,
  with the field's accepted types and no `capture` (build 43, item 3, the
  owner's words: "When upload is clicked it gives the apple selection of
  take photo, photos library, or upload from files native apple selection.
  The native apple one not ours."): on an iPhone or an iPad Safari shows its
  own menu, Photo Library, Take Photo, Choose File ("Choose Files" for a
  field of several; WebKit's `WKFileUploadPanel.mm` writes them, not this
  site), on a computer the system's dialog; the card draws no camera input.
  Every choice from that menu arrives through the one chooser, so on a
  field of several it replaces the files held. Start stays after Upload and
  nothing starts by itself (the owner's "1. Keep start after upload").
  ~~Upload's own menu, Take photo then Choose file~~ until build 43's item
  3. A flow's page and an item's page keep Take photo beside Upload (the
  design's default, not the owner's choice). Start is the
  filled primary, the one filled button (the owner's decision of
  2026-11-13). Start with a required file missing says "Add {title} first."
  in the card and sends nothing. Each file given is a pill, its name and an
  x that takes it out of the run ("Remove {name}"), several in one row that
  scrolls sideways; while a file uploads Start waits and no pill shows.
- **A start form's files** (build 43, item 17; `RunFileField` `removable`,
  `missingFile` in `lib/several-files.ts`): every start form (Home's card, a
  flow's page, an item's page) draws the files a field holds, one or
  several, as pills under its buttons, in one row that scrolls sideways:
  the name, cut with an ellipsis, and an x ("Remove {name}") that takes
  that file alone out of the run (a new run key; nothing deleted on the
  server, the stored copy kept until retention). A press of Start with a
  required file field holding none says "Add {title} first." and sends
  nothing; an optional one starts as before. The filled Start and the
  two-button row are the quick-access card's alone. For the keyboard and
  a screen reader (build 43's follow-up): the x's focus ring is drawn
  inside it (`focus-visible:-outline-offset-2!`, important since the site's
  `:focus-visible` rule is outside every layer), so the pills' scrolling
  row never cuts it and it never covers the name; once an x is pressed the
  focus goes to the x now in its place, else the one before, else the
  field's Upload, never the page; and a hidden polite line beside the
  field's status line says "Uploaded {name}." (one file chosen) or
  "Uploaded {n} files." (several at once) as an upload ends and "Removed
  {name}." as an x takes a file out (`uploadedLine`, `uploadedCountLine`,
  `removedLine`), the line emptied first and the sentence set a frame
  later, so two files of one name (Safari names every camera photo
  "image.jpg") are each heard going. Nothing visible changes; the job upload card keeps its
  "Ready:" line.
- **A choice is a drop-down**: a flow's `select` field, a setup `select`
  (`app/account/flows/SelectField.tsx`) and a list's filter are the website's
  drop-down (`components/ui/Dropdown.tsx`) — a pill for a filter, a field's
  box in a form, its panel glass — never a row of buttons and never the
  browser's own `<select>`. A field that allows several (`multiple`) keeps
  the panel open with a tick on each chosen row, and the closed box says
  "Choose", "{first}, {second}" or "{n} chosen" (`lib/choices.ts`); it is
  sent as the list chosen, and a required one left empty says "Choose at
  least one." under each before anything is sent (`missingChoices`). A
  field's options are strings or `{value, label, group}` (platform round
  2's B1, `choicesOf`): the form sends the `value`, the drop-down and its
  closed box say the `label`, never the value. Holding more than 10 choices
  the panel opens on a search box, "Search", which keeps the rows whose
  label holds what is typed and otherwise says "No matches."; choices with
  a `group` are drawn under its heading, the headings in the order they
  first appear (`choiceGroups`). One of 10 or fewer without groups is drawn
  as before. A setup `select` whose choices carry groups is a sheet the
  page's height instead (`components/ui/ChoiceSheet.tsx`; the owner's build
  34 F1): step 1 its groups under "Category", with a "Search all" box over
  every choice; step 2 one group's choices with a "Search" box; Back a step
  back; one choice closes it, several tick and untick; the box says what is
  chosen as the drop-down's does, and each pick is a chip under it.
- **A setup text field's example** (backend ADR-0048 amendment 5, the
  owner's build 34 F2): a `text` field's `example` is its box's placeholder
  (`app/account/flows/ManifestFields.tsx`); "Optional" stays beside the
  title of a field that may be left empty, where the website has always
  drawn it.
- **Set up's sections** (backend ADR-0048 amendment 5, the owner's build 34
  F3): a manifest that declares `setupSections` (`Subscription.setupSections`)
  has Set up drawn in them, in its order, by its titles, numbered, each its
  fields by `sectionId` — a step's vendor choice (`VendorRows`) in the
  section it names, so Connect is drawn only for an account the flow cannot
  run without, and is then 1. Without them, the four fixed sections, as
  before (`SetupFields` in `app/account/flows/ManifestFields.tsx`).
- **A flow's extra email addresses** (backend §12.1 #289): on the flow's
  email page each says its consent under it, "Waiting for confirmation",
  "Confirmed" or "Unsubscribed" (`FlowEmailRecipients.extraStatuses`,
  `addressStatus` in `lib/flow-email.ts`); a platform that sends none, no
  line, as before. The confirmation email, its footer's "Stop these emails"
  and the pages its links open are the platform's.
- **Several files at once** (platform round 2's B2 as the batch addendum
  amends it): a run's file field that declares `multiple` (`RunFileField`)
  lets the chooser take several files and the camera add each photo, and
  sends each as one file alone is sent (~~then says "{n} files selected"~~
  until build 43, item 17); Start run
  then starts ONE run, its input that field's list of upload ids under the
  one key (`declaredValues` in `app/account/flows/actions.ts`), and opens
  it. More than the field's `maxFiles` (absent, the platform's 50) says
  "Add up to {max} files at a time." and sends nothing: a choice past it
  empties the field, a photo past it keeps the files held. Since build 43,
  item 17, the start forms draw the files held as pills with an x (see "A
  start form's files" in "Screen standards"). ~~Holding one
  file, a field of several says its "Ready:" line; a field of one its
  "Ready: {name} ({size})"~~ until build 43 in the start forms; the job
  upload card (`UploadItemCard`) keeps its "Ready:" line.
- **A full queue**: a run start, or an item made (which starts its run),
  refused 429 with `details.reason` `queue_full` says "Your queue is full.
  Wait for these to finish." and keeps the form, files and key; the older
  `max_concurrent_runs` keeps its flow-busy sentence (`queueFull` in
  `app/account/flows/actions.ts`).
- **A row that opens a page** is `PageRow` (`components/dashboard/PageRow.tsx`):
  a closed section's box and height, the arrow at its end — or, `boxed`
  false, a row of one card of divided rows (`LIST_CARD`): a list block's
  rows, a flow's items and Activity's runs.
- **Home's YOUR FLOWS** (the owner's build 34 F5, and builds 37 and 39,
  items 2, 3, 5 and 8; `app/account/YourFlows.tsx`, `home-flows.ts`), in
  Recent runs' place: the title and, at its right, a department drop-down
  ("All departments", then the departments drawn, A–Z); under it "Search
  flows", by name whatever its case (nothing found, `BLOCK_WORDS.noMatch`);
  then the live flows by department A–Z, A–Z in each, from the one
  subscriptions list Home reads, each a card of its own, always open: the
  flow card, compact (`FlowCard` `compact`: the table's row steps,
  `SPACING.rowY` and `SPACING.rowX`, for its padding, its icon and name in
  one centred row, no description and no Live — the owner's build 41, item
  14: "Just the logo, title, then the buttons and items. We do not need the
  description and live"), in two rows (the owner's build 42, item 16: "It
  looks like big squares for a quick access"): row 1 the icon and name (the
  head, `flow-card-head`); row 2 the run's start, compact (`RunStart`
  `compact`, Home only: the form's gap `SPACING.inner.gap`, its button
  "Start", named "Start run" while idle, the filled primary, `Button`
  `filled`, the owner's decision of 2026-11-13: the quick-access card's
  Start is filled; every other primary stays an accent outline, never a
  fill). A run input of exactly one file field is row 2's two buttons,
  Upload then Start (build 43, item 17), the field's title for screen
  readers only (`RunFileField` `compact`: its `<label>` `sr-only`, Start its
  `trailing`); Upload opens the browser's own chooser; under the row its
  uploading line, then its pills, then the errors (see "The quick-access
  card" and "A start form's files" in "Screen standards").
  ~~Take photo (a phone or tablet), Upload and Start on one row that wraps;
  its uploading or ready line~~ until build 43. Any other run input keeps
  its fields and their titles, then Start, filled. A flow without items:
  that start. A flow with items, for an owner or admin: its items read as
  Home opens — each flow's alone, "Loading…" or "Unavailable" in the card —
  the job drop-down, a pill at the right of row 1 (`aside`, named by the
  flow's word for one for screen readers; at most half the row, as the
  app's, so a long title is cut short inside the card and the name keeps
  its icon and a truncated name), on its newest ready job
  (`newestReady`, the list is newest first), then the start; none ready,
  "No jobs yet." and "Upload job" in one row (`home-empty-…`), the flow
  page's upload card, the job read again every 2 s on Home until it is
  ready. Any other flow's card says Open, to its page. A flow's page and an
  item's page draw the start form as before. ~~A row per flow that opened
  in place; items read when opened; "Choose" a job~~ until builds 37 and
  39; ~~the full card, its description and Live, a divider over the run
  form~~ until build 41; ~~the job drop-down a row of its own under its
  title, the file's title over its buttons, Start run on a row of its
  own~~ until build 42. The Flows list, its archived rows and
  Add a flow keep the full card. The owner's build 41, item 15 ("Why am i
  seeing departments not actively part of active flows for this org") needs
  no change here: the website has no department scope menu (a deliberate
  mobile difference, "The scope control" in
  `snoopy-mobile/DESIGN-CONTRACT.md`), and Home's
  drop-down lists only the departments of the live flows it draws
  (`app/account/home-flows.ts:72` keeps live flows, `:130-140` its
  choices).
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
  dividers; a section's blocks have a divider line between them, none under
  a label (the owner's build 31 G3); nothing above the first group. `test/spacing.test.mjs` holds it:
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
  sort and page always sent (`runsQuery`); it never sends `needsReview`. A search that finds nothing says so,
  in `BLOCK_WORDS`' words.
- **Every run's page** has two faces by its status (`runFace`; the owner's
  builds 37 and 39, item 10, and his words of 2026-11-06), every flow alike.
  Its **steps face** while it is pending, running or held, and once it
  failed or was cancelled: its flow's name, its job's title under it (one
  `readItem`, left out when it cannot be read), its status; STEPS, every
  step from the start, live (`trackerRows`, `TrackerItem`) — a batch run's
  by its flow's batch steps in order, "1 · Pages counted" to "4 · Visits
  queued" for ICD-10 Code Check v4, then "Run completed" only when the run
  has an email (`batchRows`, chosen by `batchStepsFor` for a batch parent
  of a flow with `batch`; backend ADR-0048 amendment 6; never the flow's
  groups, which a batch's child and a flow without `batch` keep); its body as the
  platform sent it (the files rows, the result line, a held job's form, a
  batch's children — blocks carry no part marker, so the body is drawn
  whole); Cancel run while it goes on; the Run details row last. Its
  **result face** once it succeeded: its title and score (a candidate) or
  its flow's name, its body — what it read first, under "{Run word}
  details", in its result line's place — the package's buttons, View flow,
  and the Run details row last. A run that succeeds while its steps are in
  front turns in place. Its details page, `/account/runs/[runId]/details`,
  is its metadata alone: Duration, Steps done, Started, Ended, Trigger and
  the Run ID. Its back goes to Activity; opened from its job's page — a
  ranked row there, Start on it (the owner's G4), or Start on Home on that
  job — (`?from=item`, `runPagePath`) to that job, by the run's own
  `itemId`; started on Home or a flow's page for a flow without items
  (`?from=flow`) to the flow's page. Its details, file and package pages
  keep `from`, so their back returns to it as it was opened (the owner's
  G1). ~~"Run {id}" as its title; its steps on its details page~~ until
  builds 37 and 39.
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
  (green or red, the run's verdict) beside its chip. Since block set 5
  (ADR-0048 amendment 5), fourteen: a `links` block is full-width pill
  buttons, one under another, each its `brand`'s mark and its label,
  opening outside, https only as a `link` is. The marks are the icon set's
  LinkedIn, GitHub and X, and Hugging Face's own monochrome logo
  (`components/ui/HuggingFaceLogo.tsx`, its official file kept as
  `public/vendors/hf-logo-monochrome.svg`, the owner's F3 of 2026-11-04),
  each in the text colour; `site`, none, or one with no mark here, the
  globe. The flow page draws its parts in `Subscription.pages.flow` order
  (`pageParts`),
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
  workspace summary shares its own JSON. A complete export of a large
  workspace comes in parts (backend §12.1 #181, `WorkspaceExportJob.files`):
  "Download file {n} of {N}" for each, in order, each link asked for at the
  press, and no Share, which reads the one-file export alone
  (`exportFiles` in `lib/export-contract.ts`); its line says "Or export
  every record. A large workspace comes as several files, each kept for a
  day." Its ready, partial, removed and too-large lines say "the export",
  one file or several: "Ready. The export holds the whole workspace.",
  "…and the export says which.", "That export has been removed. Export
  again for a new one." and "The workspace is larger than one export may
  be." (the owner's F2, 2026-11-04), as the app's.
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
(`app/account/connections/start-connect.ts`). Only an owner or admin
changes a flow (backend §12.1 #180): a member sees Add on Flows, a flow's
Set up (its integration and settings, no Turn on or Save), and its Turn on,
Pause and Archive flow read-only, under "Only an owner or admin can change
this flow." (`FLOW_CHANGE_ADMIN_ONLY` in `lib/subscription-entitlements.ts`),
and a change the platform refuses as a member's (403
`flow_change_requires_admin`) says the same; a member still starts runs.
~~On a newly added flow's Set up, the member makes its first choice (backend
ADR-0043 §2)~~ until Round 21's stage 1. A provider whose
`authType` is `none` (a public service, platform round 2's B5) has no
connect step: it is connected for every workspace (`isKeyless`), its row
says "Connected" with no Connect or Disconnect, Set up draws no Connect
step for it, and it never holds a flow back. A connected row whose account
names no email — QuickBooks sends none — says the company its grant belongs
to (`ConnectionState.companyName`, read once at connect, backend §12.1 #283)
in "Connected"'s place (`connectionLine` in `lib/connection-rows.ts`). A
connection the platform retired because the provider would not renew it (backend §12.1 #252:
`disconnected`, with the `errorCode` the refresh loop sets when it retires
one) says "Disconnected in {provider}" in the warning colour, with
Reconnect, on Connections and a step's vendor rows (`disconnectedAtProvider`
in `lib/connection-rows.ts`). It names QuickBooks "QuickBooks", where the
catalog lists "QuickBooks Online", and any other provider as the catalog
lists it (`disconnectedName`); one disconnected here carries no `errorCode`
and stays "Not connected" with Connect. QuickBooks' Disconnect URL is the
static `/quickbooks/disconnected` ("QuickBooks is disconnected", its
"Reconnect QuickBooks" opening Connections), which the owner sets at
Intuit; it reads nothing.

The EHR (backend ADR-0050, D1: `authType` `smart-backend`, SMART Backend
Services) is connected through Connections' key form, as a pasted-key
provider is (`opensKeyForm` in `lib/smart-backend.ts`): its fields from
`credentialFields`, the clinic's FHIR address and its help, and its vendor —
a picker of radios only when the platform lists two or more `vendors`, the
one it lists sent unseen otherwise (`app/account/connections/KeyFields.tsx`).
Nothing secret is pasted: the platform signs with its own key for that
vendor. An address it will not use is said by its reason ("Use the https
address your EHR team gave you.", "That address didn't answer as a FHIR
server.", "Your EHR hasn't turned on Autom8x yet. Ask your EHR team to
activate it."; `smartBackendRefusal`; the app's too), and its row, connected, names the
clinic's host (`connectionLine`). A flow step that offers the EHR sends an
owner or admin to Connections, as any vendor that is not OAuth.

A person who holds a sign-in outside a domain-only organization's verified
domains (backend §12.1 #221, option b′) sees, in the account area while that
organization is active, its own screen (`components/account/OutsideSignIn.tsx`):
"This organization admits only people who sign in with addresses at its
verified domains.", "Remove your other sign-in to continue." and "Remove
{provider} sign-in" for each such sign-in, which unlinks it as Settings'
linked accounts do and reads the area again. The platform refuses (403
`outside_org_domain`, naming those sign-ins) only a request billed to that
workspace, one whose path names it; the account layout's session and
workspace reads name none and still answer, so the navigation stays. A
page's own read is refused, its render fails, and the account area's error
screen (`app/account/error.tsx`), with the session kept, makes one read
that names the active workspace (its members, `outsideOnError` in
`lib/domain-only.ts`): refused so, it draws this screen in place of "The
platform could not answer just now". No page that loads makes that read.

Deleting the account (Settings, `components/account/DeleteAccountButton.tsx`)
says what the route removes, and "You'll be signed out on all devices.": the
platform ends every session of the account it deletes (backend §12.1 #248).
Any 5xx from `DELETE /v1/account` is sent again once, at once: the purge is
idempotent, and a sign-in identity delete that failed after it runs again.
The session is never read after a failed delete, because once the rows are
purged that read makes a new, empty account. A second 5xx says the outcome
is not known, and Try again sends the delete again; any other answer to the
second attempt is said as the outcome table says (`outcomeFor`). No answer
at all is not sent again on its own.

## The health data agreement

A flow that carries health data (backend ADR-0049, C3; the catalog says so,
`AutomationCatalogEntry.healthData`) is added as a draft like any other, so
its Add opens Set up with no dialog (builds 37 and 39, wave 2; ADR-0049
amendment 2). Turning it on, starting a run and an item's upload (which
starts a run) are refused 403 `agreement_required` until the workspace's
owner has accepted the current health data agreement; nothing was made.

**In Set up** (the owner's item 9 of builds 37 and 39: "Where is the BAA
contract to view prefilled and checkmark to accept below it … 4. Contract
and accept"): after the flow's own sections, numbered next, "Contract and
accept" (`app/account/flows/[subscriptionId]/setup/ContractStep.tsx`,
`NumberedStep` as the others). The page
reads, for an owner or admin only, the workspace's agreement
(`readWorkspaceHealthDataAgreement`: the current version and sha256, null
while none is published, and the workspace's acceptance of exactly it) and,
for the owner while it is not accepted, the text; a member is not read and
is asked to ask the owner. By its state (`contractStep` in
`lib/health-agreement.ts`): "The agreement is being finalized." (none
published); "Accepted · Version {n} · {date}" over "{name}, {title}"; for
the owner the text in the dialog's scroll box, its `{Covered Entity}` the
workspace's name and its `{Effective date}` today's UTC date, for display
only (`fillForDisplay`; the platform fills the signed copy at acceptance),
then "I'm authorized to sign for {organization}", Full name and Title (120);
"Ask your workspace owner to accept the health data agreement." for anyone
else; "Unavailable" when a read failed — the rest of Set up drawn either
way. Turn on is disabled until it allows (`contractAllowsTurnOn`: accepted,
or the owner's box ticked and both fields filled). The owner's one press
accepts (`acceptHealthAgreement`, the text's version and sha256, one key per
text read), then saves and turns the flow on; a press after the turn-on was
refused sends the turn-on alone, never a second acceptance
(`acceptThenRepeat`). A 409 `agreement_changed` reads the section again, the
box unticked, the name and title kept, a new key. A turn-on the platform
refuses 403 `agreement_required` (`saveSetup`'s `agreement-required`) reads
the section again — never the dialog. Save, on a flow on or paused, is
never held by it: the platform asks nothing of a save that moves no status.
"Accepted" by the page's own press holds only while the text offered is the
one it accepted (its sha256); a turn-on refused 403 after it (a newer
version published) reads the section again, the box unticked and a new
key, and the newer text is signed.

**On Turn on outside Set up** — a flow's own page (`RunStart`), for a draft
added and not set up or a paused flow — the same refusal is read as Start
run's (`setSubscriptionStatus` with `agreementRefusal`): the owner gets the
dialog below, its button "Accept and turn on" ("Turning on…"), which
accepts once and sends the turn-on again; anyone else the one line.

**On Start run, an item's upload and that Turn on** only that refusal makes the website
read anything more (`agreementRefusal` in `lib/agreements.ts`): who the
person is in the workspace and, for its owner, the text. The owner gets one
dialog (`app/account/flows/HealthAgreementDialog.tsx`): "Health data
agreement", "Version {n}", the text to scroll, "I'm authorized to sign for
{organization}", Full name and Title, and "Accept and start run" (an item's
upload: its dialog opens over the upload card), "Starting…" while it works,
which accepts once, under the dialog's own key, then sends the run or the
item again under the key the refused one carried (`RunStart`,
`UploadItemCard`), so a lost answer starts nothing twice; a press after that
repeat was refused sends the repeat alone, never a second acceptance
(`acceptThenRepeat`). A refused acceptance is said in place: a 403 asks the
owner, a 503 `agreement_not_published` says it isn't available yet, anything
else in the platform's words. Anyone else sees "Ask your workspace owner to
accept the health data agreement." and nothing more is sent (a member's
upload is refused first as a member's: "Only an owner or admin can do
this."); while no version is published the owner sees "The health data
agreement isn't available yet.". No other run or item makes an extra call.
~~Add refused until accepted, "Accept and add flow"~~ until wave 2. The words
are `lib/health-agreement.ts`. Both clients hold them: the app's are
`snoopy-mobile/lib/content/health-agreement.ts`, and the app's own wave 2 pull
request gives it "Accept and turn on", "Turning on…" and the turn-on step on
its flow page.

The organization page lists the workspace's signed documents under
"Documents", read once with the page, newest first: "Business Associate
Agreement · Version {n}" over "Accepted by {name} on {date}", or "No
documents yet." (`components/dashboard/OrgDocumentList.tsx`). A row opens
the signed copy's page (`app/account/organization/documents/[documentId]/page.tsx`),
the only place the copy is read; a document that is not this workspace's,
or an id that is not one (the platform's 400), is "not found". The organization page is its owners' and
admins' (register F55), and so are both reads: the platform refuses a
member 403 for the list and for a copy (backend ADR-0049 amendment 1,
snoopy-backend #269).

The fixture Edge (`e2e/fixtures/health-data.ts`) answers these refusals
as the published contract says. The platform's own are checked once against
the live platform, on a test workspace, each after its own deploy and before
this change is marked ready; no local Compose run is made for them: backend
#266's `agreement_required` on a run and an item, `outside_org_domain`, and an
Approve's 409 `approval_expired`; backend #272's (ADR-0049 amendment 2,
deployed 2026-11-06) `agreement_required` on a turn-on and the workspace's
agreement read, `GET /v1/workspaces/{id}/agreements/health-data`.

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
read alike (`app/account/runs/[runId]/run-page-data.ts`). A step titled by
its connection ("QuickBooks updated") and a setting step's line read the
connection choices the run started with (`RunDetail.connectionChoices`,
backend §12.1 #290) over the flow's settings now; a run made before they were
saved reads the flow's, as before. A batch run's page
(ADR-0048 amendment 4) is drawn as the platform sends it: the batch's own
blocks, then its `batch` part — "{unit plural}", "{n} {unit plural} queued"
and each child run in order, its label, its status and a link to its run. A held job is
decided on its page: under the result line, "Waiting for approval.", the
platform's approval form (`questions{approval}`), drawn as the one Approve
and Deny pair (`app/account/approvals/ApprovalDecision.tsx`, Deny the danger
variant) to a role the form names (`mayDecide`), and says who can otherwise;
step 4 on its steps face keeps the step's state alone (build 28's review,
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
admin can review this."; a page that draws no form for it reads the rows
alone (`ReviewRows` in `components/blocks/renderers.tsx`), each label then
its detail, with no pills; the block fixtures `review-held-*` read a
review's labels and details, not its group headings, so until the platform's
`review-held-grouped` names them the parity test expects each heading before
its group's first row, as the app's does.
Changes that carry a `group` (platform round 2's B3) are drawn under its
heading, in both places, the groups in the order first sent and every one
open, up to 400 changes (`reviewGroups`, `offeredDecisions`); Save review
still waits for every answer. A review without groups is drawn as before.
A change that offers other values (`options`, at most 3; backend ADR-0048
amendment 5) has a third pill to one who may decide, "Other code", which
opens their short list under the row; one picked is the row's answer, and
the row says "Changed to {code}" (its value) until Accept or Deny is pressed
instead. A page that draws no form reads no option (`ReviewRows`, as the
fixture `review-held-options` reads). A saved review's count does not yet
count an `other`, as the platform's own line does not.
Saving sends every answer (`{decisions: [{id,
decision}]}`, or `{id, other}` for a picked value) and the job always goes
on; a refusal says "The review wasn't
saved. Try again." On Approvals such a row says "Review {n} changes",
opening the run, in place of the pair. Once saved, the step that waited
says "{a} accepted · {d} denied" on the run's steps face, even while the
job goes on (`reviewTally`, `trackerRows`): a run's page reads the job's
approvals whenever a step reported `held`, not only while it is held
(`readsJobApprovals`). A gap, named: words.md also puts the count in
Approvals, but Approvals lists only what waits and a review is saved on the
run's page, so no Approvals row ever holds a saved review; the default
until the owner says otherwise is the count on the run alone. A held run
without changes is unchanged. The words are ICD-10 Code Check's words.md
section 3, the app's too.

A held job whose approval a disconnect expired (backend §12.1 #252,
`Approval.expiredBy` with `connection-disconnected`) says so over its run
page's body: "Expired · {provider} was disconnected", then "Reconnect
{provider}, then start the run again." — the provider named as the
connection row names it (`disconnectedName`; `expiredByDisconnect` in
`lib/run-progress.ts`) — and its step offers no Approve or Deny. The
platform sets it when the approvals list is read and on an Approve (backend
§12.1 #252, S1-8b). That Approve is refused 409 `approval_expired` with
`expiredBy`: the pair's place says the same two lines, with nothing to
press, the provider named from one read of the providers made on that
refusal only (`expiredApproval`, `app/account/approvals/expired-approval.ts`);
Approvals keeps the row, "Expired", and it and the run pages are drawn
again. A plain expiry, or a reason this build does not know, adds nothing
and keeps the platform's words.

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
opens outside the site (`components/blocks/look.ts`). A list row's text that
is, whole and trimmed, one email address or one phone number
(`lib/contact-value.ts`; the owner's builds 37 and 39, item 11) is a
`mailto:` or `tel:` link with Copy beside it, which puts the value on the
clipboard and says "Copied" (`components/blocks/ContactLink.tsx`); any other
text stays words, whichever flow sent it. A file field that names its
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
