import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { COPIED, COPY, contactValue, copyValue } from "../lib/contact-value.ts";
import { runFace } from "../lib/run-progress.ts";
import {
  elements,
  loadBlocks,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The owner's TestFlight builds 37 and 39 on the website (the same words and
 * behaviour as the app): items 1 and 4, one flow card with its icon and no
 * metadata line; item 8 (with 2, 3 and 5), Home's YOUR FLOWS as a card per
 * flow under a department drop-down and a search box, a flow with items on
 * its newest ready job or "Upload job"; item 10, a run's steps first and its
 * metadata on Run details; item 11, an email or a phone pressable, with
 * Copy.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
/** A source without its comments: what it draws, never what it quotes. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

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

/** One module, loaded as written, or as `mutate` makes it (a bite, or a state). */
async function load(path, { mutate, stubs } = {}) {
  const { modules, cleanup } = await loadModules([path], {
    mutate: (file, source) =>
      mutate && file === path ? mutate(source) : source,
    stubs,
  });
  loaded.push(cleanup);
  return modules[path];
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const byTestId = (markup, id) =>
  elements(parse(markup)).filter((node) => node.attrs["data-testid"] === id);

const FLOW_CARD = "components/dashboard/FlowCard.tsx";
const ICONS = "lib/flow-icons.ts";
const HOME_FLOWS = "app/account/home-flows.ts";
const YOUR_FLOWS = "app/account/YourFlows.tsx";

test("items 1 and 4: a flow's icon by the catalog's name, the app's names; Sparkles is Sparkle; an unknown name or none the neutral icon", async () => {
  const { iconFor, FALLBACK_ICON } = await load(ICONS);
  const icons = await import("@phosphor-icons/react/dist/ssr");
  assert.equal(iconFor("UserPlus"), icons.UserPlusIcon);
  assert.equal(iconFor("Receipt"), icons.ReceiptIcon);
  assert.equal(iconFor(" Receipt "), icons.ReceiptIcon);
  // ICD-10's catalog name (manifests/icd10-code-check.v*.json).
  assert.equal(iconFor("Sparkles"), icons.SparkleIcon);
  assert.equal(iconFor("Sparkle"), icons.SparkleIcon);
  for (const unknown of ["NoSuchIcon", "", null, undefined])
    assert.equal(iconFor(unknown), FALLBACK_ICON, String(unknown));
  assert.equal(FALLBACK_ICON, icons.CircleDashedIcon);
  // The app's list, name for name (snoopy-mobile lib/view/icon-registry.ts).
  for (const name of [
    "ArrowClockwise",
    "BellRinging",
    "Camera",
    "ChartLine",
    "CheckCircle",
    "CircleDashed",
    "CrownSimple",
    "EnvelopeOpen",
    "EnvelopeSimple",
    "GitBranch",
    "HandPalm",
    "Lightning",
    "PlugsConnected",
    "Receipt",
    "SlackLogo",
    "Sparkle",
    "Table",
    "Timer",
    "Tray",
    "UserPlus",
    "UsersThree",
    "XCircle",
  ])
    assert.equal(iconFor(name), icons[`${name}Icon`], name);
});

test("items 1 and 4: the one flow card is its icon, its name, its short description and one thing at its end — never a line of metadata", async () => {
  const { FlowCard } = await load(FLOW_CARD);
  const markup = draw(FlowCard, {
    icon: "UserPlus",
    name: "Resume Screening",
    description: "Scores each resume against the job.",
    aside: react.createElement("span", null, "Live"),
  });
  assert.deepEqual(visibleWords(markup), [
    "Resume Screening",
    "Scores each resume against the job.",
    "Live",
  ]);
  assert.equal(byTestId(markup, "flow-card-icon").length, 1);
  assert.equal(
    byTestId(markup, "flow-card-icon")[0].children[0].tag,
    "svg",
    "the icon is drawn",
  );
  assert.equal(byTestId(markup, "flow-card-name")[0].tag, "h3");
  assert.doesNotMatch(markup, /Department|runs|ok ·|failed/u);
  // A row of a list: no card of its own; a heading one level down.
  const row = draw(FlowCard, {
    icon: "Receipt",
    name: "Invoice Processing",
    boxed: false,
    heading: "h4",
  });
  assert.doesNotMatch(row, /bubble/u);
  assert.equal(byTestId(row, "flow-card-name")[0].tag, "h4");
  assert.equal(byTestId(row, "flow-card-description").length, 0);
});

test("items 1 and 4: every place a flow is a card draws the one flow card — Flows' cards, its archived rows (no Department line) and Home's cards; a flow's page and its Set up keep Department under their title", () => {
  const flows = code(read("app/account/flows/page.tsx"));
  assert.equal(flows.match(/<FlowCard\b/gu)?.length, 2);
  assert.doesNotMatch(flows, /Department:|place\(|placeOf/u);
  assert.match(read(YOUR_FLOWS), /<FlowCard\b/u);
  // The owner's build 41, item 14: Home's card is compact — no description,
  // no Live.
  assert.match(code(read(YOUR_FLOWS)), /<FlowCard\b[^>]*\bcompact\b/u);
  assert.doesNotMatch(
    code(read(YOUR_FLOWS)),
    /\baside=|\bdescription=|StatusPill/u,
  );
  for (const page of [
    "app/account/flows/[subscriptionId]/page.tsx",
    "app/account/flows/[subscriptionId]/setup/page.tsx",
  ])
    assert.match(read(page), /placeOf\(/u, page);
});

const flow = (id, name, category, extra = {}) => ({
  id,
  name,
  category,
  icon: "Receipt",
  runInput: [{ key: "file", title: "File", control: "artifact" }],
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
const item = (id, title, extra = {}) => ({
  id,
  title,
  fields: {},
  status: "ready",
  runCount: 0,
  topScore: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  archivedAt: null,
  ...extra,
});

test("item 8: the department drop-down is All departments then the departments drawn A–Z; one chosen shows its section alone; the search keeps flows by name whatever its case; a section left empty is not drawn", async () => {
  const {
    ALL,
    ALL_DEPARTMENTS,
    DEPARTMENT,
    departmentChoices,
    shownFlows,
    homeFlows,
  } = await load(HOME_FLOWS);
  assert.equal(ALL_DEPARTMENTS, "All departments");
  assert.equal(DEPARTMENT, "Department");
  const departments = [
    {
      department: "Accounting",
      id: "department-1",
      entries: [flow("a", "Invoice Processing", "Accounting")],
    },
    {
      department: "HR",
      id: "department-2",
      entries: [
        flow("b", "Onboarding", "HR"),
        flow("c", "Resume Screening", "HR"),
      ],
    },
  ];
  assert.deepEqual(departmentChoices(departments), [
    { value: "", label: "All departments" },
    { value: "Accounting", label: "Accounting" },
    { value: "HR", label: "HR" },
  ]);
  const names = (shown) =>
    shown.map(({ department, entries }) => [
      department,
      entries.map((one) => one.name),
    ]);
  assert.deepEqual(names(shownFlows(departments, ALL, "")), [
    ["Accounting", ["Invoice Processing"]],
    ["HR", ["Onboarding", "Resume Screening"]],
  ]);
  assert.deepEqual(names(shownFlows(departments, "HR", "")), [
    ["HR", ["Onboarding", "Resume Screening"]],
  ]);
  assert.deepEqual(names(shownFlows(departments, ALL, "  RESUME ")), [
    ["HR", ["Resume Screening"]],
  ]);
  assert.deepEqual(names(shownFlows(departments, "Accounting", "resume")), []);
  // Each flow carries its card's icon, from the catalog; no description (the
  // owner's build 41, item 14: Home's card draws none).
  const [section] = homeFlows(
    [{ id: "s", templateId: "t", status: "live", runInput: [] }],
    [
      {
        templateId: "t",
        name: "Invoice Processing",
        category: "Accounting",
        icon: "Receipt",
        description: "Reads invoices.",
        available: true,
      },
    ],
    true,
    () => "run-1",
  );
  assert.equal(section.entries[0].icon, "Receipt");
  assert.equal("description" in section.entries[0], false);
});

test("item 5: a flow with items starts on the newest ready job not archived — the platform lists newest first — and on none when none is ready", async () => {
  const { newestReady } = await load(HOME_FLOWS);
  assert.equal(
    newestReady([
      item("1", "Reading one", { status: "reading" }),
      item("2", "Gone", { archivedAt: "2026-11-02T00:00:00.000Z" }),
      item("3", "AI Intern"),
      item("4", "Older"),
    ]),
    "3",
  );
  assert.equal(newestReady([item("1", "x", { status: "failed" })]), "");
  assert.equal(newestReady([]), "");
});

/** Home's YOUR FLOWS drawn, its run forms and upload card stood in for. */
async function yourFlows(mutate) {
  return load(YOUR_FLOWS, {
    mutate,
    stubs: {
      "./flows/RunStart": `import { jsx } from "react/jsx-runtime"; export function RunStart(props) { return jsx("form", { "data-testid": "run-form", "data-item": props.itemId ?? "", "data-from": props.from ?? "" }); }`,
      "./flows/UploadItemCard": `export function UploadItemCard() { return null; }`,
    },
  });
}

const sections = [
  {
    department: "Accounting",
    id: "department-1",
    entries: [flow("inv", "Invoice Processing", "Accounting")],
  },
  {
    department: "HR",
    id: "department-2",
    entries: [
      flow("res", "Resume Screening", "HR", { items: jobs }),
      flow("mem", "Member Flow", "HR", { items: jobs, startable: false }),
    ],
  },
];

test("item 8: YOUR FLOWS is its title and the department drop-down, the search box, then each department and its cards, always open — a flow without items its run form opening from the flow, a flow not startable here Open, a flow with items its job read as Home opens", async () => {
  const { YourFlows } = await yourFlows();
  const markup = draw(YourFlows, { workspaceId: "w", departments: sections });
  const words = visibleWords(markup);
  assert.deepEqual(words.slice(0, 2), ["Your flows", "All departments"]);
  const search = elements(parse(markup)).find(
    (node) => node.attrs["data-testid"] === "home-search",
  );
  assert.equal(search.attrs.placeholder, "Search flows");
  assert.ok(words.indexOf("Accounting") < words.indexOf("Invoice Processing"));
  assert.ok(words.indexOf("HR") < words.indexOf("Resume Screening"));
  // No row opens and closes: only the drop-down's own combobox expands.
  assert.deepEqual(
    elements(parse(markup))
      .filter((node) => "aria-expanded" in node.attrs)
      .map((node) => node.attrs.role),
    ["combobox"],
  );
  const runForms = byTestId(markup, "run-form");
  assert.deepEqual(
    runForms.map((form) => form.attrs["data-from"]),
    ["flow"],
    "a flow without items opens its run from the flow",
  );
  const member = byTestId(markup, "home-flow-mem")[0];
  const open = elements(member).find((node) => node.tag === "a");
  assert.equal(open.attrs.href, "/account/flows/mem");
  assert.equal(open.attrs["aria-label"], "Open Member Flow");
  // Its items are being read as Home opens.
  assert.ok(visibleWords(markup).includes("Loading…"));
});

test("item 8: a search that finds nothing says so in the platform's words", async () => {
  const { YourFlows } = await yourFlows((source) =>
    source.replace(
      'const [query, setQuery] = useState("");',
      'const [query, setQuery] = useState("zzz");',
    ),
  );
  const markup = draw(YourFlows, { workspaceId: "w", departments: sections });
  assert.ok(visibleWords(markup).includes('Nothing matches "zzz".'));
  assert.equal(byTestId(markup, "home-flow-inv").length, 0);
});

/** A flow with items on its card, its list read as `list` says. */
async function jobCard(list) {
  const { YourFlows } = await yourFlows((source) =>
    source.replace(
      'useState<ListItemsResponse | "failed">()',
      `useState<ListItemsResponse | "failed">(${JSON.stringify(list)})`,
    ),
  );
  const departments = [
    {
      department: "HR",
      id: "department-1",
      entries: [flow("res", "Resume Screening", "HR", { items: jobs })],
    },
  ];
  return draw(YourFlows, { workspaceId: "w", departments });
}

test("items 2, 3 and 5: a flow with items on Home — its newest ready job chosen already, still a drop-down, and the run form inside its card opening from that job; none ready, No jobs yet. and Upload job; a job being read, its line; a read that failed, Unavailable", async () => {
  const ready = await jobCard({
    choices: {},
    items: [
      item("new", "AI Intern"),
      item("old", "Accountant", { createdAt: "2026-10-01T00:00:00.000Z" }),
    ],
  });
  const trigger = byTestId(ready, "home-job-res")[0];
  assert.ok(trigger, "the job drop-down");
  assert.ok(visibleWords(ready).includes("AI Intern"));
  assert.ok(!visibleWords(ready).includes("Choose"));
  const [form] = byTestId(ready, "run-form");
  assert.equal(form.attrs["data-item"], "new");
  assert.equal(form.attrs["data-from"], "item");
  // The form sits inside its card (item 3: nothing cut off below it).
  const card = byTestId(ready, "home-flow-res")[0];
  assert.ok(
    elements(card).some((node) => node.attrs["data-testid"] === "run-form"),
  );

  const none = await jobCard({ choices: {}, items: [] });
  assert.ok(visibleWords(none).includes("No jobs yet."));
  const upload = byTestId(none, "home-upload-res")[0];
  assert.ok(upload, "Upload job");
  assert.ok(visibleWords(none).includes("Upload job"));
  assert.equal(byTestId(none, "run-form").length, 0);

  const reading = await jobCard({
    choices: {},
    items: [item("r", "AI Intern", { status: "reading" })],
  });
  const readingWords = visibleWords(reading);
  assert.ok(readingWords.includes("AI Intern"));
  assert.ok(readingWords.includes("· Reading…"));
  assert.ok(!readingWords.includes("No jobs yet."));
  assert.equal(byTestId(reading, "home-reading-res").length, 1);
  assert.equal(byTestId(reading, "home-upload-res").length, 1);

  const failed = await jobCard("failed");
  assert.ok(visibleWords(failed).includes("Unavailable"));
});

test("item 10: a run's face is its steps while it is pending, running or held, and once it failed or was cancelled; its result once it succeeded", () => {
  for (const status of ["pending", "running", "held", "failed", "cancelled"])
    assert.equal(runFace(status), "steps", status);
  assert.equal(runFace("succeeded"), "result");
});

test("item 11: a row's text that is one email or one phone, whole, is a way to reach someone; anything else is words", () => {
  assert.deepEqual(contactValue(" ada@example.com "), {
    kind: "email",
    value: "ada@example.com",
    href: "mailto:ada@example.com",
  });
  assert.deepEqual(contactValue("(415) 555-0132"), {
    kind: "phone",
    value: "(415) 555-0132",
    href: "tel:4155550132",
  });
  assert.deepEqual(contactValue("+44 20 7946 0958"), {
    kind: "phone",
    value: "+44 20 7946 0958",
    href: "tel:+442079460958",
  });
  assert.equal(contactValue("415.555.0132")?.href, "tel:4155550132");
  for (const words of [
    "Email ada@example.com",
    "ada@example.com, bob@example.com",
    "ada@example",
    "2019 - 2023",
    "2019-2023",
    "2024-01-15",
    "555-0132",
    "555-1234",
    "Call 415 555 0132",
    "1234567890123456",
    "",
    undefined,
    42,
  ])
    assert.equal(contactValue(words), null, String(words));
});

test("item 11: the phone and email table both clients share (snoopy-mobile's contact-value test holds the same rows): a number as people write one is a phone; a date, a time, an address or a short number is words", () => {
  const table = {
    phone: [
      "(214) 983-2568",
      "214-983-2568",
      "214.983.2568",
      "2149832568",
      "1-800-555-1234",
      "+44 20 7946 0958",
      "+1 214 983 2568",
    ],
    notPhone: [
      "555-1234",
      "2019-2023",
      "123-45-6789",
      "10.5.2025 14.30",
      "2025.11.06 12.00",
      "12.34.56.78",
      "192.168.10.100",
      "555 12 34",
      "12 34 56 78",
      "Call 214-983-2568",
    ],
    email: ["akulaggarwal05@gmail.com"],
    notEmail: ["a@b", "mail me at x@y.com"],
  };
  for (const text of table.phone)
    assert.equal(contactValue(text)?.kind, "phone", text);
  for (const text of table.email)
    assert.equal(contactValue(text)?.kind, "email", text);
  for (const text of [...table.notPhone, ...table.notEmail])
    assert.equal(contactValue(text), null, text);
});

test("item 11: a list row's email is a mailto: link and its phone a tel: link, each with Copy; Copy writes the value itself", async () => {
  const blocks = await loadBlocks();
  loaded.push(blocks.cleanup);
  const markup = blocks.render([
    {
      type: "list",
      items: [
        { title: "Email", text: "ada@example.com" },
        { title: "Phone", text: "(415) 555-0132" },
        { title: "Location", text: "Austin, TX" },
      ],
    },
  ]);
  const tree = elements(parse(markup));
  const links = tree.filter((node) => node.tag === "a");
  assert.deepEqual(
    links.map((node) => node.attrs.href),
    ["mailto:ada@example.com", "tel:4155550132"],
  );
  const copies = tree.filter(
    (node) => node.attrs["data-testid"] === "contact-copy",
  );
  assert.deepEqual(
    copies.map((node) => node.attrs["aria-label"]),
    ["Copy ada@example.com", "Copy (415) 555-0132"],
  );
  assert.deepEqual(visibleWords(markup), [
    "Email",
    "ada@example.com",
    COPY,
    "Phone",
    "(415) 555-0132",
    COPY,
    "Location",
    "Austin, TX",
  ]);
  assert.equal(COPIED, "Copied");
  const written = [];
  const clipboard = { writeText: async (text) => void written.push(text) };
  assert.equal(
    await copyValue(contactValue("(415) 555-0132"), clipboard),
    true,
  );
  assert.deepEqual(written, ["(415) 555-0132"]);
  const refused = {
    writeText: async () => {
      throw new Error("NotAllowedError");
    },
  };
  assert.equal(await copyValue(contactValue("a@b.co"), refused), false);
});

test("build 41, item 14: the flow card's compact face pads by the row steps (py-3 px-4), its head centred; without it the card's own p-4", async () => {
  const { FlowCard } = await load(FLOW_CARD);
  const classes = (props) =>
    byTestId(
      draw(FlowCard, { icon: "Receipt", name: "Invoices", ...props }),
      "flow-card",
    )[0].attrs.class.split(/\s+/u);
  const compact = classes({ compact: true });
  for (const name of ["bubble", "py-3", "px-4"])
    assert.ok(compact.includes(name), name);
  assert.ok(!compact.includes("p-4"));
  const full = classes({});
  assert.ok(full.includes("p-4"));
  for (const name of ["py-3", "px-4"]) assert.ok(!full.includes(name), name);
  const head = (props) =>
    elements(
      parse(draw(FlowCard, { icon: "Receipt", name: "Invoices", ...props })),
    )
      .find((node) => node.attrs["data-testid"] === "flow-card")
      .children.find((node) => node.tag === "div").attrs.class;
  assert.match(head({ compact: true }), /\bitems-center\b/u);
  assert.match(head({}), /\bitems-start\b/u);
});

test("build 41, item 14: Home's card is the flow's icon and name, then its start controls — no description, no Live, the compact card", async () => {
  const { YourFlows } = await yourFlows();
  const markup = draw(YourFlows, { workspaceId: "w", departments: sections });
  const cards = elements(parse(markup)).filter((node) =>
    /^home-flow-/u.test(node.attrs["data-testid"] ?? ""),
  );
  assert.ok(cards.length > 0);
  for (const card of cards) {
    assert.ok(
      card.attrs.class.split(/\s+/u).includes("py-3"),
      card.attrs["data-testid"],
    );
    assert.ok(!card.attrs.class.split(/\s+/u).includes("p-4"));
  }
  assert.equal(byTestId(markup, "flow-card-description").length, 0);
  assert.equal(byTestId(markup, "flow-card-icon").length, cards.length);
  assert.ok(!visibleWords(markup).some((word) => /^live$/iu.test(word)));
  assert.doesNotMatch(markup, /border-t border-\[var\(--ring\)\] pt-4/u);
});
