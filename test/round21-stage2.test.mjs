import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  ACCEPT_AND_ADD,
  ACCEPT_AND_START,
  AGREEMENT_NOT_PUBLISHED,
  AGREEMENT_TITLE,
  ASK_OWNER,
  DOCUMENTS,
  NO_DOCUMENTS,
  SIGNER_NAME,
  SIGNER_TITLE,
  acceptedBy,
  agreementRequired,
  agreementVersion,
  authorizedToSign,
  documentName,
} from "../lib/health-agreement.ts";
import { connectionLine } from "../lib/connection-rows.ts";
import {
  SMART_BACKEND_REFUSALS,
  opensKeyForm,
  smartBackendRefusal,
  vendorField,
} from "../lib/smart-backend.ts";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * Round 21, Stage 2 on the website (the client half of backend PR #266,
 * 50a24f7; the same words as the app's, the spec's NEW WORDS): C3, the
 * health data agreement on Add and on Start run, and the organization's
 * Documents; D1, Connect your EHR. Each screen drawn as the browser draws
 * it; the e2e half, the clicks, is `e2e/health-data.spec.ts`.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
/** A source's code, without its comments — which may name what is gone. */
const code = (path) =>
  read(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");

const DIALOG = "app/account/flows/HealthAgreementDialog.tsx";
const DOCUMENT_LIST = "components/dashboard/OrgDocumentList.tsx";
const AGREEMENTS = "lib/agreements.ts";
const KEY_FIELDS = "app/account/connections/KeyFields.tsx";

/**
 * The platform as these modules meet it: `platformServerJson` answers from
 * `globalThis.__platform` by path (an Error is thrown), and every path asked
 * is kept; `listWorkspaces` answers `globalThis.__workspaces`.
 */
const STUBS = {
  "@/components/ui/Modal":
    "export default function Modal({ children }) { return children; }",
  "./agreement-actions":
    "export const acceptHealthAgreement = async () => ({ ok: true });",
  "@/lib/platform-server": `
    export class PlatformServerError extends Error {
      constructor(message, status, code, details) {
        super(message); this.status = status; this.code = code; this.details = details;
      }
    }
    globalThis.__PlatformServerError = PlatformServerError;
    export const workspacePath = (id) => "/v1/workspaces/" + id;
    export async function platformServerJson(path) {
      globalThis.__asked.push(path);
      const answer = globalThis.__platform[path];
      if (answer instanceof Error) throw answer;
      return answer;
    }`,
  "@/lib/tenancy": `
    export async function listWorkspaces() {
      globalThis.__asked.push("/v1/workspaces");
      return globalThis.__workspaces;
    }`,
};

let react;
let server;
const loaded = [];
before(async () => {
  react = await import("react");
  server = await import("react-dom/server");
});
after(() => {
  for (const cleanup of loaded) cleanup();
});

/** One module, loaded as written, or as `mutate` makes it (a bite). */
async function load(path, mutate) {
  const { modules, cleanup } = await loadModules([path], {
    stubs: STUBS,
    mutate: (file, source) =>
      mutate && file === path ? mutate(source) : source,
  });
  loaded.push(cleanup);
  return modules[path];
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const tree = (markup) => elements(parse(markup));

test("C3 words: the spec's, byte for byte, as the app says them", () => {
  assert.equal(AGREEMENT_TITLE, "Health data agreement");
  assert.equal(agreementVersion(2), "Version 2");
  assert.equal(
    authorizedToSign("Acme Clinic"),
    "I'm authorized to sign for Acme Clinic",
  );
  assert.equal(SIGNER_NAME, "Full name");
  assert.equal(SIGNER_TITLE, "Title");
  assert.equal(ACCEPT_AND_ADD, "Accept and add flow");
  assert.equal(ACCEPT_AND_START, "Accept and start run");
  assert.equal(
    ASK_OWNER,
    "Ask your workspace owner to accept the health data agreement.",
  );
  assert.equal(
    AGREEMENT_NOT_PUBLISHED,
    "The health data agreement isn't available yet.",
  );
  assert.equal(DOCUMENTS, "Documents");
  assert.equal(NO_DOCUMENTS, "No documents yet.");
  assert.equal(
    documentName({ kind: "health-data", version: 3 }),
    "Business Associate Agreement · Version 3",
  );
  assert.equal(
    acceptedBy("Dana Owner", "Aug 12, 2026"),
    "Accepted by Dana Owner on Aug 12, 2026",
  );
});

test("C3: only a 403 agreement_required is the agreement's — its kind and, when published, its version", () => {
  assert.deepEqual(
    agreementRequired(403, {
      reason: "agreement_required",
      kind: "health-data",
      version: 2,
    }),
    { kind: "health-data", version: 2 },
  );
  // No version published yet: the kind alone.
  assert.deepEqual(
    agreementRequired(403, {
      reason: "agreement_required",
      kind: "health-data",
    }),
    { kind: "health-data" },
  );
  for (const [status, details] of [
    [403, { reason: "flow_change_requires_admin" }],
    [403, { reason: "over_plan_limit", limit: 2, live: 3 }],
    [409, { reason: "agreement_required" }],
    [403, undefined],
  ])
    assert.equal(agreementRequired(status, details), null);
});

/** `lib/agreements.ts`, loaded once, so its stubbed error class is the one every test makes. */
let agreementsModule;
async function agreements() {
  agreementsModule ??= await load(AGREEMENTS);
  return agreementsModule;
}

/** `agreementRefusal` against a platform that answers `answers`, to a person of `role` in the workspace. */
async function refusal(error, { role = "owner", answers = {} } = {}) {
  globalThis.__asked = [];
  globalThis.__workspaces = [
    { id: "w1", name: "Acme Clinic", type: "organization", role },
  ];
  globalThis.__platform = answers;
  const { agreementRefusal } = await agreements();
  return agreementRefusal(error, "w1");
}
const platformError = (status, details, message = "Forbidden") =>
  new globalThis.__PlatformServerError(message, status, undefined, details);
const REQUIRED = {
  reason: "agreement_required",
  kind: "health-data",
  version: 1,
};
const TEXT = {
  "/v1/agreements/health-data": {
    version: 1,
    text: "# Business Associate Agreement",
    sha256: "a".repeat(64),
  },
};

test("C3: the workspace's owner, refused, is given the agreement to read — its version, text, hash and the workspace's name — from one workspace read and one text read", async () => {
  await agreements(); // the stub's error class, first
  const answer = await refusal(platformError(403, REQUIRED), { answers: TEXT });
  assert.deepEqual(answer, {
    ok: false,
    error: "",
    state: "agreement-required",
    agreement: {
      version: 1,
      text: "# Business Associate Agreement",
      sha256: "a".repeat(64),
      organization: "Acme Clinic",
    },
  });
  assert.deepEqual(globalThis.__asked, [
    "/v1/workspaces",
    "/v1/agreements/health-data",
  ]);
});

test("C3: anyone else is told to ask the owner, and the text is never read", async () => {
  await agreements();
  for (const role of ["admin", "member"]) {
    const answer = await refusal(platformError(403, REQUIRED), {
      role,
      answers: TEXT,
    });
    assert.deepEqual(answer, {
      ok: false,
      error: ASK_OWNER,
      state: "agreement-required",
    });
    assert.deepEqual(globalThis.__asked, ["/v1/workspaces"]);
  }
});

test("C3: with no version published — none named, or the text answering 503 agreement_not_published — the owner is told it isn't available yet", async () => {
  await agreements();
  const unnamed = await refusal(
    platformError(403, { reason: "agreement_required", kind: "health-data" }),
    { answers: TEXT },
  );
  assert.equal(unnamed.error, AGREEMENT_NOT_PUBLISHED);
  assert.equal(unnamed.agreement, undefined);
  assert.deepEqual(globalThis.__asked, ["/v1/workspaces"]);
  const unpublished = await refusal(platformError(403, REQUIRED), {
    answers: {
      "/v1/agreements/health-data": platformError(
        503,
        { reason: "agreement_not_published" },
        "Service Unavailable",
      ),
    },
  });
  assert.equal(unpublished.error, AGREEMENT_NOT_PUBLISHED);
});

test("C3: any other refusal is not the agreement's, and nothing more is read", async () => {
  await agreements();
  for (const error of [
    platformError(403, { reason: "over_plan_limit", limit: 2, live: 3 }),
    platformError(404, undefined, "Not Found"),
    new Error("not the platform's"),
  ]) {
    assert.equal(await refusal(error, { answers: TEXT }), null);
    assert.deepEqual(globalThis.__asked, []);
  }
});

test("C3: Add and Start run read the refusal through agreementRefusal, and Add sends its press's key — the one the agreement's repeat sends again", () => {
  const actions = code("app/account/flows/actions.ts");
  const subscribe =
    /export async function subscribeToAutomation[\s\S]*?\n\}/u.exec(actions)[0];
  assert.match(
    subscribe,
    /const idempotencyKey = String\(formData\.get\("idempotencyKey"\) \?\? ""\);/u,
  );
  assert.match(
    subscribe,
    /\} catch \(error\) \{\s*const agreement = await agreementRefusal\(error, shownWorkspace\(formData\)\);\s*if \(agreement\) return agreement;/u,
  );
  const start = /export async function startRun[\s\S]*?\n\}/u.exec(actions)[0];
  assert.match(
    start,
    /const agreement = await agreementRefusal\(error, shownWorkspace\(formData\)\);\s*if \(agreement\) return agreement;/u,
  );
  const add = code("app/account/flows/AddAutomation.tsx");
  assert.match(add, /data\.append\("idempotencyKey", key\);/u);
  assert.match(add, /setOffer\(\{ agreement: result\.agreement, key \}\);/u);
  assert.match(add, /onAccepted=\{\(\) => send\(offer\.key\)\}/u);
  const run = code("app/account/flows/RunStart.tsx");
  assert.match(run, /setOffer\(\{ agreement: result\.agreement, data \}\);/u);
  assert.match(run, /onAccepted=\{\(\) => send\(offer\.data\)\}/u);
  // Beside the form, never in it: its fields are not the run's.
  assert.match(run, /<\/form>\s*\{offer \? \(\s*<HealthAgreementDialog/u);
});

const OFFER = {
  version: 3,
  text: "# Business Associate Agreement\n\nBetween {Covered Entity} and Autom8x.",
  sha256: "b".repeat(64),
  organization: "Acme Clinic",
};

async function dialog(purpose, mutate) {
  const { HealthAgreementDialog } = await load(DIALOG, mutate);
  return draw(HealthAgreementDialog, {
    offer: OFFER,
    workspaceId: "w1",
    purpose,
    onAccepted: async () => null,
    onClose: () => {},
  });
}

test("C3: the dialog is the title, Version {n}, the text to scroll, the checkbox, Full name and Title, then Cancel and Accept and add flow", async () => {
  const markup = await dialog("add");
  assert.deepEqual(visibleWords(markup), [
    "Health data agreement",
    "Version 3",
    OFFER.text,
    "I'm authorized to sign for Acme Clinic",
    "Full name",
    "Title",
    "Cancel",
    "Accept and add flow",
  ]);
  const nodes = tree(markup);
  const named = (name) => nodes.find((node) => node.attrs.name === name);
  // What the platform checks the acceptance against: the version and the
  // hash of the text this person read, and one key for the opening.
  assert.equal(named("version").attrs.value, "3");
  assert.equal(named("sha256").attrs.value, OFFER.sha256);
  assert.match(named("agreementKey").attrs.value, /^agreement-[0-9a-f-]{36}$/u);
  assert.equal(named("authorized").attrs.type, "checkbox");
  assert.ok("required" in named("authorized").attrs);
  for (const field of ["signerName", "signerTitle"]) {
    assert.ok("required" in named(field).attrs, field);
    assert.equal(named(field).attrs.maxLength, "120", field);
  }
  // The text scrolls, and the keyboard reaches it.
  const text = nodes.find(
    (node) => node.attrs["data-testid"] === "agreement-text",
  );
  assert.equal(text.attrs.tabindex, "0");
  assert.match(text.attrs.class, /\boverflow-y-auto\b/u);
});

test("C3: on Start run, its button is Accept and start run", async () => {
  const words = visibleWords(await dialog("run"));
  assert.equal(words.at(-1), "Accept and start run");
  assert.ok(!words.includes("Accept and add flow"));
});

const documents = [
  {
    id: "d2",
    kind: "health-data",
    version: 2,
    signerName: "Dana Owner",
    signerTitle: "Practice manager",
    acceptedAt: "2026-11-03T15:00:00.000Z",
  },
  {
    id: "d0",
    kind: "a-later-kind",
    version: 1,
    signerName: "Someone",
    signerTitle: "Owner",
    acceptedAt: "2026-10-01T15:00:00.000Z",
  },
  {
    id: "d1",
    kind: "health-data",
    version: 1,
    signerName: "Fixture Owner",
    signerTitle: "Owner",
    acceptedAt: "2026-08-12T12:00:00.000Z",
  },
];

test("C3 Documents: a row per signed document, newest first as listed — its name over who accepted it and the day — each opening its copy's page; a kind this build does not know is left out", async () => {
  const { OrgDocumentList } = await load(DOCUMENT_LIST);
  const markup = draw(OrgDocumentList, { documents });
  assert.deepEqual(visibleWords(markup), [
    "Business Associate Agreement · Version 2",
    "Accepted by Dana Owner on Nov 3, 2026",
    "Business Associate Agreement · Version 1",
    "Accepted by Fixture Owner on Aug 12, 2026",
  ]);
  assert.deepEqual(
    tree(markup)
      .filter((node) => node.tag === "a")
      .map((node) => node.attrs.href),
    [
      "/account/organization/documents/d2",
      "/account/organization/documents/d1",
    ],
  );
});

test("C3 Documents: none — or none this build knows — says No documents yet.", async () => {
  const { OrgDocumentList } = await load(DOCUMENT_LIST);
  for (const list of [[], [documents[1]]])
    assert.deepEqual(visibleWords(draw(OrgDocumentList, { documents: list })), [
      "No documents yet.",
    ]);
});

test("C3 Documents: the organization page reads the list once with its other reads, under Documents; the copy is read only on its own page", () => {
  const page = code("app/account/organization/page.tsx");
  assert.match(
    page,
    /await Promise\.all\(\[[\s\S]*?listWorkspaceDocuments\(workspace\.id\),\s*\]\);/u,
  );
  assert.match(
    page,
    /<SectionTitle>\{DOCUMENTS\}<\/SectionTitle>\s*<OrgDocumentList documents=\{documents\} \/>/u,
  );
  assert.doesNotMatch(page, /readWorkspaceDocument/u);
  const copy = code("app/account/organization/documents/[documentId]/page.tsx");
  assert.match(
    copy,
    /await readWorkspaceDocument\(workspace\.id, documentId\)/u,
  );
  assert.match(copy, /if \(!copy \|\| !name\) notFound\(\);/u);
});

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
