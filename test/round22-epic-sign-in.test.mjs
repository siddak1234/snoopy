import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  SIGN_IN_AGAIN_LABEL,
  actionLabel,
  connectionAction,
  connectionLine,
} from "../lib/connection-rows.ts";
import { STARTED_FROM_EHR, startedByLine } from "../lib/run-progress.ts";
import {
  EHR_ACCOUNT_MISMATCH,
  EHR_SIGN_IN_REFUSALS,
  accountMismatch,
  EHR_SIGN_IN_RETURNS,
  ehrSignInRefusal,
  ehrSignInReturn,
  opensKeyForm,
  opensSignInForm,
  postedCredentials,
  signInLabel,
  vendorField,
} from "../lib/smart-backend.ts";
import { withCallbackStatus } from "../app/account/connections/pending-connect.ts";
import { visibleWords } from "./blocks-harness.mjs";
import {
  cleanupLoaded,
  code,
  draw,
  load,
  platform,
  platformError,
  read,
  tree,
} from "./round21-stage2-harness.mjs";

/**
 * Round 22 on the website, against snoopy-backend 6cc381f's contract (PR
 * #306 on #305): the EHR a person signs in to (backend ADR-0054, `authType`
 * `smart-launch`) and the run an EHR's hook started (ADR-0053, `startedBy`).
 * The sign-in form is the key form's fields with one button named by the
 * vendor; its begin is the OAuth connect's, carrying `credentials`; every
 * refusal is in the words `snoopy-backend/docs/openapi/connections.yaml`
 * defines once; a sign-in to do again is "Sign in again". The presses run in
 * the fixture suite (`e2e/ehr-connect.spec.ts`, "R22"); this file holds the
 * rules, the words and the wiring.
 */

after(cleanupLoaded);

const SPEC = read("lib/generated/snoopy-backend/docs/openapi/connections.yaml");
const AUTOMATIONS = read(
  "lib/generated/snoopy-backend/docs/openapi/automations.yaml",
);
const CONNECTIONS_TYPES = read(
  "lib/generated/platform-contracts/connections.d.ts",
);
const AUTOMATIONS_TYPES = read(
  "lib/generated/platform-contracts/automations.d.ts",
);
/** The spec's prose, its folded lines joined, so a sentence is found whole. */
const prose = SPEC.replace(/\s*\n\s*/gu, " ");

