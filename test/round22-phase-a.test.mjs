import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { elements, loadModules, parse } from "./blocks-harness.mjs";

/**
 * Round 22 phase A on the website: the owner's decisions 17 and 19 of
 * 2026-11-15, verbatim: "go with recommended. delete at once. apps high
 * security alert, a / 19. align a-d no assumptions and no laziness."
 *
 * - 17, "delete at once": a file a start form or the job upload card lets go
 *   of before any run was given it is discarded on the platform at once, in
 *   the background, nothing said (`discardUpload`, DELETE
 *   /v1/workspaces/{workspaceId}/uploads/{artifactId}; its types are the
 *   generated contract's since snoopy-backend #289 merged). Which lettings-go
 *   discard is the session's reading and the app's (docs/ARCHITECTURE.md "A
 *   start form's files"), not the owner's words.
 * - 19 (c): every form's file buttons say "Take photo for {title}" and
 *   "Upload for {title}" to a screen reader, as the app now does. (d) lives
 *   in `test/run-file-image.test.mjs`; (a) and (b) change nothing here.
 *
 * The presses run in the fixture suite (`e2e/public-edge-fixture.spec.ts`,
 * "decision 17", and `e2e/flow-items.spec.ts`): this file holds the calls and
 * the wiring.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const RUN_START = "app/account/flows/RunStart.tsx";
const FILE_FIELD = "app/account/flows/RunFileField.tsx";
const CARD = "app/account/flows/UploadItemCard.tsx";
const UPLOADS = "app/account/flows/upload-actions.ts";
const AUTOMATIONS = "lib/automations.ts";

// What the stubs below were asked, by the test that reads it.
const asked = { discards: [], platform: [], sent: [] };
globalThis.__round22 = asked;

const STUBS = {
  "./actions":
    "export const setSubscriptionStatus = async () => ({ ok: true }); export const startRun = async () => ({ ok: true }); export const createItem = async () => ({ ok: false, error: 'x' });",
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' }); export async function discardRunUpload(workspaceId, artifactId) { globalThis.__round22.sent.push([workspaceId, artifactId]); if (artifactId === 'refused') throw new Error('the platform is down'); }",
  // Drawn in place: the real one portals into `document.body`.
  "@/components/ui/Modal":
    "export default function Modal(props) { return props.children; }",
};
const NO_ROUTER = (source) =>
  source.replace(
    /import \{ useRouter \} from "next\/navigation";/u,
    "const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
  );
/** On a phone: the field can take a photo. */
const PHONE = (source) =>
  source.replace(
    "useSyncExternalStore(watchPointer, onPhoneOrTablet, unknownOnServer)",
    "true",
  );
/** The field's state at first. */
const HOLDING = (state) => (source) =>
  source.replace('>({ kind: "empty" });', `>(${JSON.stringify(state)});`);
