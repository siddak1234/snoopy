import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const SPEC_PATH = resolve(
  import.meta.dirname,
  "../../snoopy-backend/docs/openapi/connections.yaml",
);
const GENERATED_PATH = resolve(
  import.meta.dirname,
  "../lib/generated/platform-contracts/connections.d.ts",
);
const FACADE_PATH = resolve(import.meta.dirname, "../lib/connections.ts");
const ACTIONS_PATH = resolve(
  import.meta.dirname,
  "../app/account/connections/actions.ts",
);
const PANEL_PATH = resolve(
  import.meta.dirname,
  "../app/account/connections/ConnectionsPanel.tsx",
);
const PILL_PATH = resolve(
  import.meta.dirname,
  "../components/dashboard/StatusPill.tsx",
);

const available = existsSync(SPEC_PATH);
const spec = available ? readFileSync(SPEC_PATH, "utf8") : "";
const generated = readFileSync(GENERATED_PATH, "utf8");
const facade = readFileSync(FACADE_PATH, "utf8");
const actions = readFileSync(ACTIONS_PATH, "utf8");
const panel = readFileSync(PANEL_PATH, "utf8");

test("generated connection models and operations are used by the platform facade", () => {
  for (const type of ["ConnectionProvider", "ConnectionStatus", "Connection"]) {
    assert.match(
      facade,
      new RegExp(
        `export type ${type} =\\s*components\\["schemas"\\]\\["${type}"\\]`,
      ),
      `${type} must alias the generated connection schema`,
    );
  }
  for (const [type, operation] of [
    ["ConnectionAuthorizationResponse", "beginConnectionAuthorization"],
    ["ConnectProviderWithKeyRequest", "connectProviderWithKey"],
    ["ConnectProviderWithKeyResponse", "connectProviderWithKey"],
    ["DisconnectConnectionResponse", "disconnectConnection"],
  ]) {
    assert.match(
      facade,
      new RegExp(`export type ${type} =\\s*operations\\["${operation}"\\]`),
      `${type} must alias the generated ${operation} operation`,
    );
  }
});

test("connection actions consume generated operation response types", () => {
  for (const type of [
    "ConnectionAuthorizationResponse",
    "ConnectProviderWithKeyResponse",
    "DisconnectConnectionResponse",
  ]) {
    assert.match(
      actions,
      new RegExp(`platformServerJson<${type}>`),
      `connection action must use ${type}`,
    );
  }
  assert.match(actions, /const body: ConnectProviderWithKeyRequest =/);
  assert.doesNotMatch(
    actions,
    /platformServerJson<\{\s*(?:authorizationUrl|connection):/,
    "connection actions must not recreate generated response shapes",
  );
});

test(
  "the connection UI renders only contract-declared auth modes and credential fields",
  {
    skip: available
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    assert.match(spec, /enum:\s*\[oauth2, api-key\]/);
    assert.match(spec, /credentialFields:/);
    assert.match(generated, /authType:\s*"oauth2" \| "api-key"/);
    assert.match(generated, /credentialFields\?:/);
  },
);

test("pasted-key retries preserve one client intent and send its key as a header", () => {
  assert.match(
    panel,
    /setConnectionIntentKey\(`connection-\$\{crypto\.randomUUID\(\)\}`\)/,
  );
  assert.match(panel, /name="idempotencyKey"/);
  assert.match(panel, /retryWithSameIntent/);
  assert.match(actions, /idempotencyKey,\s*\n/);
  assert.match(actions, /error\.status === 409/);
  assert.match(panel, /Retry verification/);
  assert.doesNotMatch(
    actions,
    /credentials:\s*\{[^}]*idempotencyKey/su,
    "the idempotency key must never be placed in the credential JSON",
  );
});

test("provider help is rendered from declared credential fields without scope claims", () => {
  assert.match(panel, /hint=\{field\.help\}/);
  assert.doesNotMatch(
    panel,
    /Mail-Send-only|live-verified|scopes are verified/iu,
  );
});

test(
  "every connection status has a dashboard tone",
  {
    skip: available
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    const statuses =
      /enum:\s*\[(authorizing, connected, reauthorization-required, disconnected)\]/.exec(
        spec,
      );
    assert.ok(statuses, "ConnectionStatus is missing from the public contract");
    const pill = readFileSync(PILL_PATH, "utf8");
    for (const status of statuses[1].split(",").map((entry) => entry.trim())) {
      assert.match(
        pill,
        new RegExp(
          `"?${status}"?:\\s*"(?:success|warning|error|info|neutral)"`,
        ),
        `${status} has no StatusPill tone`,
      );
    }
  },
);
