import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  CATEGORY,
  SEARCH_ALL,
  carriesGroups,
  choicesIn,
  groupsOf,
} from "../lib/choices.ts";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The owner's TestFlight build 34 feedback on the website (Round 21, stage 1,
 * C1; the same words and behaviour as the app): F1, a select whose choices
 * carry groups as a sheet in two steps.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const SHEET = "components/ui/ChoiceSheet.tsx";

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
async function load(path, mutate) {
  const { modules, cleanup } = await loadModules([path], {
    mutate: (file, source) =>
      mutate && file === path ? mutate(source) : source,
  });
  loaded.push(cleanup);
  return modules[path];
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));

const specialties = [
  { value: "207K00000X", label: "Allergy Physician", group: "Physicians" },
  { value: "207KA0200X", label: "Allergy & Immunology", group: "Physicians" },
  { value: "207RN0300X", label: "Nephrology", group: "Physicians" },
  { value: "363L00000X", label: "Nurse Practitioner", group: "Nursing" },
  { value: "363LA2100X", label: "Acute Care NP", group: "Nursing" },
];

/** The sheet's steps drawn with `group` and `query` as their first state. */
async function steps({ group = null, query = "", chosen = [] } = {}) {
  const { SheetSteps } = await load(SHEET, (source) =>
    source
      .replace(
        "useState<string | null>(null)",
        `useState<string | null>(${JSON.stringify(group)})`,
      )
      .replace(
        'useState("");\n  const back',
        `useState(${JSON.stringify(query)});\n  const back`,
      ),
  );
  const markup = draw(SheetSteps, {
    title: "Specialties",
    options: specialties,
    chosen,
    multiple: true,
    onChoose: () => {},
    onClose: () => {},
  });
  return { markup, tree: elements(parse(markup)) };
}

test("F1: the sheet's words, and its groups in the manifest's order", () => {
  assert.equal(CATEGORY, "Category");
  assert.equal(SEARCH_ALL, "Search all");
  assert.equal(carriesGroups(specialties), true);
  assert.equal(
    carriesGroups([{ value: "a", label: "A" }]),
    false,
    "a select without groups stays the drop-down",
  );
  assert.deepEqual(groupsOf(specialties), ["Physicians", "Nursing"]);
  assert.deepEqual(
    choicesIn(specialties, "Physicians", " allergy ").map(({ label }) => label),
    ["Allergy Physician", "Allergy & Immunology"],
  );
  assert.deepEqual(choicesIn(specialties, "Nursing", "nephro"), []);
});

test("F1: step 1 is the field's title, a Search all box, and its groups under Category — no choice drawn yet", async () => {
  const { markup, tree } = await steps();
  assert.deepEqual(visibleWords(markup), [
    "Specialties",
    "Category",
    "Physicians",
    "Nursing",
  ]);
  const search = tree.find((node) => node.tag === "input");
  assert.equal(search.attrs.placeholder, "Search all");
  assert.equal(search.attrs["aria-label"], "Search all");
  assert.equal(tree.filter((node) => node.attrs.role === "option").length, 0);
  const back = tree.find((node) => node.attrs["aria-label"] === "Back");
  assert.ok(back, "a way back");
});

test("F1: Search all finds choices in every group, under their headings; step 2 is one group's choices, its Search box over them alone", async () => {
  const all = await steps({ query: "a" });
  const groups = all.tree.filter((node) => node.attrs.role === "group");
  assert.equal(groups.length, 2);
  assert.ok(
    all.tree.find((node) => node.attrs.role === "listbox")?.attrs[
      "aria-multiselectable"
    ] === "true",
  );
  const found = await steps({ query: "nurse" });
  assert.deepEqual(
    found.tree
      .filter((node) => node.attrs.role === "option")
      .map((node) => node.attrs["data-value"]),
    ["363L00000X"],
  );

  const group = await steps({ group: "Physicians", chosen: ["207RN0300X"] });
  assert.deepEqual(visibleWords(group.markup), [
    "Physicians",
    "Allergy Physician",
    "Allergy & Immunology",
    "Nephrology",
  ]);
  const search = group.tree.find((node) => node.tag === "input");
  assert.equal(search.attrs.placeholder, "Search");
  const options = group.tree.filter((node) => node.attrs.role === "option");
  assert.deepEqual(
    options.map((node) => node.attrs["aria-selected"]),
    ["false", "false", "true"],
  );
  const filtered = await steps({ group: "Physicians", query: "IMMUN" });
  assert.deepEqual(visibleWords(filtered.markup), [
    "Physicians",
    "Allergy & Immunology",
  ]);
  const none = await steps({ group: "Nursing", query: "zzz" });
  assert.deepEqual(visibleWords(none.markup), ["Nursing", "No matches."]);
});

