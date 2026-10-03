import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { joinLinkLine } from "../lib/join-link.ts";

const tenancy = readFileSync("lib/tenancy.ts", "utf8");
const generated = readFileSync(
  "lib/generated/platform-contracts/platform.d.ts",
  "utf8",
);
// A team is a project in the platform's contract (BUILD-PLAN 24.11.11).
const actions = readFileSync("app/account/teams/actions.ts", "utf8");

test("tenancy facade aliases generated public schemas", () => {
  assert.match(
    tenancy,
    /from "@\/lib\/generated\/platform-contracts\/platform"/,
  );
  for (const schema of [
    "WorkspaceSummary",
    "WorkspaceMember",
    "ProjectSummary",
    "ProjectMembership",
    "OrganizationDomain",
    "OrganizationJoinRequest",
    "ProjectDirectoryEntry",
    "ProjectAccessRequest",
  ]) {
    assert.match(generated, new RegExp(`\\b${schema}:`));
  }
});

test("tenancy mutations use unique idempotency keys", () => {
  assert.match(
    tenancy,
    /import \{[^}]*\bnewIdempotencyKey\b[^}]*\bplatformServerJson\b[^}]*\} from "@\/lib\/platform-server"/su,
  );
  for (const prefix of [
    "workspace-create",
    "workspace-update",
    "workspace-member",
    "workspace-activate",
    "project-create",
    "project-update",
    "project-member",
    "organization-join",
    "domain-claim",
    "domain-update",
    "domain-revoke",
    "domain-verify",
    "join-request-decision",
    "join-request-cancel",
    "project-access-request",
    "project-access-decision",
    "project-access-cancel",
  ]) {
    assert.match(tenancy, new RegExp(`newIdempotencyKey\\("${prefix}"\\)`));
  }
});

