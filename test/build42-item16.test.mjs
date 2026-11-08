import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The owner's TestFlight build 42, item 16, on the website (the same words
 * and behaviour as the app): "It looks like big squares for a quick access" —
 * Home's YOUR FLOWS card in two rows. Row 1 the flow's icon and name, a flow
 * with jobs its job pill at the right; row 2 Take photo, Upload and Start on
 * one row, no visible field title for a run input of one file field, the
 * uploading or ready line under the row only once a file is picked. Every
 * other place the start form is drawn stays as it was.
 */

const RUN_START = "app/account/flows/RunStart.tsx";
const YOUR_FLOWS = "app/account/YourFlows.tsx";
const STUBS = {
  "./actions":
    "export const setSubscriptionStatus = async () => ({ ok: true }); export const startRun = async () => ({ ok: true });",
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' });",
};
/** No app router is mounted here: RunStart's router stood in for. */
const NO_ROUTER = (source) =>
  source.replace(
    /import \{ useRouter \} from "next\/navigation";/u,
    "const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
  );
/** On a phone: Take photo is drawn. */
const PHONE = (source) =>
  source.replace(
    "useSyncExternalStore(watchPointer, onPhoneOrTablet, unknownOnServer)",
    "true",
  );

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

/** RunStart, its file field changed by `field` and itself by `start` (a bite, or a state). */
async function runStart({ field = (s) => s, start = (s) => s } = {}) {
  const { modules, cleanup } = await loadModules([RUN_START], {
    stubs: STUBS,
    mutate: (file, source) =>
      file === RUN_START
        ? start(NO_ROUTER(source))
        : file === "app/account/flows/RunFileField.tsx"
          ? field(source)
          : source,
  });
  loaded.push(cleanup);
  return modules[RUN_START].RunStart;
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const nodes = (markup) => elements(parse(markup));
const byTestId = (markup, id) =>
  nodes(markup).filter((node) => node.attrs["data-testid"] === id);
const classes = (node) => (node.attrs.class ?? "").split(/\s+/u);
const textOf = (node) =>
  node.text ?? (node.children ?? []).map(textOf).join("");
const buttons = (markup) => nodes(markup).filter((n) => n.tag === "button");
const submitOf = (markup) =>
  buttons(markup).find((node) => node.attrs.type === "submit");

const ONE_FILE = [
  { key: "resume", title: "Resume", control: "artifact", required: true },
];
const TWO_FIELDS = [
  ...ONE_FILE,
  { key: "note", title: "Note", control: "text", required: false },
];
const props = (extra) => ({
  workspaceId: "w",
  subscriptionId: "s",
  runInput: ONE_FILE,
  live: true,
  available: true,
  canGoLive: true,
  initialKey: "k",
  ...extra,
});

test("build 42, item 16 (a): Home's card, one file field — no visible field title, its label for screen readers only; two fields keep a visible title each", async () => {
  const RunStart = await runStart();
  const one = draw(RunStart, props({ compact: true }));
  const [label] = nodes(one).filter((node) => node.tag === "label");
  assert.ok(classes(label).includes("sr-only"), "the label is sr-only");
  assert.equal(textOf(label), "Resume", "the chooser keeps its name");
  assert.ok(!visibleWords(one).includes("Resume"));
  const two = draw(RunStart, props({ compact: true, runInput: TWO_FIELDS }));
  const labels = nodes(two).filter((node) => node.tag === "label");
  assert.equal(labels.length, 2);
  for (const each of labels)
    assert.ok(!classes(each).includes("sr-only"), textOf(each));
  assert.ok(visibleWords(two).includes("Resume"));
  assert.ok(visibleWords(two).includes("Note"));
  // Without compact (the flow page): the title over the buttons, as before.
  const page = draw(RunStart, props());
  assert.ok(visibleWords(page).includes("Resume"));
});

test("build 42, item 16 (b): Take photo, Upload and Start share one row; Upload alone off a phone; two fields keep Start on its own", async () => {
  const rowOf = (markup) => {
    const row = nodes(markup).find((node) =>
      (node.children ?? []).some(
        (child) => child.tag === "button" && child.attrs.type === "submit",
      ),
    );
    return (row?.children ?? [])
      .filter((child) => child.tag === "button")
      .map((button) => visibleWords(markupOf(button)).join(" "));
  };
  const phone = await runStart({ field: PHONE });
  assert.deepEqual(rowOf(draw(phone, props({ compact: true }))), [
    "Take photo",
    "Upload",
    "Start",
  ]);
  const computer = await runStart();
  const markup = draw(computer, props({ compact: true }));
  assert.deepEqual(rowOf(markup), ["Upload", "Start"]);
  const row = nodes(markup).find((node) =>
    (node.children ?? []).some((child) => child.attrs?.type === "submit"),
  );
  for (const name of ["flex", "flex-wrap", "items-center", "gap-2"])
    assert.ok(classes(row).includes(name), name);
  assert.ok(!classes(row).includes("mt-2"), "no margin above the row");
  // The sr-only " for Resume" stays on each.
  assert.match(markup, /Upload<span class="sr-only"> for Resume<\/span>/u);
  // A job flow's card (itemId): Upload, then Start, then the accepted types.
  const job = draw(computer, props({ compact: true, itemId: "i" }));
  const jobRow = nodes(job).find((node) =>
    (node.children ?? []).some((child) => child.attrs?.type === "submit"),
  );
  assert.deepEqual(
    (jobRow?.children ?? [])
      .filter((child) => child.tag)
      .map((child) =>
        child.tag === "button"
          ? (child.attrs.type ?? "button")
          : `${child.tag}#${child.attrs.id ? "types" : ""}`,
      ),
    ["button", "submit", "span#types"],
  );
  // Two fields: Start in a row of its own, as today.
  const two = draw(computer, props({ compact: true, runInput: TWO_FIELDS }));
  assert.deepEqual(rowOf(two), ["Start"]);
  // The form's gap is the card's inner one on Home, the group's elsewhere.
  assert.ok(classes(byTestId(markup, "run-form")[0]).includes("gap-2"));
  assert.ok(
    classes(byTestId(draw(computer, props()), "run-form")[0]).includes("gap-4"),
  );
});

/** A node's markup again, for its words. */
function markupOf(node) {
  const walk = (one) =>
    one.text !== undefined
      ? one.text
      : `<${one.tag}${one.attrs.class ? ` class="${one.attrs.class}"` : ""}>${one.children.map(walk).join("")}</${one.tag}>`;
  return walk(node);
}

test('build 42, item 16 (d): Home\'s Start says "Start", named "Start run" while idle; busy, its own words and no name; off Home "Start run" with no aria-label', async () => {
  const RunStart = await runStart();
  const home = submitOf(draw(RunStart, props({ compact: true })));
  assert.equal(textOf(home), "Start");
  assert.equal(home.attrs["aria-label"], "Start run");
  const page = submitOf(draw(RunStart, props()));
  assert.equal(textOf(page), "Start run");
  assert.equal(page.attrs["aria-label"], undefined);
  const item = submitOf(draw(RunStart, props({ itemPage: true, itemId: "i" })));
  assert.equal(textOf(item), "Start");
  assert.equal(item.attrs["aria-label"], undefined);
  // Uploading: Start held, its words "Uploading…", no name over them.
  const busy = await runStart({
    start: (source) =>
      source.replace("() => new Set(),", '() => new Set(["resume"]),'),
  });
  const held = submitOf(draw(busy, props({ compact: true })));
  assert.equal(textOf(held), "Uploading…");
  assert.ok("disabled" in held.attrs);
  assert.equal(held.attrs["aria-label"], undefined);
});

test("build 42, item 16 (e): before a pick the status line is there, empty, with no margin; once a file is ready it says so, under the row, with its margin", async () => {
  const status = (markup) =>
    nodes(markup).find((node) => node.attrs["aria-live"] === "polite");
  const RunStart = await runStart();
  const empty = status(draw(RunStart, props({ compact: true })));
  assert.equal(textOf(empty), "");
  assert.ok(!classes(empty).includes("mt-2"));
  // Off Home the line keeps its margin, as before.
  assert.ok(classes(status(draw(RunStart, props()))).includes("mt-2"));
  const ready = await runStart({
    field: (source) =>
      source.replace(
        '>({ kind: "empty" });',
        '>({ kind: "ready", artifactId: "a", name: "cv.pdf", sizeBytes: 2048 });',
      ),
  });
  const line = status(draw(ready, props({ compact: true })));
  assert.equal(textOf(line), "Ready: cv.pdf (2 KB)");
  assert.ok(classes(line).includes("mt-2"));
});

/** Home's YOUR FLOWS with one flow with jobs, its list read as `list` says. */
async function jobCard(list) {
  const { modules, cleanup } = await loadModules([YOUR_FLOWS], {
    stubs: {
      "./flows/RunStart": `import { jsx } from "react/jsx-runtime"; export function RunStart(props) { return jsx("form", { "data-testid": "run-form", "data-compact": String(props.compact === true) }); }`,
      "./flows/UploadItemCard": `export function UploadItemCard() { return null; }`,
    },
    mutate: (file, source) =>
      file === YOUR_FLOWS
        ? source.replace(
            'useState<ListItemsResponse | "failed">()',
            `useState<ListItemsResponse | "failed">(${JSON.stringify(list)})`,
          )
        : source,
  });
  loaded.push(cleanup);
  const flow = (id, extra) => ({
    id,
    name: `Flow ${id}`,
    category: "HR",
    icon: "UserPlus",
    runInput: ONE_FILE,
    items: null,
    startable: true,
    initialKey: `run-${id}`,
    ...extra,
  });
  const jobs = {
    words: { singular: "Job", plural: "Jobs" },
    groupField: "department",
    file: { key: "description", title: "Job description" },
    fields: [],
  };
  return draw(modules[YOUR_FLOWS].YourFlows, {
    workspaceId: "w",
    departments: [
      {
        department: "HR",
        id: "department-1",
        entries: [flow("res", { items: jobs }), flow("plain")],
      },
    ],
  });
}

const job = (id, title) => ({
  id,
  title,
  fields: {},
  status: "ready",
  runCount: 0,
  topScore: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  archivedAt: null,
});

test("build 42, item 16 (c): the job drop-down is a pill in the card's head, named Job for screen readers; Home's run forms are compact", async () => {
  const markup = await jobCard({ choices: {}, items: [job("j", "AI Intern")] });
  const card = byTestId(markup, "home-flow-res")[0];
  const head = elements(card).find(
    (node) => node.attrs["data-testid"] === "flow-card-head",
  );
  const pill = elements(head).find(
    (node) => node.attrs["data-testid"] === "home-job-res",
  );
  assert.ok(pill, "the job drop-down sits in the head");
  assert.match(pill.attrs.class, /\brounded-full\b/u, "the pill look");
  const name = nodes(markup).find(
    (node) => node.attrs.id === pill.attrs["aria-labelledby"],
  );
  assert.ok(classes(name).includes("sr-only"));
  assert.equal(textOf(name), "Job");
  assert.deepEqual(
    byTestId(markup, "run-form").map((form) => form.attrs["data-compact"]),
    ["true", "true"],
  );
});

test("build 42, item 16 (f): no ready job — No jobs yet. and Upload job in one row; Loading… inside the card", async () => {
  const markup = await jobCard({ choices: {}, items: [] });
  const [row] = byTestId(markup, "home-empty-res");
  for (const name of ["flex", "flex-wrap", "items-center"])
    assert.ok(classes(row).includes(name), name);
  assert.deepEqual(visibleWords(markupOf(row)), ["No jobs yet.", "Upload job"]);
  assert.ok(
    elements(row).some(
      (node) => node.attrs["data-testid"] === "home-upload-res",
    ),
  );
  const card = byTestId(markup, "home-flow-res")[0];
  assert.ok(
    elements(card).some(
      (node) => node.attrs["data-testid"] === "home-empty-res",
    ),
    "inside its card",
  );
  const loading = await jobCard(undefined);
  const loadingCard = byTestId(loading, "home-flow-res")[0];
  assert.ok(visibleWords(markupOf(loadingCard)).includes("Loading…"));
});

test("build 42, item 16 (g): a long job title truncates — Home's aside shrinks, at most half the row, its pill a block no wider than it; elsewhere the aside keeps its whole width", async () => {
  const title = "Senior Clinical Research Coordinator Cardiology and Oncology";
  assert.equal(title.length, 60);
  const markup = await jobCard({ choices: {}, items: [job("j", title)] });
  const card = byTestId(markup, "home-flow-res")[0];
  const aside = elements(card).find(
    (node) => node.attrs["data-testid"] === "flow-card-aside",
  );
  for (const name of ["min-w-0", "max-w-[50%]"])
    assert.ok(classes(aside).includes(name), name);
  assert.ok(!classes(aside).includes("shrink-0"), "it may shrink");
  // The pill's wrapper: a block capped at the aside, not a row of its own size.
  const wrapper = aside.children.find((node) => node.tag === "div");
  assert.ok(classes(wrapper).includes("max-w-full"));
  assert.ok(!classes(wrapper).includes("flex"), "a block, so the pill fits it");
  // The pill truncates its words; the name truncates beside it.
  const pill = elements(aside).find(
    (node) => node.attrs["data-testid"] === "home-job-res",
  );
  assert.match(pill.attrs.class, /\bmax-w-full\b/u);
  assert.ok(
    elements(pill).some(
      (node) => classes(node).includes("truncate") && textOf(node) === title,
    ),
  );
  const name = elements(card).find(
    (node) => node.attrs["data-testid"] === "flow-card-name",
  );
  assert.ok(classes(name).includes("truncate"));
  // The Flows page's card (not compact): its aside keeps its whole width.
  const { modules, cleanup } = await loadModules([
    "components/dashboard/FlowCard.tsx",
  ]);
  loaded.push(cleanup);
  const full = byTestId(
    draw(modules["components/dashboard/FlowCard.tsx"].FlowCard, {
      icon: "Receipt",
      name: "Invoices",
      aside: react.createElement("span", null, "Live"),
    }),
    "flow-card-aside",
  )[0];
  assert.ok(classes(full).includes("shrink-0"));
  assert.ok(!classes(full).includes("max-w-[50%]"));
});
