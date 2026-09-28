import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const tenancy = readFileSync("lib/tenancy.ts", "utf8");
const generated = readFileSync(
  "lib/generated/platform-contracts/platform.d.ts",
  "utf8",
);
const actions = readFileSync("app/account/projects/actions.ts", "utf8");

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
    "app/account/automations/page.tsx",
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
  // F28), which reads the session, never a workspace the form names.
  for (const file of [
    "app/account/automations/actions.ts",
    "app/account/billing/actions.ts",
    "app/account/connections/actions.ts",
    "app/account/settings/export-actions.ts",
    "app/account/teams/actions.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /requireActiveWorkspaceId\(\)|activeWorkspaceIfShown\(/u,
      file,
    );
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
    "app/account/automations/actions.ts",
    "app/account/projects/actions.ts",
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

test("a team project is created in the organization the dialog showed, while it is still the active one (register F57)", () => {
  const actions = readFileSync("app/account/projects/actions.ts", "utf8");
  assert.match(
    actions,
    /if \(scope === "team"\) \{[\s\S]*?const workspaceId = await activeWorkspaceIfShown\(\s*String\(formData\.get\("workspaceId"\) \?\? ""\),\s*\);\s*if \(!workspaceId\) return \{ ok: false, error: WORKSPACE_CHANGED \};[\s\S]*?candidate\.id === workspaceId && candidate\.type === "organization"/u,
    "the active organization the dialog named — never the first organization listed",
  );
  const page = readFileSync("app/account/projects/page.tsx", "utf8");
  assert.match(
    page,
    /active\?\.type === "organization"/u,
    "the team option follows the active workspace",
  );
  assert.doesNotMatch(
    page,
    /accessible\.some\(/u,
    "not whether one of an organization's projects is visible — a new organization has none",
  );
});

test("a team's writes act on the workspace the page showed; a grant on the project's own workspace", () => {
  const actions = readFileSync("app/account/teams/actions.ts", "utf8");
  for (const operation of ["createTeam", "upsertTeamMembership"]) {
    assert.match(
      actions,
      new RegExp(
        `const workspaceId = await activeWorkspaceIfShown\\(\\s*String\\(formData\\.get\\("workspaceId"\\) \\?\\? ""\\),\\s*\\);\\s*if \\(!workspaceId\\) return \\{ ok: false, error: WORKSPACE_CHANGED \\};\\s*await ${operation}\\(workspaceId,`,
        "u",
      ),
      `${operation} is refused once another tab changed the workspace`,
    );
  }
  assert.match(
    actions,
    /const context = await findAccessibleProject\(projectId\);[\s\S]*?await grantProjectTeam\(context\.workspace\.id, projectId,/u,
    "a grant goes to the workspace that holds the project, resolved on the server",
  );
  for (const [page, form] of [
    [
      "app/account/teams/page.tsx",
      "<CreateTeamForm workspaceId={workspace.id} />",
    ],
    ["app/account/teams/[teamId]/page.tsx", "workspaceId={workspace.id}"],
  ]) {
    assert.ok(
      readFileSync(page, "utf8").includes(form),
      `${page} names its workspace`,
    );
  }
});

test("taking someone off a team and a team's access away are the published DELETEs, keyed and encoded, each confirmed first (backend §12.1 #174)", () => {
  assert.match(
    tenancy,
    /`\$\{teamPath\(workspaceId, teamId\)\}\/memberships\/\$\{encodeURIComponent\(userId\)\}`,\s*\{\s*method: "DELETE",\s*idempotencyKey: newIdempotencyKey\("team-member-remove"\),/u,
  );
  assert.match(
    tenancy,
    /`\$\{projectPath\(workspaceId, projectId\)\}\/team-grants\/\$\{encodeURIComponent\(teamId\)\}`,\s*\{\s*method: "DELETE",\s*idempotencyKey: newIdempotencyKey\("project-team-revoke"\),/u,
  );
  const actions = readFileSync("app/account/teams/actions.ts", "utf8");
  // A removal acts on the workspace the team's page showed (register F28); a
  // revocation on the project's own workspace, resolved on the server.
  assert.match(
    actions,
    /const workspaceId = await activeWorkspaceIfShown\(shownWorkspaceId\);\s*if \(!workspaceId\) return \{ ok: false, error: WORKSPACE_CHANGED \};\s*await removeTeamMembership\(workspaceId, teamId, userId\);/u,
  );
  assert.match(
    actions,
    /const context = await findAccessibleProject\(projectId\);[\s\S]*?await revokeProjectTeam\(context\.workspace\.id, projectId, teamId\);/u,
  );
  const team = readFileSync("app/account/teams/[teamId]/page.tsx", "utf8");
  assert.match(
    team,
    /action=\{removeTeamMemberAction\.bind\(\s*null,\s*workspace\.id,\s*team\.id,\s*membership\.userId,\s*\)\}/u,
  );
  assert.doesNotMatch(team, /not available yet/u);
  // Offered to the project's owner or admin only, as the grant is.
  const project = readFileSync("app/account/projects/[id]/page.tsx", "utf8");
  assert.match(
    project,
    /\{canManage \? \(\s*<ConfirmRemoveButton[\s\S]*?action=\{revokeProjectTeamAction\.bind\(\s*null,\s*project\.id,\s*grant\.teamId,\s*\)\}/u,
  );
  const confirm = readFileSync(
    "components/dashboard/ConfirmRemoveButton.tsx",
    "utf8",
  );
  assert.match(confirm, /<Modal[\s\S]*?ariaLabelledBy=/u);
  assert.match(
    confirm,
    /const result = await action\(\);\s*if \(!result\.ok\) \{\s*setError\(result\.error\);\s*return;\s*\}/u,
  );
});