const READY = HOLDING({
  kind: "ready",
  artifactId: "a",
  name: "cv.pdf",
  sizeBytes: 10,
});
/** One of RunStart's two transitions pending, as its press leaves it. */
const PENDING = (name) => (source) => {
  const start =
    name === "starting" ? "startRunTransition" : "startTurnOnTransition";
  const line = `const [${name}, ${start}] = useTransition();`;
  assert.ok(source.includes(line), line);
  return source.replace(
    line,
    `const [${name}, ${start}] = [true, (run) => run()];`,
  );
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

async function load(entry, { field = (s) => s, own = (s) => s, stubs } = {}) {
  const { modules, cleanup } = await loadModules([entry], {
    stubs: stubs ?? STUBS,
    mutate: (file, source) =>
      file === entry
        ? own(entry === RUN_START ? NO_ROUTER(source) : source)
        : file === FILE_FIELD
          ? field(source)
          : source,
  });
  loaded.push(cleanup);
  return modules[entry];
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const nodes = (markup) => elements(parse(markup));
const textOf = (node) =>
  node.text ?? (node.children ?? []).map(textOf).join("");
const buttons = (markup) => nodes(markup).filter((n) => n.tag === "button");
const named = (markup, name) =>
  buttons(markup).find(
    (node) => (node.attrs["aria-label"] ?? textOf(node)) === name,
  );
const fileInputs = (markup) =>
  nodes(markup).filter(
    (node) => node.tag === "input" && node.attrs.type === "file",
  );
const disabled = (node) => node !== undefined && "disabled" in node.attrs;

const RESUME = {
  key: "resume",
  title: "Resume",
  control: "artifact",
  required: true,
};
const startProps = (extra) => ({
  workspaceId: "w",
  subscriptionId: "s",
  runInput: [RESUME],
  live: true,
  available: true,
  canGoLive: true,
  initialKey: "k",
  ...extra,
});
const DECLARED = {
  words: { singular: "Batch", plural: "Batches" },
  titleField: "name",
  fields: [],
  file: { key: "file", title: "Batch file" },
};
const cardProps = {
  workspaceId: "w",
  subscriptionId: "s",
  declared: DECLARED,
  saved: {},
  onClose: () => {},
  onMade: () => {},
};

/** A module's one function, by its opening line, to its closing brace at that indent. */
function body(source, opening) {
  const start = source.indexOf(opening);
  assert.ok(start >= 0, `${opening} is found`);
  const indent = /^ */u.exec(
    source.slice(source.lastIndexOf("\n", start) + 1),
  )[0];
  const end = source.indexOf(`\n${indent}};`, start);
  assert.ok(end > start, `${opening} ends`);
  return source.slice(start, end);
}

test("17: discardUpload — DELETE /v1/workspaces/{workspaceId}/uploads/{artifactId}, each id encoded, no body and no Idempotency-Key, its types the generated contract's", async () => {
  const automations = await load(AUTOMATIONS, {
    stubs: {
      "@/lib/platform-server": `
        export const workspacePath = (id) => "/v1/workspaces/" + encodeURIComponent(id);
        export async function platformServerJson(path, init) { globalThis.__round22.platform.push([path, init]); return null; }
        export const newIdempotencyKey = (prefix) => prefix;
        export class PlatformNotConfiguredError extends Error {}
        export class PlatformServerError extends Error {}`,
    },
  });
  asked.platform.length = 0;
  assert.equal(
    await automations.discardUpload({ workspaceId: "w/1", artifactId: "a b" }),
    undefined,
  );
  assert.deepEqual(asked.platform, [
    ["/v1/workspaces/w%2F1/uploads/a%20b", { method: "DELETE" }],
  ]);
  // The route's types are the generated contract's (snoopy-backend #289, merged).
  const source = read(AUTOMATIONS);
  assert.match(
    source,
    /export type DiscardUploadPath =\s+operations\["discardUpload"\]\["parameters"\]\["path"\];/u,
  );
  assert.match(source, /export type DiscardUploadResponse = void;/u);
  assert.match(
    read("lib/generated/platform-contracts/automations.d.ts"),
    /discardUpload/u,
  );
});

test("17: discardRunUpload — sent for the workspace the page showed while it is the active one, else nothing; it says nothing whatever the platform answers", async () => {
  const stubs = {
    "@/lib/platform-server":
      "export class PlatformServerError extends Error { constructor(message, status) { super(message); this.status = status; } }",
    "@/lib/automations": `
      export async function discardUpload(path) { globalThis.__round22.discards.push(path); const answer = globalThis.__round22.answer; if (answer) throw answer; }
      export const openUpload = async () => ({});
      export const completeUpload = async () => ({});`,
    "@/lib/tenancy": `
      export const WORKSPACE_CHANGED = "changed";
      export async function activeWorkspaceIfShown(shown) { if (globalThis.__round22.session === "refused") throw new Error("no session"); return globalThis.__round22.active === shown ? shown : null; }`,
  };
  const { discardRunUpload } = await load(UPLOADS, { stubs });
  const refusal = (status) =>
    Object.assign(new Error("refused"), {
      name: "PlatformServerError",
      status,
    });
  asked.discards.length = 0;
  asked.active = "w";
  asked.answer = undefined;
  asked.session = undefined;
  assert.equal(await discardRunUpload("w", "a"), undefined);
  assert.deepEqual(asked.discards, [{ workspaceId: "w", artifactId: "a" }]);
  // Another tab switched workspace (register F28): nothing is sent.
  asked.active = "other";
  assert.equal(await discardRunUpload("w", "b"), undefined);
  assert.equal(asked.discards.length, 1);
  // 404, 409 file_in_use, 503, no answer, no session: nothing said, nothing thrown.
  asked.active = "w";
  for (const answer of [
    refusal(404),
    refusal(409),
    refusal(503),
    new Error("unreachable"),
  ]) {
    asked.answer = answer;
    assert.equal(await discardRunUpload("w", "c"), undefined);
  }
  asked.answer = undefined;
  asked.session = "refused";
  assert.equal(await discardRunUpload("w", "d"), undefined);
  assert.equal(asked.discards.length, 5);
  assert.match(
    read(UPLOADS),
    /activeWorkspaceIfShown\(shownWorkspaceId\);\s*if \(!workspaceId\) return;\s*await discardUpload\(\{ workspaceId, artifactId \}\);/u,
  );
});

test("17: discardFiles — each id sent once, for the workspace the page showed, in the background; a refusal or a lost answer is never thrown", async () => {
  const { discardFiles } = await load(FILE_FIELD);
  const unhandled = [];
  const listen = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", listen);
  try {
    asked.sent.length = 0;
    assert.equal(discardFiles("w", ["a", "refused", "b"]), undefined);
    discardFiles("w", []);
    await new Promise((settle) => setTimeout(settle, 20));
    assert.deepEqual(asked.sent, [
      ["w", "a"],
      ["w", "refused"],
      ["w", "b"],
    ]);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", listen);
  }
});

test("17: every file a field lets go of is discarded — the x's, a held one a choice replaces, those a choice that empties the field held, and one completed after the field stopped waiting; a photo that adds and a field drawn away discard nothing", () => {
  const source = read(FILE_FIELD);
  // The x: that one file.
  const remove = body(source, "const remove = (at: number) => {");
  assert.match(
    remove,
    /discardFiles\(workspaceId, \[files\[at\]!\.artifactId\]\);/u,
  );
  // One file: every choice lets go of the file held — a new one, a refused one or none.
  const one = body(source, "const choose = async (");
  assert.match(
    one,
    /hush\(\);\s*\/\/[^\n]*\n[^\n]*\n\s*if \(state\.kind === "ready"\) discardFiles\(workspaceId, \[state\.artifactId\]\);\s*if \(!chosen\) \{/u,
  );
  // Several: the chooser emptied, past maxFiles, a type refused and a failed
  // upload empty the field and discard what it held; a photo past maxFiles keeps them.
  const several = body(source, "const chooseSeveral = async (");
  assert.match(
    several,
    /if \(source === "chooser"\) \{\s*letGo\(files\);\s*setState\(\{ kind: "empty" \}\);/u,
  );
  assert.match(
    several,
    /const empty = \(message: string, gone: readonly SentFile\[\] = files\) => \{\s*letGo\(gone\);/u,
  );
  assert.match(
    several,
    /if \(source === "camera"\) setError\(tooManyFiles\(maxFiles\)\);\s*else empty\(tooManyFiles\(maxFiles\)\);/u,
  );
  assert.match(several, /empty\(notAcceptedLine\(accepted\)\);/u);
  // A choice replaces the files held; a photo keeps them (they are `kept`).
  assert.match(several, /const kept = source === "camera" \? files : \[\];/u);
  assert.match(
    several,
    /letGo\(files\.filter\(\(file\) => !kept\.includes\(file\)\)\);\s*const sent: SentFile\[\] = \[\.\.\.kept\];/u,
  );
  // This choice's own files, when the field stops waiting: discarded; the kept ones are not.
  assert.match(
    several,
    /const abandon = \(\) => letGo\(sent\.slice\(kept\.length\)\);/u,
  );
  assert.equal((several.match(/return abandon\(\);/gu) ?? []).length, 3);
  // A failure empties the field: the kept files and this choice's go with it.
  assert.match(several, /: "The file could not be sent\.",\s*sent,\s*\);/u);
  // One completed after the field stopped waiting: discarded.
  const send = body(source, "const sendFile = async (");
  assert.match(
    send,
    /if \(upload\.signal\.aborted\) \{\s*\/\/[^\n]*\n\s*if \(completed\.ok\) discardFiles\(workspaceId, \[completed\.file\.artifactId\]\);\s*return;\s*\}/u,
  );
  // The field drawn away aborts its upload and discards nothing it held.
  const gone =
    /return \(\) => \{\s*const upload = inFlight\.current;[\s\S]*?\n {4}\};/u.exec(
      source,
    )?.[0];
  assert.ok(gone, "the field's cleanup is found");
  assert.doesNotMatch(gone, /discard/u);
  assert.match(gone, /upload\.abort\(\);/u);
});

test("17: while Start is pending (`starting`) the x, Upload, Take photo and both inputs are disabled; Turn on pending holds nothing; a flow's page, an item's page and Home's card", async () => {
  for (const [pending, held] of [
    ["starting", true],
    ["turningOn", false],
  ]) {
    const RunStart = (
      await load(RUN_START, {
        own: PENDING(pending),
        field: (source) =>
          PHONE(
            HOLDING({
              kind: "several",
              files: [{ artifactId: "a", name: "cv.pdf", sizeBytes: 10 }],
            })(source),
          ),
      })
    ).RunStart;
    for (const extra of [
      {},
      { itemId: "i", itemPage: true },
      { compact: true },
    ]) {
      const markup = draw(RunStart, startProps(extra));
      const x = named(markup, "Remove cv.pdf");
      assert.ok(x, "the x");
      assert.equal(disabled(x), held, `${pending}: the x`);
      assert.equal(
        disabled(named(markup, "Upload for Resume")),
        held,
        `${pending}: Upload`,
      );
      if (!extra.compact) {
        assert.equal(
          disabled(named(markup, "Take photo for Resume")),
          held,
          `${pending}: Take photo`,
        );
      }
      for (const input of fileInputs(markup)) {
        assert.equal(disabled(input), held, `${pending}: an input`);
      }
    }
  }
  // Nothing pending: all of them pressable.
  const { RunStart } = await load(RUN_START, { field: READY });
  const markup = draw(RunStart, startProps());
  assert.equal(disabled(named(markup, "Remove cv.pdf")), false);
  assert.equal(disabled(named(markup, "Upload for Resume")), false);
  const start = read(RUN_START);
  assert.match(start, /starting=\{starting\}/u);
  assert.match(
    read("app/account/flows/ManifestFields.tsx"),
    /starting=\{starting\}/u,
  );
});

test("17: the job upload card — Cancel, Escape and a press outside discard its file and close it; an item made closes it and discards nothing; while Upload is pending its field is held", async () => {
  const card = read(CARD);
  const cancel = body(card, "const cancel = () => {");
  assert.match(
    cancel,
    /new FormData\(form\.current\)\s*\.getAll\(`input:\$\{declared\.file\.key\}`\)/u,
  );
  assert.match(
    cancel,
    /discardFiles\(workspaceId, held\);\s*\}\s*onClose\(\);/u,
  );
  // Escape and a press outside are the Modal's onClose: Cancel.
  assert.match(card, /<Modal\s*onClose=\{cancel\}/u);
  assert.match(
    card,
    /variant="ghost"\s*onClick=\{cancel\}\s*disabled=\{pending\}/u,
  );
  assert.doesNotMatch(card, /onClick=\{onClose\}|onClose=\{onClose\}/u);
  // Made: the parent's onMade closes it, never through Cancel.
  assert.doesNotMatch(body(card, "const send = async ("), /cancel|discard/u);
  // Pending: the field held, Cancel waiting as before.
  const UploadItemCard = (
    await load(CARD, {
      own: (source) =>
        source.replace(
          "const [pending, startTransition] = useTransition();",
          "const [pending, startTransition] = [true, (run) => run()];",
        ),
      field: (source) => PHONE(READY(source)),
    })
  ).UploadItemCard;
  const markup = draw(UploadItemCard, cardProps);
  assert.ok(disabled(named(markup, "Upload for Batch file")));
  assert.ok(disabled(named(markup, "Take photo for Batch file")));
  for (const input of fileInputs(markup)) assert.ok(disabled(input));
  assert.ok(disabled(named(markup, "Cancel")));
  const idle = (await load(CARD, { field: (source) => PHONE(READY(source)) }))
    .UploadItemCard;
  const open = draw(idle, cardProps);
  assert.ok(!disabled(named(open, "Upload for Batch file")));
  assert.ok(!disabled(named(open, "Cancel")));
});

test("19 (c): every form's file buttons say Take photo for {title} and Upload for {title} — Home's card, a flow's page, an item's page and the job upload card, one file or several", async () => {
  for (const multiple of [false, true]) {
    const field = { ...RESUME, multiple };
    const { RunStart } = await load(RUN_START, { field: PHONE });
    for (const [form, extra, photo] of [
      ["Home's card", { compact: true }, false],
      ["a flow's page", {}, true],
      ["an item's page", { itemId: "i", itemPage: true }, true],
    ]) {
      const markup = draw(
        RunStart,
        startProps({ ...extra, runInput: [field] }),
      );
      assert.ok(named(markup, "Upload for Resume"), `${form}: Upload`);
      assert.equal(
        Boolean(named(markup, "Take photo for Resume")),
        photo,
        `${form}: Take photo`,
      );
      assert.ok(
        !buttons(markup).some((node) =>
          /Take a photo|Upload a file|Upload files/u.test(textOf(node)),
        ),
        form,
      );
    }
  }
  const UploadItemCard = (await load(CARD, { field: PHONE })).UploadItemCard;
  const markup = draw(UploadItemCard, cardProps);
  assert.ok(named(markup, "Upload for Batch file"), "the job card: Upload");
  assert.ok(
    named(markup, "Take photo for Batch file"),
    "the job card: Take photo",
  );
});