const EHR = {
  providerId: "ehr-fhir",
  displayName: "EHR",
  description:
    "Reads and writes visit notes in your EHR, once someone at your clinic signs in.",
  icon: "FirstAid",
  scopes: [],
  authType: "smart-launch",
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

test("R22: the contract pinned is 6cc381f's — smart-launch, authorize's credentials, and a run's startedBy", () => {
  assert.match(SPEC, /enum: \[oauth2, api-key, smart-backend, smart-launch\]/u);
  assert.match(
    CONNECTIONS_TYPES,
    /authType: "oauth2" \| "api-key" \| "smart-backend" \| "smart-launch"/u,
  );
  assert.match(
    CONNECTIONS_TYPES,
    /credentials\?: \{\s*(?:\/\*\*[\s\S]*?\*\/\s*)?vendor: string;\s*(?:\/\*\*[\s\S]*?\*\/\s*)?fhirBaseUrl: string;\s*\}/u,
  );
  assert.match(
    AUTOMATIONS_TYPES,
    /startedBy\?: "schedule" \| "webhook" \| "manual" \| "provider-event"/u,
  );
  assert.match(AUTOMATIONS, /startedBy:\n\s+type: string/u);
});

test("R22: an EHR a person signs in to opens the sign-in form, not the key form; its vendor is picked only from two or more", () => {
  assert.equal(opensSignInForm("smart-launch"), true);
  assert.equal(opensKeyForm("smart-launch"), false);
  for (const authType of ["oauth2", "api-key", "smart-backend", "none", null])
    assert.equal(opensSignInForm(authType), false);
  assert.deepEqual(vendorField(EHR), { kind: "picker", vendors: EHR.vendors });
  assert.deepEqual(vendorField({ ...EHR, vendors: EHR.vendors.slice(1) }), {
    kind: "fixed",
    id: "epic",
  });
  assert.equal(vendorField({ ...EHR, vendors: [] }), null);
  const panel = code("app/account/connections/ConnectionsPanel.tsx");
  assert.match(
    panel,
    /if \(opensKeyForm\(provider\.authType\) \|\| opensSignInForm\(provider\.authType\)\)/u,
  );
  assert.match(
    panel,
    /opensSignInForm\(selectedProvider\.authType\) \? \(\s*<SignInForm/u,
  );
});

test("R22: the sign-in button is named by the vendor chosen, from the platform's label — never a name of ours", () => {
  assert.equal(signInLabel(EHR.vendors, "epic"), "Sign in with Epic");
  assert.equal(
    signInLabel(EHR.vendors, "epic-test"),
    "Sign in with Epic (test system)",
  );
  assert.equal(
    signInLabel([{ id: "other-ehr", label: "Other EHR" }], "other-ehr"),
    "Sign in with Other EHR",
  );
  for (const chosen of [null, undefined, "", "missing"])
    assert.equal(signInLabel(EHR.vendors, chosen), "Sign in");
  assert.equal(signInLabel(undefined, "epic"), "Sign in");
  assert.doesNotMatch(
    code("app/account/connections/SignInForm.tsx"),
    /Epic/u,
    "no vendor is named in the form's code",
  );
});

test("R22: the sign-in form draws the key form's fields and its one button: Sign in until a vendor is picked; with one vendor, its name at once", async () => {
  const { SignInForm } = await load("app/account/connections/SignInForm.tsx");
  const props = {
    workspaceId: "w1",
    onAlready() {},
    onCancel() {},
  };
  const two = draw(SignInForm, { ...props, provider: EHR });
  assert.deepEqual(visibleWords(two), [
    "Epic (test system)",
    "Epic",
    "FHIR address",
    "Your EHR team gives you this address.",
    "Cancel",
    "Sign in",
  ]);
  const nodes = tree(two);
  assert.equal(
    nodes.filter((node) => node.attrs.name === "credential:vendor").length,
    2,
  );
  assert.ok(nodes.some((node) => node.attrs.name === "credential:fhirBaseUrl"));
  assert.equal(nodes.filter((node) => node.attrs.type === "submit").length, 1);
  // From two or more, none is chosen for the person (the session's D1).
  assert.equal(
    nodes.filter(
      (node) =>
        node.attrs.name === "credential:vendor" && "checked" in node.attrs,
    ).length,
    0,
  );
  const one = draw(SignInForm, {
    ...props,
    provider: { ...EHR, vendors: EHR.vendors.slice(0, 1) },
  });
  assert.deepEqual(visibleWords(one).slice(-2), [
    "Cancel",
    "Sign in with Epic (test system)",
  ]);
  // Replace only answers a refused begin; never drawn at first.
  assert.doesNotMatch(two + one, /Replace/u);
});

test("R22: the begin carries the vendor and address as credentials, and Replace the live connection; a sign-in leaves for the EHR's page", async () => {
  const { beginConnectionAuthorization } = await load(
    "app/account/connections/actions.ts",
  );
  const path = "/v1/workspaces/w1/connections/authorize";
  platform({
    [path]: {
      outcome: "authorization-required",
      authorizationUrl: "https://ehr.example.test/authorize?state=s",
      expiresAt: "2026-11-25T12:00:00.000Z",
    },
  });
  assert.deepEqual(
    await beginConnectionAuthorization("w1", "ehr-fhir", {
      credentials: {
        vendor: " epic ",
        fhirBaseUrl: " https://fhir.clinic.example.test/r4 ",
      },
    }),
    {
      ok: true,
      authorizationUrl: "https://ehr.example.test/authorize?state=s",
    },
  );
  assert.deepEqual(JSON.parse(globalThis.__sent[0].body), {
    providerId: "ehr-fhir",
    credentials: {
      vendor: "epic",
      fhirBaseUrl: "https://fhir.clinic.example.test/r4",
    },
  });
  await beginConnectionAuthorization("w1", "ehr-fhir", {
    credentials: { vendor: "epic", fhirBaseUrl: "https://x.example.test" },
    replaceConnectionId: "c1",
  });
  assert.equal(JSON.parse(globalThis.__sent[1].body).replaceConnectionId, "c1");
  // An OAuth connect carries neither.
  await beginConnectionAuthorization("w1", "quickbooks");
  assert.deepEqual(JSON.parse(globalThis.__sent[2].body), {
    providerId: "quickbooks",
  });
  // Nothing is sent without both values.
  platform({});
  assert.deepEqual(
    await beginConnectionAuthorization("w1", "ehr-fhir", {
      credentials: { vendor: "epic", fhirBaseUrl: " " },
    }),
    { ok: false, error: "Complete every required credential field" },
  );
  assert.deepEqual(globalThis.__asked, []);
  const starter = code("app/account/connections/start-connect.ts");
  assert.match(
    starter,
    /beginConnectionAuthorization\(\s*workspaceId,\s*providerId,\s*signIn,?\s*\)/u,
  );
  assert.match(
    starter,
    /window\.location\.assign\(result\.authorizationUrl\)/u,
  );
});

test("R22: each begin refusal is the spec's words — 400 by its reason, 409 account_mismatch replaceable — and any other keeps the platform's", async () => {
  for (const words of [
    ...Object.values(EHR_SIGN_IN_REFUSALS),
    EHR_ACCOUNT_MISMATCH,
  ])
    assert.ok(prose.includes(`"${words}"`), `the spec defines "${words}"`);
  assert.deepEqual(Object.keys(EHR_SIGN_IN_REFUSALS), [
    "fhir_address_refused",
    "fhir_not_answering",
    "ehr_sign_in_unsupported",
  ]);
  for (const [reason, message] of Object.entries(EHR_SIGN_IN_REFUSALS))
    assert.deepEqual(ehrSignInRefusal(400, { reason }), {
      message,
      replaceable: false,
    });
  assert.deepEqual(ehrSignInRefusal(409, { reason: "account_mismatch" }), {
    message: EHR_ACCOUNT_MISMATCH,
    replaceable: true,
  });
  for (const [status, details] of [
    [400, { reason: "credential_invalid" }],
    [400, { reason: "account_mismatch" }],
    [409, undefined],
    [409, { reason: "fhir_not_answering" }],
    [400, { reason: "constructor" }],
  ])
    assert.equal(ehrSignInRefusal(status, details), null);

  const { beginConnectionAuthorization } = await load(
    "app/account/connections/actions.ts",
  );
  const path = "/v1/workspaces/w1/connections/authorize";
  const signIn = {
    credentials: { vendor: "epic", fhirBaseUrl: "https://x.example.test" },
  };
  platform({ [path]: platformError(409, { reason: "account_mismatch" }) });
  assert.deepEqual(
    await beginConnectionAuthorization("w1", "ehr-fhir", signIn),
    {
      ok: false,
      error: EHR_ACCOUNT_MISMATCH,
      replaceable: true,
    },
  );
  platform({
    [path]: platformError(400, { reason: "ehr_sign_in_unsupported" }),
  });
  assert.deepEqual(
    await beginConnectionAuthorization("w1", "ehr-fhir", signIn),
    {
      ok: false,
      error: EHR_SIGN_IN_REFUSALS.ehr_sign_in_unsupported,
    },
  );
  platform({
    [path]: platformError(400, { reason: "credential_invalid" }, "Bad Request"),
  });
  assert.deepEqual(
    await beginConnectionAuthorization("w1", "ehr-fhir", signIn),
    {
      ok: false,
      error: "Bad Request",
    },
  );
});

test("R22: the 409 asks Replace it? only while the connection to replace is known; else its first sentence alone, and the connections are read again (the session's D3)", () => {
  assert.equal(accountMismatch(true), EHR_ACCOUNT_MISMATCH);
  assert.equal(
    accountMismatch(false),
    "This workspace is signed in to another EHR address.",
  );
  assert.ok(prose.includes(`("${accountMismatch(false)} Replace it?")`));
  const form = code("app/account/connections/SignInForm.tsx");
  // Replace sends what the form holds now — never what a refused begin sent.
  assert.match(
    form,
    /const begin = \(replaceConnectionId\?: string\) => \{\s*if \(!form\.current\) return;\s*const credentials = postedCredentials\(new FormData\(form\.current\)\);/u,
  );
  assert.doesNotMatch(form, /\bsent\b|setSent/u);
  // A 409 that arrives after a field changed offers no Replace: the form must still hold what was refused.
  assert.match(
    form,
    /if \(started\.replaceable\) \{[\s\S]*?if \(now !== JSON\.stringify\(credentials\)\) return;\s*setMismatch\(true\);/u,
  );
  // Any change to a field takes the question back.
  assert.match(
    form,
    /setVendor\(typeof picked === "string" \? picked : null\);\s*setMismatch\(false\);/u,
  );
  // Not known here: the first sentence alone, the connections read again.
  assert.match(
    form,
    /if \(started\.replaceable\) \{[\s\S]*?setMismatch\(true\);\s*if \(!replaces\) onReread\(\);\s*return;\s*\}/u,
  );
  assert.match(
    form,
    /message=\{mismatch \? accountMismatch\(Boolean\(replaces\)\) : error\}/u,
  );
  assert.match(form, /\{mismatch && replaces \? \(/u);
  assert.match(form, /onClick=\{\(\) => begin\(replaces\)\}/u);
  for (const caller of [
    "app/account/connections/ConnectionsPanel.tsx",
    "app/account/flows/VendorRows.tsx",
  ])
    assert.match(
      code(caller),
      /onReread=\{\(\) => router\.refresh\(\)\}/u,
      caller,
    );
});

test("R22: a sign-in started from a flow's Set up opens there and comes back there, the EHR chosen — never sent to Connections (the session's D4)", () => {
  const rows = code("app/account/flows/VendorRows.tsx");
  assert.match(
    rows,
    /if \(!canManage\) return;\s*if \(option\.signIn\) \{\s*setSigningInFor\(option\.providerId\);\s*return;\s*\}\s*if \(!option\.connectable\) \{/u,
  );
  // The option as read now — a read again brings the connection Replace names.
  assert.match(
    rows,
    /const signingIn =\s*options\.find\(\(option\) => option\.providerId === signingInFor\) \?\? null;/u,
  );
  assert.match(
    rows,
    /<SignInForm\s+provider=\{signingIn\.signIn\}\s+workspaceId=\{workspaceId\}\s+replaces=\{signingIn\.connection\?\.id\}\s+returnTo=\{returnTo\}/u,
  );
  for (const page of [
    "app/account/flows/[subscriptionId]/setup/page.tsx",
    "app/account/flows/[subscriptionId]/vendor/page.tsx",
  ])
    assert.match(
      code(page),
      /\.\.\.\(provider && opensSignInForm\(provider\.authType\)\s*\? \{ signIn: provider \}\s*: \{\}\)/u,
      page,
    );
  // In a dialog over Set up's own form, its submit is its own.
  assert.match(
    code("app/account/connections/SignInForm.tsx"),
    /event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*begin\(\);/u,
  );
});

test("R22: a sign-in refused on the way back is said by its reason in the spec's words; any other token, none", () => {
  for (const words of Object.values(EHR_SIGN_IN_RETURNS))
    assert.ok(prose.includes(`"${words}"`), `the spec defines "${words}"`);
  assert.deepEqual(Object.keys(EHR_SIGN_IN_RETURNS), [
    "no_refresh_token",
    "fhir_address_refused",
    "fhir_not_answering",
  ]);
  for (const [reason, words] of Object.entries(EHR_SIGN_IN_RETURNS))
    assert.equal(ehrSignInReturn(reason), words);
  for (const reason of [
    "access_denied",
    "constructor",
    "toString",
    "",
    null,
    undefined,
    ["no_refresh_token"],
  ])
    assert.equal(ehrSignInReturn(reason), null);
  // The return keeps only a reason with words; the panel says it, and takes
  // it on to the flow page a sign-in started on.
  const landing = code("app/connections/page.tsx");
  assert.match(
    landing,
    /ehrSignInReturn\(reason\) === null \? null : String\(reason\)/u,
  );
  const panel = code("app/account/connections/ConnectionsPanel.tsx");
  assert.match(panel, /\{ehrSignInReturn\(callbackReason\) \?\?/u);
  assert.match(
    panel,
    /router\.replace\(withCallbackStatus\(back, callbackStatus, callbackReason\)\)/u,
  );
  assert.equal(
    withCallbackStatus("/account/flows/x/setup", "error", "no_refresh_token"),
    "/account/flows/x/setup?status=error&reason=no_refresh_token",
  );
  assert.equal(
    withCallbackStatus(
      "/account/flows/x/vendor?field=ehr",
      "connected",
      "no_refresh_token",
    ),
    "/account/flows/x/vendor?field=ehr&status=connected",
  );
  assert.equal(
    withCallbackStatus("/account/flows/x", "error", null),
    "/account/flows/x?status=error",
  );
  assert.match(
    code("app/account/flows/[subscriptionId]/setup/SetupForm.tsx"),
    /\{callbackRefusal \?\?/u,
  );
});

test("R22: an EHR sign-in to do again says Sign in again, its row named for a screen reader; connected, it names the clinic's host", () => {
  assert.equal(
    connectionAction("attention", "smart-launch"),
    SIGN_IN_AGAIN_LABEL,
  );
  assert.equal(SIGN_IN_AGAIN_LABEL, "Sign in again");
  for (const authType of ["oauth2", "api-key", "smart-backend", undefined])
    assert.equal(connectionAction("attention", authType), "Reconnect");
  assert.equal(connectionAction("not-connected", "smart-launch"), "Connect");
  assert.equal(connectionAction("connected", "smart-launch"), "Disconnect");
  assert.equal(actionLabel("Sign in again", "EHR"), "Sign in again to EHR");
  assert.equal(actionLabel("Connect", "EHR"), "Connect EHR");
  assert.equal(actionLabel("Disconnect", "EHR"), "Disconnect EHR");
  // Each name begins with the button's visible words (WCAG 2.5.3).
  for (const action of ["Connect", "Reconnect", "Sign in again", "Disconnect"])
    assert.ok(actionLabel(action, "EHR").startsWith(`${action} `), action);
  const connection = {
    id: "c1",
    providerId: "ehr-fhir",
    status: "connected",
    externalAccount: { displayName: "fhir.clinic.example.test" },
    usedByCount: 0,
  };
  assert.deepEqual(connectionLine(connection, "smart-launch", "EHR"), {
    text: "fhir.clinic.example.test",
    tone: "muted",
  });
  assert.deepEqual(
    connectionLine(
      {
        ...connection,
        status: "reauthorization-required",
        errorCode: "no_refresh_token",
      },
      "smart-launch",
      "EHR",
    ),
    { text: "Needs attention", tone: "warn" },
  );
  const panel = code("app/account/connections/ConnectionsPanel.tsx");
  assert.match(panel, /connectionAction\(state, provider\.authType\)/u);
  assert.match(
    panel,
    /aria-label=\{actionLabel\(action, provider\.displayName\)\}/u,
  );
});

test("R22: the form's values are read by name, as the key form posts them", () => {
  const form = new FormData();
  form.set("credential:vendor", "epic");
  form.set("credential:fhirBaseUrl", "  https://fhir.clinic.example.test/r4 ");
  form.set("providerId", "ehr-fhir");
  assert.deepEqual(postedCredentials(form), {
    vendor: "epic",
    fhirBaseUrl: "https://fhir.clinic.example.test/r4",
  });
});

test("R22: a run an EHR's hook started says so; a person's, a schedule's, a webhook's or an older run's says nothing new — on Activity's row and the run's page", () => {
  assert.equal(startedByLine("provider-event"), STARTED_FROM_EHR);
  assert.equal(STARTED_FROM_EHR, "Started from your EHR");
  for (const startedBy of ["manual", "schedule", "webhook", undefined])
    assert.equal(startedByLine(startedBy), null);
  assert.match(
    code("app/account/runs/page.tsx"),
    /const started = startedByLine\(run\.startedBy\);/u,
  );
  const live = code("app/account/runs/[runId]/RunLive.tsx");
  assert.match(
    live,
    /const started = startedByLine\(run\.startedBy\);\s*const body = \(\s*<Group>\s*\{started \?/u,
  );
  // The subscription read names only the first way to start: nothing here
  // reads a list of them.
  assert.doesNotMatch(
    [code("app/account/runs/page.tsx"), live, code("lib/run-progress.ts")].join(
      "\n",
    ),
    /\btriggers\b/u,
  );
});
