import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import { offeredDecisions, reviewTally } from "../lib/pending-contract.ts";
import {
  ACCEPT,
  ANSWER_EACH,
  DENY,
  REVIEW_MEMBER_NOTE,
  REVIEW_NOT_SAVED,
  SAVE_REVIEW,
  changeLine,
  rereadForApprovalForm,
  reviewAnswers,
  reviewChanges,
  reviewedLine,
  trackerRows,
} from "../lib/run-progress.ts";
import {
  elements,
  loadBlocks,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * Build 24's website guards that are not one module's (the owner's build 23
 * feedback; the round's P6 and P7): Approve and Deny where a job waits, one
 * pair on both pages; a decided row on Approvals that leaves.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
/** A source file's code alone: its comments — where gone words are struck through — left out. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

/** The website's runtime sources: app/, components/, lib/ and hooks/, less the generated contracts. */
function runtimeFiles() {
  const found = [];
  const walk = (directory) => {
    if (!existsSync(join(root, directory))) return;
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (path !== "lib/generated") walk(path);
      } else if (/\.(?:ts|tsx)$/u.test(entry.name)) found.push(path);
    }
  };
  for (const directory of ["app", "components", "lib", "hooks"])
    walk(directory);
  return found;
}

let blocks;
before(async () => {
  blocks = await loadBlocks();
});
after(() => blocks?.cleanup());

/** A parsed element as markup again, for its words. */
function markupOf(node) {
  if (node.text !== undefined) return node.text.replace(/</gu, "&lt;");
  const attrs = Object.entries(node.attrs)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");
  return `<${node.tag}${attrs}>${node.children.map(markupOf).join("")}</${node.tag}>`;
}

const DECISION = "app/account/approvals/ApprovalDecision.tsx";
const LIVE = "app/account/runs/[runId]/RunLive.tsx";

test("one Approve and Deny pair on both pages: Approve primary, Deny danger, Approving… and Denying… while it saves — and no other page decides an approval or draws its own pair (P6; S6)", () => {
  const decision = code(read(DECISION));
  assert.match(
    decision,
    /<Button\s+variant="primary"[\s\S]*?\{pending && pressed === "approved" \? "Approving…" : "Approve"\}\s*<\/Button>/u,
  );
  assert.match(
    decision,
    /<Button\s+variant="danger"[\s\S]*?\{pending && pressed === "rejected" \? "Denying…" : "Deny"\}\s*<\/Button>/u,
  );
  assert.doesNotMatch(decision, /Reject|Working…/u);
  // Both wait while either saves.
  const pair = decision.slice(
    decision.indexOf("function DecisionPair"),
    decision.indexOf("function MayNotDecide"),
  );
  assert.equal(pair.match(/disabled=\{pending\}/gu)?.length, 2);
  // The decision is sent from this one component (requests to join a team or
  // an organization are other things, with their own words).
  const deciders = runtimeFiles().filter((path) =>
    /import \{[^}]*\bdecideApproval\b[^}]*\} from "@\/app\/account\/flows\/actions"/u.test(
      read(path),
    ),
  );
  assert.deepEqual(deciders, [DECISION]);
  for (const path of [
    LIVE,
    "app/account/runs/[runId]/page.tsx",
    "app/account/runs/[runId]/details/page.tsx",
    "app/account/approvals/page.tsx",
  ])
    assert.doesNotMatch(
      code(read(path)),
      /"(?:Approve|Deny)"|>\s*(?:Approve|Deny)\s*</u,
      `${path} draws its own pair`,
    );
});

