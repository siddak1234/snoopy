import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  exportServiceLabel,
  isPartialWorkspaceExport,
} from "../lib/export-contract.ts";
import { subscriptionEntitlementState } from "../lib/subscription-entitlements.ts";

const GENERATED_PATH = resolve(
  import.meta.dirname,
  "../lib/generated/platform-contracts/platform.d.ts",
);
const FACADE_PATH = resolve(import.meta.dirname, "../lib/exports.ts");
const CONTRACT_PATH = resolve(import.meta.dirname, "../lib/export-contract.ts");
const UI_PATH = resolve(
  import.meta.dirname,
  "../app/account/settings/WorkspaceExportSection.tsx",
);
const generated = readFileSync(GENERATED_PATH, "utf8");
const facade = readFileSync(FACADE_PATH, "utf8");
const contract = readFileSync(CONTRACT_PATH, "utf8");
const ui = readFileSync(UI_PATH, "utf8");

test("workspace export uses the generated public root operation", () => {
  assert.match(
    facade,
    /\/v1\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}/,
  );
  assert.match(facade, /\$\{scope\(workspaceId\)\}\/export/);
  assert.match(
    contract,
    /operations\["exportWorkspace"\]\["responses"\]\[200\]/,
  );
  assert.match(generated, /WorkspaceExportResponse:/);
  assert.match(generated, /WorkspaceExportServiceResult:/);
  for (const service of [
    "AccessWorkspaceExportSection",
    "EntitlementsWorkspaceExportSection",
    "ConnectionsWorkspaceExportSection",
    "CatalogWorkspaceExportSection",
    "RunsWorkspaceExportSection",
    "ArtifactsWorkspaceExportSection",
    "UnavailableWorkspaceExportSection",
  ]) {
    assert.match(generated, new RegExp(service));
  }
});

test("complete and bounded exports remain distinguishable in the client", () => {
  const complete = {
    complete: true,
    services: [{ service: "access", ok: true, data: { truncated: false } }],
  };
  const bounded = {
    complete: true,
    services: [{ service: "runs", ok: true, data: { truncated: true } }],
  };
  const unavailable = {
    complete: false,
    services: [{ service: "artifacts", ok: false, reason: "unreachable" }],
  };

  assert.equal(isPartialWorkspaceExport(complete), false);
  assert.equal(isPartialWorkspaceExport(bounded), true);
  assert.equal(isPartialWorkspaceExport(unavailable), true);
  assert.equal(exportServiceLabel("connections"), "Connections");
  assert.match(ui, /section\.ok \? "included" : section\.reason/);
  assert.match(ui, /section\.data\.truncated/);
});

test("the export UI does not invent pagination", () => {
  const exportBlock = generated.slice(
    generated.indexOf("WorkspaceExportResponse:"),
    generated.indexOf("ExportWorkspaceRecord:"),
  );
  assert.doesNotMatch(exportBlock, /cursor|nextCursor/iu);
  assert.doesNotMatch(ui, /cursor|nextCursor/iu);
});

test("only the two documented subscription 403 reasons become product states", () => {
  assert.equal(
    subscriptionEntitlementState(403, { reason: "over_plan_limit" }),
    "plan-limit",
  );
  assert.equal(
    subscriptionEntitlementState(403, {
      reason: "entitlements_not_configured",
    }),
    "entitlements-unavailable",
  );
  assert.equal(
    subscriptionEntitlementState(403, { reason: "provider_error" }),
    null,
  );
  assert.equal(
    subscriptionEntitlementState(401, { reason: "over_plan_limit" }),
    null,
  );
});
