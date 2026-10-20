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
    /<TrackerItem key=\{row\.key\} row=\{row\}>\s*(?:\{\s*\}\s*)?\{row\.state === "held" &&\s*decided === "pending" &&\s*decision\?\.approval\.status === "pending" \? \(\s*decision\.canDecide \? \(\s*<ApprovalDecision/u,
  );
  assert.match(
    live,
    /onDecision=\{\(_, state\) => \{\s*if \(state === "saved"\) router\.refresh\(\);\s*\}\}/u,
  );
  assert.match(
    live,
    /Only \{decision\.approval\.eligibleRoles\.join\(" or "\)\} can\s+decide this\./u,
  );
  const page = code(read("app/account/runs/[runId]/page.tsx"));
  assert.match(
    page,
    /const waiting = newestApproval\(detail\.run\.id, jobApprovals\);/u,
  );
  assert.match(
    page,
    /canDecide: Boolean\(role && waiting\.eligibleRoles\.includes\(role\)\)/u,
  );
  assert.match(page, /held \? roleInWorkspace\(workspaceId\) : undefined/u);
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
