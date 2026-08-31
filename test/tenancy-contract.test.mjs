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
  assert.match(tenancy, /import \{ newIdempotencyKey, platformServerJson \}/);
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
    "app/account/automations/actions.ts",
    "app/account/automations/page.tsx",
    "app/account/connections/actions.ts",
    "app/account/connections/page.tsx",
    "app/account/runs/page.tsx",
    "app/account/runs/[runId]/page.tsx",
    "app/account/settings/export-actions.ts",
    "app/account/approvals/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /resolveActiveWorkspaceId/);
    assert.doesNotMatch(source, /session\?\.workspaces|session\.workspaces/);
  }
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