test("F1: the box says what is chosen and draws each pick as a chip; a select whose choices carry groups is the sheet, else the drop-down", async () => {
  const { ChoiceSheet } = await load(SHEET);
  const markup = draw(ChoiceSheet, {
    id: "config-specialties",
    labelledBy: "config-specialties-label",
    title: "Specialties",
    options: specialties,
    multiple: true,
    value: ["207RN0300X", "363L00000X"],
    onChange: () => {},
    testId: "select-specialties",
  });
  assert.deepEqual(visibleWords(markup), [
    "Nephrology, Nurse Practitioner",
    "Nephrology",
    "Nurse Practitioner",
  ]);
  const tree = elements(parse(markup));
  const box = tree.find((node) => node.attrs.id === "config-specialties");
  assert.equal(box.attrs["aria-haspopup"], "dialog");
  const chips = tree.find(
    (node) => node.attrs["data-testid"] === "select-specialties-chips",
  );
  assert.equal(chips.children.filter((child) => child.tag === "li").length, 2);
  const empty = draw(ChoiceSheet, {
    id: "x",
    labelledBy: "x-label",
    title: "Taxonomy",
    options: specialties,
    value: "",
    onChange: () => {},
  });
  assert.deepEqual(visibleWords(empty), ["Choose"]);

  const field = read("app/account/flows/SelectField.tsx");
  assert.match(field, /\{carriesGroups\(options\) \? \(/u);
});

const HOME_FLOWS = "app/account/home-flows.ts";

const entry = (templateId, name, category, extra = {}) => ({
  templateId,
  name,
  category,
  available: true,
  ...extra,
});
const flow = (id, templateId, extra = {}) => ({
  id,
  templateId,
  status: "live",
  runInput: [{ key: "file", title: "File", control: "artifact" }],
  ...extra,
});
const jobs = {
  words: { singular: "Job", plural: "Jobs" },
  groupField: "department",
};

test("F5: YOUR FLOWS is the live flows, in sections by department A–Z and A–Z in each, from the one list Home reads; a flow with items starts here only for an owner or admin", async () => {
  const { homeFlows, YOUR_FLOWS } = await load(HOME_FLOWS);
  assert.equal(YOUR_FLOWS, "Your flows");
  let keys = 0;
  const catalog = [
    entry("resume", "Resume Screening", "HR"),
    entry("invoice", "Invoice Processing", "Accounting"),
    entry("icd", "ICD-10 Code Check", "Healthcare"),
    entry("audit", "Audit Prep", "Accounting", { available: false }),
    entry("hook", "Webhook flow", "Accounting"),
  ];
  const subscriptions = [
    flow("s-resume", "resume", { items: jobs }),
    flow("s-invoice", "invoice"),
    flow("s-icd", "icd", { status: "paused" }),
    flow("s-audit", "audit"),
    flow("s-hook", "hook", { runInput: undefined }),
    flow("s-gone", "not-in-catalog"),
  ];
  const owner = homeFlows(subscriptions, catalog, true, () => `run-${++keys}`);
  assert.deepEqual(
    owner.map(({ department, entries }) => [
      department,
      entries.map((one) => [one.name, one.startable]),
    ]),
    [
      [
        "Accounting",
        [
          ["Audit Prep", false],
          ["Invoice Processing", true],
          ["Webhook flow", false],
        ],
      ],
      ["HR", [["Resume Screening", true]]],
    ],
  );
  assert.equal(owner[1].entries[0].items, jobs);
  assert.match(owner[0].entries[1].initialKey, /^run-\d+$/u);
  const member = homeFlows(subscriptions, catalog, false, () => "run-x");
  assert.equal(member[1].entries[0].startable, false);
  assert.equal(member[0].entries[1].startable, true);
});

test("F5: the job drop-down offers the ready jobs, not archived, under their department A–Z, A–Z in each", async () => {
  const { jobChoices } = await load(HOME_FLOWS);
  const item = (id, title, department, extra = {}) => ({
    id,
    title,
    fields: department ? { department } : {},
    status: "ready",
    runCount: 0,
    topScore: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    archivedAt: null,
    ...extra,
  });
  assert.deepEqual(
    jobChoices(
      [
        item("1", "Payroll Lead", "Finance"),
        item("2", "Accountant", "Finance"),
        item("3", "Nurse", "Clinic"),
        item("4", "Reading", "Clinic", { status: "reading" }),
        item("5", "Old", "Clinic", { archivedAt: "2026-10-01T00:00:00.000Z" }),
        item("6", "Intern", undefined),
      ],
      "department",
    ),
    [
      { value: "3", label: "Nurse", group: "Clinic" },
      { value: "2", label: "Accountant", group: "Finance" },
      { value: "1", label: "Payroll Lead", group: "Finance" },
      { value: "6", label: "Intern" },
    ],
  );
  assert.deepEqual(jobChoices([item("7", "Solo", "X")], undefined), [
    { value: "7", label: "Solo" },
  ]);
});

test("F5: a flow opens in place to its run's first step; a flow with items reads them only when opened, and a run of the job chosen there says Start run", () => {
  const rows = read("app/account/YourFlows.tsx");
  // The items' read is the opened panel's own, never the list's.
  const panel = rows.slice(rows.indexOf("function ItemRunStart("));
  assert.match(
    panel,
    /\/subscriptions\/\$\{encodeURIComponent\(flow\.id\)\}\/items/u,
  );
  assert.doesNotMatch(
    rows.slice(0, rows.indexOf("function ItemRunStart(")),
    /platformApiJson\(/u,
  );
  assert.match(rows, /\{open \? \(/u);
  const start = read("app/account/flows/RunStart.tsx");
  assert.match(start, /: itemPage\s*\? "Start"\s*: "Start run"/u);
});
