import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const COMPLETE_UI_PATH = resolve(
  import.meta.dirname,
  "../app/account/settings/CompleteExportSection.tsx",
);
const SPEC_PATH = resolve(
  import.meta.dirname,
  "..",
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
  "docs/openapi.yaml",
);
const generated = readFileSync(GENERATED_PATH, "utf8");
const facade = readFileSync(FACADE_PATH, "utf8");
const contract = readFileSync(CONTRACT_PATH, "utf8");
const ui = readFileSync(UI_PATH, "utf8");

test("workspace export uses the generated public root operation", () => {
  // The workspace segment is built, encoded, in one place (register F9).
  assert.match(facade, /workspacePath as scope/u);
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

test("the complete export is started once, followed, and its link asked for again at the download (backend §12.1 #39)", () => {
  const complete = readFileSync(COMPLETE_UI_PATH, "utf8");
  assert.match(
    facade,
    /platformServerJson<WorkspaceExportJobResponse>\(\s*`\$\{scope\(workspaceId\)\}\/exports`,\s*\{ method: "POST", idempotencyKey: newIdempotencyKey\("workspace-export"\) \},/u,
  );
  assert.match(
    facade,
    /`\$\{scope\(workspaceId\)\}\/exports\/\$\{encodeURIComponent\(exportId\)\}`/u,
  );
  assert.match(contract, /components\["schemas"\]\["WorkspaceExportJob"\]/u);
  // A link is signed for minutes, so the one used is read at the click — never
  // one kept from when the file became ready.
  assert.match(
    complete,
    /const download = \(\) => \{[\s\S]*?const result = await readCompleteExport\(workspaceId, job\.id\);[\s\S]*?window\.location\.assign\(result\.job\.file\.downloadUrl\)/u,
  );
  assert.doesNotMatch(
    complete,
    /(?<!result\.)job\.file\.downloadUrl|localStorage|sessionStorage/u,
  );
  // Offered to an owner or admin only, as the quick export is.
  assert.match(
    ui,
    /\{canExport \? \(\s*<CompleteExportSection workspaceId=\{workspaceId\} \/>/u,
  );
  if (existsSync(SPEC_PATH)) {
    const spec = readFileSync(SPEC_PATH, "utf8");
    const described =
      /failureReason:\s*\n\s*type: string\s*\n\s*description: >-([\s\S]*?)\n\s{8}\w/u.exec(
        spec,
      );
    assert.ok(described, "failureReason is missing from the specification");
    const named = new Set(
      [...described[1].matchAll(/`([a-z_]+)`/gu)].map((match) => match[1]),
    );
    const said =
      /const FAILURES: Record<string, string> = \{([\s\S]*?)\n\};/u.exec(
        complete,
      );
    assert.ok(said, "FAILURES not found");
    for (const [, reason] of said[1].matchAll(/^\s{2}(\w+):/gmu)) {
      assert.ok(
        named.has(reason),
        `${reason} is not a reason the platform names`,
      );
    }
  }
});
