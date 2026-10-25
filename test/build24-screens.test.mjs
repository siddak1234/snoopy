import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

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
  assert.equal(decision.match(/disabled=\{pending\}/gu)?.length, 2);
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

test("a held step offers the decision: RunLive's held row renders ApprovalDecision while the job's approval waits and this person may decide, else who can; a saved decision draws the page again (P6)", () => {
  const live = code(read(LIVE));
  assert.match(
    live,
    /import \{ ApprovalDecision \} from "@\/app\/account\/approvals\/ApprovalDecision";/u,
  );
  assert.match(
    live,
    /<TrackerItem key=\{row\.key\} row=\{row\}>\s*(?:\{\s*\}\s*)?\{row\.state === "held" &&\s*decided === "pending" &&\s*decision\?\.approval\.status === "pending" \? \(\s*<ApprovalDecision\s+approvalId=\{decision\.approval\.id\}\s+canDecide=\{decision\.canDecide\}\s+eligibleRoles=\{decision\.approval\.eligibleRoles\}/u,
  );
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
  // The job's newest approval and this person's role, worked out where the
  // re-reads land, in the browser (Build 25's audit; waitingDecision's own
  // test holds the rule), and the role read with every run: one that turns
  // held while its page is open is offered the pair from there — on its
  // details page since build 28 (item 9), read as the run's page reads it.
  assert.match(
    live,
    /const decision = waitingDecision\(run\.id, listed, role\);/u,
  );
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

test("each document is a closed row that opens in place: <details> never drawn open, its <summary> the heading, {vendor} · {total} and the chip; the body starts with Document type and Format, given the job's files (P10)", () => {
  const live = code(read(LIVE));
  const card = live.slice(live.indexOf("function DocumentCard"));
  assert.match(
    card,
    /<details\s+data-testid=\{`document-\$\{card\.index\}`\}/u,
  );
  assert.doesNotMatch(card, /<details[^>]*\sopen\b/u);
  assert.match(
    card,
    /<summary[\s\S]*?\{card\.heading\}[\s\S]*?\{card\.glance\}[\s\S]*?\{card\.chip\}[\s\S]*?<\/summary>/u,
  );
  assert.match(
    card,
    /<\/summary>\s*<div[^>]*>\s*<dl[^>]*>\{pairs\(card\.facts, "fact"\)\}<\/dl>/u,
  );
  // The job's files give each card its Format; the flow's words head it (backend BUILD-PLAN 27.5.1).
  assert.match(
    live,
    /toDocumentCards\([\s\S]*?detail\.files,\s*flow\?\.documentWords,\s*\)/u,
  );
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
  assert.match(page, /<PackageFrame runId=\{job\} \/>/u);
  assert.match(page, /<EmptyRow text=\{PACKAGE_UNAVAILABLE\} \/>/u);
  assert.match(
    page,
    /back=\{<BackLink href=\{`\/account\/runs\/\$\{encodeURIComponent\(job\)\}`\} \/>\}/u,
  );
  const live = code(read(LIVE));
  assert.match(
    live,
    /<iframe\s+title="Run package"\s+src=\{packageFileHref\(runId, zone \|\| null\)\}/u,
  );
  // The frame waits for the browser's zone: the server draws none.
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
