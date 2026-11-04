import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { after, test } from "node:test";
import { connectionLine } from "../lib/connection-rows.ts";
import { outsideOnError } from "../lib/domain-only.ts";
import {
  SMART_BACKEND_REFUSALS,
  opensKeyForm,
  smartBackendRefusal,
  vendorField,
} from "../lib/smart-backend.ts";
import { visibleWords } from "./blocks-harness.mjs";
import {
  cleanupLoaded,
  code,
  draw,
  load,
  read,
  root,
  tree,
} from "./round21-stage2-harness.mjs";

/**
 * Round 21, Stage 2 on the website, D1 and S1 (the client half of backend PR
 * #266, 50a24f7; the same words as the app's): Connect your EHR, and S1-8
 * and S1-11 as the platform sends them now. C3 is
 * `round21-stage2-c3.test.mjs`; D1's e2e half is `e2e/ehr-connect.spec.ts`.
 */

const KEY_FIELDS = "app/account/connections/KeyFields.tsx";

after(cleanupLoaded);

const EHR = {
  providerId: "ehr-fhir",
  displayName: "EHR",
  description:
    "Reads visit notes from your EHR. It never changes your records.",
  icon: "FirstAid",
  scopes: [],
  authType: "smart-backend",
  credentialFields: [
    {
      name: "fhirBaseUrl",
      label: "FHIR address",
      secret: false,
      help: "Your EHR team gives you this address.",
    },
  ],
  vendors: [
    { id: "epic-test", label: "Epic (test system)" },
    { id: "epic", label: "Epic" },
  ],
};

test("D1: the EHR's Connect opens the key form, as a pasted key's does; OAuth and a public service's do not", () => {
  assert.equal(opensKeyForm("api-key"), true);
  assert.equal(opensKeyForm("smart-backend"), true);
  for (const authType of ["oauth2", "none", undefined])
    assert.equal(opensKeyForm(authType), false);
  const panel = code("app/account/connections/ConnectionsPanel.tsx");
  assert.match(panel, /if \(opensKeyForm\(provider\.authType\)\) \{/u);
  assert.match(panel, /<KeyFields provider=\{selectedProvider\} \/>/u);
});

test("D1: a vendor picker only for two or more vendors; one is sent unseen; none, or another kind, has no vendor", () => {
  assert.deepEqual(vendorField(EHR), { kind: "picker", vendors: EHR.vendors });
  assert.deepEqual(vendorField({ ...EHR, vendors: EHR.vendors.slice(0, 1) }), {
    kind: "fixed",
    id: "epic-test",
  });
  assert.equal(vendorField({ ...EHR, vendors: [] }), null);
  assert.equal(
    vendorField({ authType: "api-key", vendors: EHR.vendors }),
    null,
  );
});

test("D1: the key form draws the vendors as one choice named for the provider, then the FHIR address with its help; one vendor, a hidden value and no choice; a pasted key's form, no vendor", async () => {
  const { KeyFields } = await load(KEY_FIELDS);
  const two = draw(KeyFields, { provider: EHR });
  assert.deepEqual(visibleWords(two), [
    "Epic (test system)",
    "Epic",
    "FHIR address",
    "Your EHR team gives you this address.",
  ]);
  const nodes = tree(two);
  const group = nodes.find((node) => node.attrs.role === "radiogroup");
  assert.equal(group.attrs["aria-label"], "EHR");
  const radios = nodes.filter((node) => node.attrs.type === "radio");
  assert.deepEqual(
    radios.map((node) => [node.attrs.name, node.attrs.value]),
    [
      ["credential:vendor", "epic-test"],
      ["credential:vendor", "epic"],
    ],
  );
  assert.ok(radios.every((node) => "required" in node.attrs));
  const address = nodes.find(
    (node) => node.attrs.name === "credential:fhirBaseUrl",
  );
  assert.equal(address.attrs.type, "text");

  const one = tree(
    draw(KeyFields, { provider: { ...EHR, vendors: EHR.vendors.slice(0, 1) } }),
  );
  assert.equal(one.filter((node) => node.attrs.type === "radio").length, 0);
  const hidden = one.find((node) => node.attrs.name === "credential:vendor");
  assert.deepEqual(
    [hidden.attrs.type, hidden.attrs.value],
    ["hidden", "epic-test"],
  );

  const key = tree(
    draw(KeyFields, {
      provider: {
        ...EHR,
        authType: "api-key",
        vendors: undefined,
        credentialFields: [
          {
            name: "apiKey",
            label: "API key",
            secret: true,
            help: "Fixture value.",
          },
        ],
      },
    }),
  );
  assert.equal(
    key.filter((node) => node.attrs.name === "credential:vendor").length,
    0,
  );
  assert.equal(
    key.find((node) => node.attrs.name === "credential:apiKey").attrs.type,
    "password",
  );
});

test("D1: an address the platform will not use is said by its reason, in the spec's words; any other refusal keeps the platform's", () => {
  assert.deepEqual(SMART_BACKEND_REFUSALS, {
    fhir_address_refused: "Use the https address your EHR team gave you.",
    fhir_not_answering: "That address didn't answer as a FHIR server.",
    ehr_not_activated:
      "Your EHR hasn't turned on Autom8x yet. Ask your EHR team to activate it.",
  });
  for (const [reason, words] of Object.entries(SMART_BACKEND_REFUSALS))
    assert.equal(smartBackendRefusal(400, { reason }), words);
  assert.equal(
    smartBackendRefusal(400, { reason: "credential_invalid" }),
    null,
  );
  assert.equal(
    smartBackendRefusal(409, { reason: "fhir_not_answering" }),
    null,
  );
  assert.equal(smartBackendRefusal(400, undefined), null);
  const actions = code("app/account/connections/actions.ts");
  assert.match(
    actions,
    /error: smartBackendRefusal\(error\.status, error\.details\) \?\? error\.message,/u,
  );
});

test("D1: the EHR's row, connected, names the clinic's host; another key's row with no email says Connected", () => {
  const connection = {
    id: "c1",
    providerId: "ehr-fhir",
    status: "connected",
    externalAccount: { displayName: "fhir.clinic.example.test" },
    usedByCount: 0,
  };
  assert.deepEqual(connectionLine(connection, "smart-backend", "EHR"), {
    text: "fhir.clinic.example.test",
    tone: "muted",
  });
  assert.deepEqual(connectionLine(connection, "api-key", "Fixture"), {
    text: "Connected",
    tone: "muted",
  });
  assert.deepEqual(connectionLine(undefined, "smart-backend", "EHR"), {
    text: "Not connected",
    tone: "muted",
  });
});

/** Every source and record a person reads here: app, components, lib (not its generated copies) and the two documents. */
function sources() {
  const walk = (dir) =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory())
        return path === join("lib", "generated") ? [] : walk(path);
      return /\.(?:tsx?|mjs|md)$/u.test(entry.name) ? [path] : [];
    });
  return [
    ...walk("app"),
    ...walk("components"),
    ...walk("lib"),
    "docs/ARCHITECTURE.md",
    "README.md",
  ].map((path) => relative(root, resolve(root, path)));
}