test("a held job's page offers the decision: RunLive draws the platform's approval form (questions{approval}, under the result line) with ApprovalDecision to a role it names, else who can; a saved decision draws the page again (P6; build 28's review, finding 1; backend ADR-0048)", () => {
  const live = code(read(LIVE));
  assert.match(
    live,
    /import \{ ApprovalDecision \} from "@\/app\/account\/approvals\/ApprovalDecision";/u,
  );
  assert.match(
    live,
    /const decisionForm = \(form: PendingQuestionForm\) =>\s*form\.approvalId \? \(\s*<div data-testid="run-decision">\s*<ApprovalDecision\s+approvalId=\{form\.approvalId\}\s+canDecide=\{mayDecide\(role, form\.eligibleRoles\)\}\s+eligibleRoles=\{form\.eligibleRoles \?\? \[\]\}/u,
  );
  // The approval form and a review's (Round 21's F2) are the one decision.
  assert.match(
    live,
    /forms: \{ approval: decisionForm, review: decisionForm \}/u,
  );
  // One pair: no step of the details page draws its own.
  assert.equal(live.match(/<ApprovalDecision\b/gu)?.length, 1);
  assert.match(
    live,
    /onDecision=\{\(_, state\) => \{\s*if \(state === "saved"\) router\.refresh\(\);\s*\}\}/u,
  );
  // Who may decide is said in ONE place, the decision component (review fix 3).
  assert.doesNotMatch(live, /can\s+decide this/u);
  const decisionComponent = code(
    read("app/account/approvals/ApprovalDecision.tsx"),
  );
  assert.equal(
    decisionComponent.match(
      /Only \{eligibleRoles\.join\(" or "\)\} can decide this\./gu,
    )?.length,
    1,
  );
  // This person's role among the form's, worked out where the re-reads land,
  // in the browser (Build 25's audit; mayDecide's own test holds the rule),
  // and the role read with every run: one that turns held while its page is
  // open is offered the pair from there.
  const data = code(read("app/account/runs/[runId]/run-page-data.ts"));
  assert.match(data, /\n\s*roleInWorkspace\(workspaceId\),\n/u);
  assert.doesNotMatch(data, /held \? roleInWorkspace/u);
  for (const path of [
    "app/account/runs/[runId]/page.tsx",
    "app/account/runs/[runId]/details/page.tsx",
  ])
    assert.match(code(read(path)), /role=\{role\}/u, path);
});

test("a decision draws the job's run page again, by the id the platform answers with (P6; backend ADR-0044)", () => {
  const actions = code(read("app/account/flows/actions.ts"));
  const decide = actions.slice(
    actions.indexOf("export async function decideApproval"),
    actions.indexOf("export async function cancelRun"),
  );
  assert.match(
    decide,
    /runId = \(await decideWorkspaceApproval\(workspaceId, approvalId, body\)\)\s*\.approval\.runId;/u,
  );
  assert.match(
    decide,
    /if \(result\.ok\) \{\s*revalidatePath\("\/account\/approvals"\);\s*revalidatePath\("\/account\/runs"\);\s*if \(runId\) revalidatePath\(`\/account\/runs\/\$\{encodeURIComponent\(runId\)\}`\);\s*\}/u,
  );
});

test("Approvals: a decided row fades and folds in 220 ms (none under reduced motion), says its decision — never Pending — while it goes, and the last one leaving goes to Activity (P7)", () => {
  const decision = code(read(DECISION));
  assert.match(decision, /const LEAVE_MS = 220;/u);
  assert.match(
    decision,
    /motion-safe:transition-\[grid-template-rows,opacity\] motion-safe:duration-\[220ms\]/u,
  );
  assert.match(
    decision,
    /decision \? "grid-rows-\[0fr\] opacity-0" : "grid-rows-\[1fr\]"/u,
  );
  assert.match(
    decision,
    /window\.matchMedia\(\s*"\(prefers-reduced-motion: reduce\)",?\s*\)\.matches;[\s\S]*?still \? 0 : LEAVE_MS/u,
  );
  assert.match(
    decision,
    /decision === "rejected"\s*\? "denied"\s*: \(decision \?\? approval\.status\)/u,
  );
  assert.match(
    decision,
    /if \(left > 0 && shown\.length === 0\) router\.push\("\/account\/runs"\);/u,
  );
  // Arriving with nothing waiting keeps the empty screen.
  assert.match(
    decision,
    /if \(shown\.length === 0\) return left > 0 \? null : empty;/u,
  );
  // The decision's redraw no longer lists the row; it is kept until it has left.
  assert.match(
    decision,
    /setShown\(keepLeaving\(rows, shown, new Set\(Object\.keys\(decided\)\)\)\);/u,
  );
  const page = code(read("app/account/approvals/page.tsx"));
  assert.match(page, /<ApprovalQueue/u);
  assert.match(page, /title="Nothing needs review"/u);
});

test("one entry per job, by the job's id: no after-approval row on Activity, and no link to the run that was held — a job is its first run (P9; backend ADR-0044)", () => {
  const list = code(read("app/account/runs/page.tsx"));
  assert.doesNotMatch(list, /after approval|approval-continuation/iu);
  const live = code(read(LIVE));
  assert.doesNotMatch(live, /continuesRunId|the run that was held/u);
  assert.doesNotMatch(
    code(read("lib/run-progress.ts")),
    /approval-continuation|continued in a new run/u,
  );
});

test("each document is a closed row that opens in place: never drawn open, its bar the heading, {vendor} · {total} and the chip; its body starts with Document type and Format, the row left out when the format is not known (P10; the platform's blocks since backend ADR-0048)", () => {
  for (const name of ["v7-recorded", "v7-held-waiting", "v7-held-denied"]) {
    const fixture = BLOCK_FIXTURES.find((candidate) => candidate.name === name);
    const documents = fixture.blocks.filter(
      (block) => block.type === "section" && / of \d+$/u.test(block.title),
    );
    assert.ok(documents.length > 0, name);
    const markup = blocks.render(fixture.blocks);
    const drawn = elements(parse(markup)).filter(
      (node) => node.tag === "details",
    );
    assert.equal(drawn.length, documents.length, name);
    drawn.forEach((node, index) => {
      assert.equal("open" in node.attrs, false, `${name} ${index + 1} closed`);
      const summary = node.children.find((child) => child.tag === "summary");
      assert.deepEqual(
        visibleWords(markupOf(summary)),
        [
          documents[index].title,
          documents[index].subtitle,
          documents[index].badge.text,
        ],
        `${name} ${index + 1}'s bar`,
      );
    });
    // Format is left out when it is not known (P10).
    for (const document of documents)
      assert.match(
        document.blocks[0].rows.map((row) => row.cells[0]).join("|"),
        /^Document type(?:\|Format)?$/u,
      );
  }
});

const PACKAGE_PAGE = "app/account/runs/[runId]/package/page.tsx";
const PACKAGE_ROUTE = "app/account/runs/[runId]/package/file/route.ts";

test("the package page shows the PDF itself: a frame the page's height of the site's inline route, titled Run package, with Download PDF and Download Excel; a job with no package yet says so (P12; the owner's word over S16)", () => {
  const page = code(read(PACKAGE_PAGE));
  assert.match(page, /title="Run package"/u);
  assert.match(
    page,
    /ready \? \(\s*<PackageActions workspaceId=\{workspaceId\} runId=\{job\} view=\{false\} \/>/u,
  );
  assert.match(page, /<PackageFrame \/>/u);
  // Its PDF read once, for the frame and Share alike.
  assert.match(page, /<PackageFile runId=\{job\}>\{card\}<\/PackageFile>/u);
  assert.match(page, /<EmptyRow text=\{PACKAGE_UNAVAILABLE\} \/>/u);
  assert.match(
    page,
    /back=\{<BackLink href=\{`\/account\/runs\/\$\{encodeURIComponent\(job\)\}`\} \/>\}/u,
  );
  const live = code(read(LIVE));
  assert.match(
    live,
    /const href = zone === null \? null : packageFileHref\(runId, zone \|\| null\);\s*const read = usePageFile\(href\);/u,
  );
  assert.match(
    live,
    /const shown = page\?\.url \?\? \(page\?\.failed \? page\.href : null\);\s*return shown \? \(\s*<iframe title="Run package" src=\{shown\} className=\{frame\} \/>/u,
  );
  // The read waits for the browser's zone: the server draws none.
  assert.match(
    live,
    /useSyncExternalStore\(\s*noSubscription,\s*browserTimeZone,\s*\(\) => null,?\s*\)/u,
  );
});

test("the package's inline route: the PDF asked for through lib/platform-server, its signed link read on the server, handed on inline — application/pdf, never cached, framed by this site alone — and nothing over the platform's bound; a request another site started refused (P12)", () => {
  const route = code(read(PACKAGE_ROUTE));
  assert.doesNotMatch(route, /\bfetch\(/u);
  assert.match(
    route,
    /createRunPackageFile\(workspaceId, runId, body, origin\)/u,
  );
  assert.match(route, /format: "pdf" as const/u);
  assert.match(
    route,
    /if \(file\.format !== "pdf" \|\| file\.sizeBytes > RUN_PACKAGE_MAXIMUM_BYTES\)\s*return said\(413, COULD_NOT_SHOW\);/u,
  );
  assert.match(
    route,
    /platformSignedFile\(\s*file\.downloadUrl,\s*RUN_PACKAGE_MAXIMUM_BYTES,?\s*\)/u,
  );
  // The PDF's own headers, in the one answer that carries it.
  assert.match(
    route,
    /return new Response\(pdf\.stream, \{\s*headers: \{\s*"content-type": "application\/pdf",\s*(?:\/\/[^\n]*\n\s*)*"content-disposition": `inline; filename="\$\{safeFilename\(file\.filename\)\}"`,\s*"cache-control": "private, no-store",\s*"x-content-type-options": "nosniff",\s*"content-security-policy": "frame-ancestors 'self'",/u,
  );
  assert.match(
    route,
    /if \(fetchSite !== "same-origin" && fetchSite !== "none"\)\s*return said\(403,/u,
  );
  // Long enough for the platform's build, and stated (review fix 5).
  assert.match(route, /export const maxDuration = 60;/u);
  const automations = code(read("lib/automations.ts"));
  assert.match(
    automations,
    /export const RUN_PACKAGE_REQUEST_TIMEOUT_MS = 30_000;/u,
  );
  assert.match(automations, /timeoutMs: RUN_PACKAGE_REQUEST_TIMEOUT_MS,/u);
  assert.match(
    route,
    /if \(error\.status === 409\) return said\(409, PACKAGE_UNAVAILABLE\);/u,
  );
  const server = code(read("lib/platform-server.ts"));
  const signed = server.slice(
    server.indexOf("export async function platformSignedFile"),
    server.indexOf("export async function platformPublicJson"),
  );
  assert.match(signed, /if \(link\.protocol !== "https:"\)/u);
  assert.match(signed, /redirect: "error"/u);
  assert.match(
    signed,
    /if \(length !== null && length > maximumBytes\) \{\s*await response\.body\.cancel\(\);/u,
  );
  assert.match(
    signed,
    /arrived \+= chunk\.byteLength;\s*if \(arrived > maximumBytes\)\s*controller\.error\(/u,
  );
});

test("a held run's review: each change a row with Accept and Deny (Deny the danger pill), Save review once every row is answered, the answers sent as decisions; Approvals' card says Review {n} changes and opens the run; the steps say {a} accepted · {d} denied; a plain held run keeps Approve and Deny (Round 21, the platform round's F2; ICD-10 Code Check's words.md section 3)", () => {
  // The words, word for word.
  assert.equal(ACCEPT, "Accept");
  assert.equal(DENY, "Deny");
  assert.equal(SAVE_REVIEW, "Save review");
  assert.equal(ANSWER_EACH, "Accept or deny each change.");
  assert.equal(REVIEW_MEMBER_NOTE, "Only an owner or admin can review this.");
  assert.equal(REVIEW_NOT_SAVED, "The review wasn't saved. Try again.");
  assert.equal(reviewChanges(3), "Review 3 changes");
  assert.equal(reviewedLine(2, 1), "2 accepted · 1 denied");
  assert.equal(
    changeLine({ label: "N18.4 → Remove", detail: "No stage code." }),
    "N18.4 → Remove · No stage code.",
  );
  assert.equal(changeLine({ label: "Add Z99.2" }), "Add Z99.2");

  // What an approval or a form offers; none is a plain approval.
  assert.deepEqual(offeredDecisions({}), []);
  assert.deepEqual(offeredDecisions(null), []);
  assert.deepEqual(
    offeredDecisions({
      decisions: [
        { id: "a", label: "A", detail: "why" },
        { id: "b", label: "B" },
        { id: 3, label: "bad" },
      ],
    }),
    [
      { id: "a", label: "A", detail: "why" },
      { id: "b", label: "B" },
    ],
  );
  // A saved review's count: approved, every row answered.
  const offered = [
    { id: "a", label: "A", decision: "accepted" },
    { id: "b", label: "B", decision: "denied" },
    { id: "c", label: "C", decision: "accepted" },
  ];
  assert.deepEqual(reviewTally({ status: "approved", decisions: offered }), {
    accepted: 2,
    denied: 1,
  });
  assert.equal(reviewTally({ status: "pending", decisions: offered }), null);
  assert.equal(reviewTally({ status: "approved" }), null);
  assert.equal(
    reviewTally({ status: "approved", decisions: [{ id: "a", label: "A" }] }),
    null,
  );

  // The answers the form posts, as the route takes them; anything else, nothing.
  const answers = [
    { id: "a", decision: "accepted" },
    { id: "b", decision: "denied" },
  ];
  assert.deepEqual(reviewAnswers(JSON.stringify(answers)), answers);
  for (const bad of [
    undefined,
    "not json",
    "[]",
    JSON.stringify([{ id: "a", decision: "approved" }]),
    JSON.stringify([...answers, { id: "a", decision: "denied" }]),
  ])
    assert.equal(reviewAnswers(bad), null, String(bad));

  // The steps: the step that waited says the count once the review is saved.
  const pipeline = [
    { id: "read", title: "Read" },
    { id: "review", title: "Review" },
    { id: "save", title: "Save" },
  ];
  const steps = [
    {
      stepId: "read",
      outcome: "ok",
      summary: "",
      occurredAt: "2026-10-28T10:00:00Z",
    },
    {
      stepId: "review",
      outcome: "held",
      summary: "",
      heldReason: "2 changes need your review.",
      occurredAt: "2026-10-28T10:01:00Z",
    },
  ];
  const clock = () => "10:01 AM";
  const rows = (status, review) =>
    trackerRows(steps, pipeline, undefined, { status }, clock, pipeline, {
      review,
    }).map((row) => row.sub);
  assert.deepEqual(rows("running", { accepted: 1, denied: 1 }), [
    "Done · 10:01 AM",
    "1 accepted · 1 denied",
    "Working…",
  ]);
  assert.deepEqual(
    rows("held", null)[1],
    "Waiting for approval: 2 changes need your review.",
  );
  assert.deepEqual(rows("running", null)[1], "Done · 10:01 AM");

  // A held run's review form is read again for, as the approval form is.
  assert.equal(
    rereadForApprovalForm(
      { status: "held" },
      [{ type: "questions", form: { kind: "review" } }],
      0,
    ),
    false,
  );

  // The run's page: the review, in the one decision component.
  const decision = code(read(DECISION));
  assert.match(
    decision,
    /if \(decisions\.length > 0\)\s*return \(\s*<ReviewDecisions/u,
  );
  const review = decision.slice(
    decision.indexOf("function ReviewDecisions"),
    decision.indexOf("function keepLeaving"),
  );
  assert.match(
    review,
    /variant=\{answer === "accepted" \? "secondary" : "danger"\}[\s\S]*?\{DENY\}/u,
  );
  assert.match(review, /aria-pressed=\{answer === "accepted"\}/u);
  assert.match(review, /disabled=\{!answered \|\| pending\}/u);
  assert.match(
    review,
    /data\.append\(\s*"decisions",\s*JSON\.stringify\(\s*decisions\.map\(\(change\) => \(\{\s*id: change\.id,\s*decision: answers\[change\.id\],/u,
  );
  assert.match(review, /role === "member" \? \(/u);
  assert.match(review, /if \(!result\.ok\) setRefused\(true\);/u);
  // Approvals' card: Review {n} changes, to the run, for one who may decide.
  assert.match(
    decision,
    /\{changes > 0 && canDecide \? \(\s*<Button\s+href=\{`\/account\/runs\/\$\{encodeURIComponent\(approval\.runId\)\}`\}[\s\S]*?\{reviewChanges\(changes\)\}/u,
  );
  // The action sends the review's answers, else the decision as before.
  const actions = code(read("app/account/flows/actions.ts"));
  assert.match(
    actions,
    /if \(formData\.has\("decisions"\)\) \{\s*const decisions = reviewAnswers\(formData\.get\("decisions"\)\);\s*return decisions \? \{ decisions \} : null;\s*\}/u,
  );
  assert.match(
    actions,
    /const body = decisionBody\(formData\);\s*if \(!body\) return \{ ok: false, error: "Unsupported decision" \};/u,
  );
  // The steps get the count from the job's newest approval.
  assert.match(
    code(read(LIVE)),
    /const review = reviewTally\(newestApproval\(run\.id, listed\)\);/u,
  );
  // An older build knows the review form: never the fallback.
  assert.match(
    code(read("components/blocks/renderers.tsx")),
    /const KNOWN_FORMS: readonly string\[\] = \[[^\]]*\.\.\.PENDING_FORM_KINDS,?\s*\];/u,
  );
});