test("cursor handling remains opaque and project actions do not revive local policy", () => {
  assert.match(tenancy, /encodeURIComponent\(cursor\)/);
  assert.match(tenancy, /nextCursor: response\.nextCursor/);
  assert.doesNotMatch(actions, /prisma|canUserPerform|getProjectRole/iu);
  assert.match(actions, /createProject\(/);
  assert.match(actions, /updateProject\(/);
  assert.match(actions, /upsertProjectMembership\(/);
  assert.match(actions, /removeProjectMembership\(/);
});

test("bounded session previews are never used as workspace authority", () => {
  assert.match(tenancy, /resolveActiveWorkspaceId/);
  assert.match(tenancy, /activeWorkspaceId/);
  assert.doesNotMatch(tenancy, /\[0\]\?\.id/);
  for (const file of [
    "app/account/flows/page.tsx",
    "app/account/connections/page.tsx",
    "app/account/runs/page.tsx",
    "app/account/runs/[runId]/page.tsx",
    "app/account/approvals/page.tsx",
    "app/account/billing/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /resolveActiveWorkspaceId/);
    assert.doesNotMatch(source, /session\?\.workspaces|session\.workspaces/);
  }
  // Every action module resolves its workspace through ONE helper (register
  // F28), which reads the session and only compares the id the page sent.
  for (const file of [
    "app/account/flows/actions.ts",
    "app/account/flows/upload-actions.ts",
    "app/account/flows/webhook-actions.ts",
    "app/account/billing/actions.ts",
    "app/account/connections/actions.ts",
    "app/account/settings/export-actions.ts",
    "app/account/teams/actions.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /activeWorkspaceIfShown\(/u, file);
    assert.doesNotMatch(
      source,
      /async function activeWorkspaceId|resolveActiveWorkspaceId|session\?\.workspaces|session\.workspaces/u,
      `${file} keeps no private copy of the workspace resolution`,
    );
  }
  assert.match(
    tenancy,
    /export async function requireActiveWorkspaceId\(\): Promise<string> \{\s*const workspaceId = await resolveActiveWorkspaceId\(await getAppSession\(\)\);/u,
  );
});

test("a page offers owner-or-admin controls by the platform's own rule (register F8)", () => {
  // Connections, the workspace export and billing are owner-or-admin at the
  // Edge; a page reads the role from the workspace list and offers the controls
  // only to those it will not refuse.
  assert.match(
    tenancy,
    /export function administers\(role: WorkspaceRole \| undefined\): boolean \{\s*return role === "owner" \|\| role === "admin";\s*\}/u,
  );
  assert.match(
    tenancy,
    /return \(await listWorkspaces\(\)\)\.find\(\(entry\) => entry\.id === workspaceId\)\s*\?\.role;/u,
  );
  const connections = readFileSync("app/account/connections/page.tsx", "utf8");
  assert.match(connections, /canManage=\{administers\(role\)\}/u);
  const panel = readFileSync(
    "app/account/connections/ConnectionsPanel.tsx",
    "utf8",
  );
  // Every control that changes the connection sits behind the gate.
  assert.equal(
    (panel.match(/\{canManage \? \(/gu) ?? []).length,
    2,
    "Disconnect and Connect/Reconnect are each behind canManage",
  );
  const settings = readFileSync("app/account/settings/page.tsx", "utf8");
  // With the workspace the page showed, which every export is held to
  // (register F28).
  assert.match(
    settings,
    /<WorkspaceExportSection\s+canExport=\{canExport\}\s+workspaceId=\{workspaceId \?\? ""\}\s+\/>/u,
  );
  // With a session only, and no export without one (register F62).
  assert.match(
    settings,
    /const canExport = session\s*\?\s*administers\([^;]*?\)\s*:\s*false;/u,
  );
  const exportSection = readFileSync(
    "app/account/settings/WorkspaceExportSection.tsx",
    "utf8",
  );
  assert.match(exportSection, /\{canExport \? \(/u);
});

test("the workspace list is read once per request (register F27)", () => {
  assert.match(
    tenancy,
    /const listWorkspaceCollection = cache\(/u,
    "memoised like getAppSession: the layout and the page share one read",
  );
});

test("organization lifecycle UI uses only documented domain and join operations", () => {
  const organizationActions = readFileSync(
    "app/account/organization/actions.ts",
    "utf8",
  );
  const domainUi = readFileSync(
    "components/dashboard/OrgDomainSection.tsx",
    "utf8",
  );
  const joinUi = readFileSync(
    "components/dashboard/OrgJoinRequestList.tsx",
    "utf8",
  );
  for (const operation of [
    "claimOrganizationDomain",
    "updateOrganizationDomain",
    "verifyOrganizationDomain",
    "revokeOrganizationDomain",
    "decideOrganizationJoinRequest",
  ]) {
    assert.match(organizationActions, new RegExp(`\\b${operation}\\b`));
  }
  assert.match(domainUi, /verificationRecordName/);
  assert.match(joinUi, /"approve" \| "reject"/);
});

test("an action on a page's workspace refuses once another tab changed it — billing and Cancel share one guard", () => {
  assert.match(
    tenancy,
    /export async function activeWorkspaceIfShown\(\s*shownWorkspaceId: string,\s*\): Promise<string \| null> \{\s*const workspaceId = await requireActiveWorkspaceId\(\);\s*return workspaceId === shownWorkspaceId \? workspaceId : null;\s*\}/u,
    "resolved by the session, compared, never taken from the browser",
  );
  for (const file of [
    "app/account/billing/actions.ts",
    "app/account/flows/actions.ts",
    "app/account/teams/actions.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /const WORKSPACE_CHANGED =/u,
      `${file} keeps no private copy of the guard`,
    );
    assert.match(source, /error: WORKSPACE_CHANGED/u, file);
  }
});

test("a team is its kind, created in the workspace the page showed while it is still the active one — no picker, no name, no description (register F57, the owner's build 9)", () => {
  const create =
    /export async function createProjectAction\([\s\S]*?\n\}/u.exec(actions);
  assert.ok(create, "createProjectAction not found; this test is blind");
  // Compared before anything is created, and created where the server
  // resolved — never the first organization listed, never another tab's.
  assert.match(
    create[0],
    /const workspaceId = await activeWorkspaceIfShown\(\s*String\(formData\.get\("workspaceId"\) \?\? ""\),\s*\);\s*if \(!workspaceId\) return \{ ok: false, error: WORKSPACE_CHANGED \};\s*const project = await createProject\(workspaceId, \{ name: type, type \}\);/u,
  );
  assert.doesNotMatch(create[0], /description|workspaceTheyAreIn/u);
  // Other's own words are the team's name as well: the platform's 2 to 60.
  assert.match(create[0], /if \(type\.length < 2 \|\| type\.length > 60\) \{/u);
  const dialog = readFileSync(
    "components/dashboard/CreateTeamDialog.tsx",
    "utf8",
  );
  assert.match(dialog, /data\.set\("workspaceId", workspace\.id\);/u);
  assert.doesNotMatch(
    dialog,
    /name="(?:workspaceId|name|description)"/u,
    "the workspace is the page's, and a team has no name or description field",
  );
  // The active workspace — a personal one included — for its owners and
  // admins only: a plain member of an organization is offered no Create, as
  // the platform would refuse it (register F8).
  const page = readFileSync("app/account/teams/page.tsx", "utf8");
  assert.match(
    page,
    /const active = workspaces\.find\(\s*\(workspace\) => workspace\.id === activeWorkspaceId,\s*\);\s*const create =\s*active && administers\(active\.role\) \? \(\s*<CreateTeamButton\s+workspace=\{\{ id: active\.id, name: active\.name, type: active\.type \}\}/u,
  );
  assert.doesNotMatch(page, /places=|initialWorkspaceId=/u);
});

test("Create's refusals are the app's sentences — a kind the workspace already has, and a plain member of an organization (build 10)", () => {
  assert.match(
    actions,
    /if \(error\.status === 409 && error\.details\?\.reason === "team_kind_taken"\)\s*return `This workspace already has a team for \$\{kind\}\.`;/u,
  );
  assert.match(
    actions,
    /if \(error\.status === 403\)\s*return "Only an owner or admin can create a team here\.";/u,
  );
  assert.match(
    actions,
    /return \{ ok: false, error: createRefusal\(error, type\) \};/u,
  );
});

test("a team's changes act on the workspace that holds it, resolved on the server; asking onto one names the organization whose directory listed it", () => {
  for (const operation of [
    "updateProject",
    "upsertProjectMembership",
    "removeProjectMembership",
    "decideProjectAccess",
  ]) {
    assert.match(
      actions,
      new RegExp(
        `const \\{ workspace \\} = await projectContext\\(projectId\\);[\\s\\S]*?await ${operation}\\(workspace\\.id, projectId,`,
        "u",
      ),
      operation,
    );
  }
  for (const action of [
    "requestTeamAccessAction",
    "withdrawTeamAccessAction",
  ]) {
    assert.match(
      actions,
      new RegExp(
        `export async function ${action}\\([\\s\\S]*?if \\(!\\(await workspaceTheyAreIn\\(workspaceId\\)\\)\\) \\{`,
        "u",
      ),
      action,
    );
  }
});

test("asking to join a team is the published operations, keyed, and absent before the promotion rather than failing (backend 24.11.2, 24.11.4)", () => {
  assert.match(
    tenancy,
    /withCursor\(`\$\{workspacePath\(workspaceId\)\}\/project-directory`, cursor\)/u,
  );
  assert.match(
    tenancy,
    /`\$\{projectPath\(workspaceId, projectId\)\}\/access-requests`, \{\s*method: "POST",\s*idempotencyKey: newIdempotencyKey\("project-access-request"\),/u,
  );
  assert.match(
    tenancy,
    /method: "PATCH",\s*body: JSON\.stringify\(\{ decision \}\),\s*idempotencyKey: newIdempotencyKey\("project-access-decision"\),/u,
  );
  assert.match(
    tenancy,
    /method: "DELETE",\s*idempotencyKey: newIdempotencyKey\("project-access-cancel"\),/u,
  );
  // A platform from before the SEVENTEENTH promotion answers 404 for both: the
  // asking parts are left out, never the page. The directory's tolerant read
  // is one helper since build 11 (F84), used by Teams and by Flows' no-team line.
  const tolerates404 =
    /if \(error instanceof PlatformServerError && error\.status === 404\) return \[\];\s*throw error;/u;
  assert.match(
    tenancy,
    new RegExp(
      `export async function teamDirectoryIfThere\\([\\s\\S]*?${tolerates404.source}`,
      "u",
    ),
  );
  for (const page of [
    "app/account/teams/page.tsx",
    "app/account/flows/page.tsx",
  ]) {
    assert.match(readFileSync(page, "utf8"), /teamDirectoryIfThere\(/u, page);
  }
  assert.match(
    readFileSync("app/account/teams/[id]/page.tsx", "utf8"),
    tolerates404,
    "app/account/teams/[id]/page.tsx",
  );
  // The requests are drawn for those who decide, never for a plain member.
  assert.match(
    readFileSync("app/account/teams/[id]/page.tsx", "utf8"),
    /\{organization && canManage \? \([\s\S]*?<TeamAccessRequests projectId=\{project\.id\} requests=\{requests\} \/>/u,
  );
  // A request is withdrawn only after a confirmation.
  assert.match(
    readFileSync("components/dashboard/AskToJoinList.tsx", "utf8"),
    /<ConfirmRemoveButton\s+label="Withdraw"[\s\S]*?action=\{withdrawTeamAccessAction\.bind\(/u,
  );
});

test("the old Teams pages and the team grants are gone, and their old addresses land on the new ones (BUILD-PLAN 24.11.11)", () => {
  for (const gone of [
    "app/account/projects",
    "app/account/automations",
    "app/account/teams/[teamId]",
    "app/account/teams/CreateTeamForm.tsx",
    "components/dashboard/CreateProjectDialog.tsx",
  ])
    assert.ok(!existsSync(gone), `${gone} is gone`);
  assert.doesNotMatch(tenancy, /team-grants|teamPath\(|\/teams`/u);
  const config = readFileSync("next.config.ts", "utf8");
  for (const [from, to] of [
    ["/account/automations", "/account/flows"],
    ["/account/projects", "/account/teams"],
    ["/account/projects/:id", "/account/teams/:id"],
  ])
    assert.match(
      config,
      new RegExp(
        `source: "${from}",\\s*destination: "${to}",\\s*permanent: true`,
        "u",
      ),
      from,
    );
});

/** Every server-action module in the app, found by its directive. */
function serverActionFiles(directory = "app") {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...serverActionFiles(path));
    else if (
      /\.tsx?$/u.test(entry.name) &&
      /^"use server";/u.test(readFileSync(path, "utf8"))
    ) {
      found.push(path);
    }
  }
  return found;
}

test("no server action acts on the workspace active NOW rather than the one its page showed (register F28, F70)", () => {
  const files = serverActionFiles();
  assert.ok(
    files.includes("app/account/flows/actions.ts") &&
      files.includes("app/account/connections/actions.ts"),
    "the walk found no action modules; it is now blind",
  );
  for (const file of files) {
    // `requireActiveWorkspaceId()` is the active workspace whatever the page
    // showed: after a switch in another tab, Add or Connect through it writes
    // into a workspace the person was not looking at.
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /requireActiveWorkspaceId\(/u,
      `${file} reads the active workspace unguarded; compare it with the page's (activeWorkspaceIfShown)`,
    );
  }
  // Each form sends the workspace its page rendered, under one name.
  for (const [file, sends] of [
    [
      "app/account/flows/AutomationActions.tsx",
      /data\.set\("workspaceId", workspaceId\)/u,
    ],
    [
      "app/account/flows/AddAutomation.tsx",
      /data\.append\("workspaceId", workspaceId\)/u,
    ],
    [
      "app/account/flows/MoveVersionButton.tsx",
      /data\.append\("workspaceId", workspaceId\)/u,
    ],
    [
      "app/account/approvals/ApprovalDecision.tsx",
      /data\.append\("workspaceId", workspaceId\)/u,
    ],
    [
      "app/account/connections/ConnectionsPanel.tsx",
      /data\.set\("workspaceId", workspaceId\)/u,
    ],
    [
      "components/dashboard/CreateTeamDialog.tsx",
      /data\.set\("workspaceId", workspace\.id\)/u,
    ],
  ]) {
    assert.match(readFileSync(file, "utf8"), sends, file);
  }
});

// The owner's build 9 (decision 5): the line under Copy join link says what the
// link does, by the joining policy of the domain people can find it through —
// words the app shares (snoopy-mobile `joinLinkLine`).
test("the join link's line follows the verified domain's joining policy", () => {
  const verified = {
    domain: "acme.co",
    status: "verified",
    joinPolicy: "approval",
    discoveryEnabled: true,
  };
  assert.equal(
    joinLinkLine([verified]),
    "People at acme.co can ask to join. You approve them here.",
  );
  assert.equal(
    joinLinkLine([{ ...verified, joinPolicy: "automatic" }]),
    "People at acme.co join as soon as they open it.",
  );
  assert.equal(
    joinLinkLine([{ ...verified, joinPolicy: "invite_only" }]),
    "Joining at acme.co is invite only, so the link lets no one in.",
  );
  // Verified but not shown for matching emails: no one at it can find it.
  assert.equal(
    joinLinkLine([{ ...verified, discoveryEnabled: false }]),
    'People at acme.co cannot find it until "Show for matching verified email domains" is on.',
  );
  // A domain people can find wins over one they cannot, whatever the order.
  assert.equal(
    joinLinkLine([
      { ...verified, domain: "old.acme.co", discoveryEnabled: false },
      { ...verified, joinPolicy: "automatic" },
    ]),
    "People at acme.co join as soon as they open it.",
  );
  // Claimed, not verified — or none at all.
  for (const domains of [[{ ...verified, status: "pending" }], []]) {
    assert.equal(
      joinLinkLine(domains),
      "Verify your email domain first — only people at it can ask to join.",
    );
  }
});