test("S1-8, S1-11: the outside sign-in screen and the expired approval wait for no stage — nothing says the platform holds them back", () => {
  for (const path of sources())
    assert.doesNotMatch(
      read(path),
      /before Stage 2|BUILD-PLAN 29\.4\.6/u,
      `${path} still says the platform does not send it before Stage 2`,
    );
});

test("S1-11: the account area's error screen, its session kept, makes ONE read that names the active workspace — its 403 outside_org_domain is the sign-ins to remove; any other answer, or no active workspace (then nothing is read), none", async () => {
  const asked = [];
  const answering = (outcome) => async (path) => {
    asked.push(path);
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
  const refused = (status, details) =>
    Object.assign(new Error("Forbidden"), { status, details });
  const kept = { user: { activeWorkspaceId: "w 1" } };
  assert.deepEqual(
    await outsideOnError(
      kept,
      answering(
        refused(403, {
          reason: "outside_org_domain",
          providers: ["google", "apple"],
        }),
      ),
    ),
    ["google", "apple"],
  );
  assert.deepEqual(asked, ["/v1/workspaces/w%201/members"]);
  for (const outcome of [
    { members: [] },
    refused(403, { requiredRole: "owner" }),
    refused(503, undefined),
    new Error("no answer"),
  ])
    assert.equal(await outsideOnError(kept, answering(outcome)), null);
  asked.length = 0;
  assert.equal(
    await outsideOnError({ user: {} }, answering({ members: [] })),
    null,
  );
  assert.deepEqual(asked, []);
  // Only once the session is kept, and the screen drawn in place of the
  // platform's notice, its removal read again through the screen's retry.
  const screen = code("app/account/error.tsx");
  assert.match(
    screen,
    /\.then\(\s*async \(kept\) => \{\s*const refused = await outsideOnError\(kept, \(path\) =>\s*platformApiJson\(path\),?\s*\);/u,
  );
  assert.match(
    screen,
    /if \(outside\) return <OutsideSignIn providers=\{outside\} onRemoved=\{retry\} \/>;\s*[\s\S]*?return <PlatformUnavailable/u,
  );
});
