import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import {
  NO_MATCHES,
  SEARCH,
  SEARCH_ABOVE,
  choiceGroups,
  choicesOf,
} from "../lib/choices.ts";
import {
  CONNECTION_CONNECTED,
  connectionLine,
  connectionState,
  isKeyless,
  keylessProviders,
} from "../lib/connection-rows.ts";
import {
  REVIEW_LIMIT,
  offeredDecisions,
  reviewGroups,
} from "../lib/run-progress.ts";
import {
  FILES_AT_ONCE,
  TOO_MANY_FILES,
  filesSelected,
  perFileForms,
  runsStarted,
} from "../lib/several-files.ts";
import { TEAM_TYPES } from "../lib/team-types.ts";
import {
  loadModules,
  parse,
  elements,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * Round 21, platform round 2 (the client half of B1–B5): the bigger
 * drop-down, several files in one upload, a review grouped by its headings,
 * the Healthcare department and a connected app that needs no key — each
 * reusable, no flow named — and a plain drop-down, a single-file upload and a
 * plain review drawn as before.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const DROPDOWN = "components/ui/Dropdown.tsx";
const DECISION = "app/account/approvals/ApprovalDecision.tsx";
const FILE_FIELD = "app/account/flows/RunFileField.tsx";
const STUBS = {
  "@/app/account/flows/actions":
    "export const decideApproval = async () => ({ ok: true });",
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' });",
  "next/navigation":
    "export const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
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

/** The drop-down drawn open (its first state, `open`, made true). */
async function openDropdown(props, mutate = (source) => source) {
  const { Dropdown } = await load(DROPDOWN, (source) =>
    mutate(
      source.replace(
        "const [open, setOpen] = useState(false);",
        "const [open, setOpen] = useState(true);",
      ),
    ),
  );
  return parse(
    draw(Dropdown, {
      id: "pick",
      labelledBy: "pick-label",
      testId: "pick",
      value: "",
      onChange: () => {},
      ...props,
    }),
  );
}

const many = (count, group) =>
  Array.from({ length: count }, (_, at) => ({
    value: `v${at + 1}`,
    label: `Choice ${at + 1}`,
    ...(group ? { group: group(at) } : {}),
  }));

test("B1: a select's options are strings or {value, label, group}; the value is saved, the label said", () => {
  assert.deepEqual(choicesOf(["A", "B"]), [
    { value: "A", label: "A" },
    { value: "B", label: "B" },
  ]);
  assert.deepEqual(
    choicesOf([
      { value: "207RN0300X", label: "Nephrology", group: "Internal" },
      { value: "x", label: "No group" },
      { value: 3, label: "bad" },
      null,
    ]),
    [
      { value: "207RN0300X", label: "Nephrology", group: "Internal" },
      { value: "x", label: "No group" },
    ],
  );
  assert.deepEqual(choicesOf(undefined), []);
});

test("B1: the search keeps the labels that hold what is typed, ignoring case; the headings once each, in the order they first appear", () => {
  const choices = [
    { value: "a", label: "Alpha", group: "Second" },
    { value: "b", label: "Beta", group: "First" },
    { value: "c", label: "alphabet", group: "Second" },
  ];
  assert.deepEqual(
    choiceGroups(choices).map(({ group, choices: list }) => [
      group,
      list.map((choice) => choice.value),
    ]),
    [
      ["Second", ["a", "c"]],
      ["First", ["b"]],
    ],
  );
  assert.deepEqual(
    choiceGroups(choices, "  ALPHA ").map(({ choices: list }) =>
      list.map((choice) => choice.value),
    ),
    [["a", "c"]],
  );
  assert.deepEqual(choiceGroups(choices, "zeta"), []);
  // Strings only: one run with no heading, as before.
  assert.deepEqual(choiceGroups(choicesOf(["A", "B"])), [
    {
      group: null,
      choices: [
        { value: "A", label: "A" },
        { value: "B", label: "B" },
      ],
    },
  ]);
  assert.equal(SEARCH, "Search");
  assert.equal(NO_MATCHES, "No matches.");
  assert.equal(SEARCH_ABOVE, 10);
});

test('B1: more than 10 choices open on a search box ("Search") over the listbox; a plain one of 10 or fewer has none, and is the listbox of options as before', async () => {
  const big = elements(await openDropdown({ options: many(11) }));
  const search = big.find(
    (node) => node.attrs["data-testid"] === "pick-search",
  );
  assert.ok(search, "a search box");
  assert.equal(search.attrs.placeholder, "Search");
  assert.equal(search.attrs.type, "search");
  assert.equal(big.filter((node) => node.attrs.role === "option").length, 11);

  const plain = elements(await openDropdown({ options: many(10) }));
  assert.equal(
    plain.filter((node) => node.attrs["data-testid"] === "pick-search").length,
    0,
  );
  const listbox = plain.find((node) => node.attrs.role === "listbox");
  assert.ok(listbox);
  assert.deepEqual(
    listbox.children.map((child) => child.attrs.role),
    Array(10).fill("option"),
  );
  assert.equal(plain.filter((node) => node.attrs.role === "group").length, 0);
});

test("B1: choices with a group are drawn under its heading, in the manifest's order", async () => {
  const tree = await openDropdown({
    options: many(4, (at) => (at % 2 === 0 ? "Even" : "Odd")),
  });
  const groups = elements(tree).filter((node) => node.attrs.role === "group");
  assert.deepEqual(
    groups.map((group) => wordsOf(group)),
    [
      ["Even", "Choice 1", "Choice 3"],
      ["Odd", "Choice 2", "Choice 4"],
    ],
  );
});

test("B1: the closed trigger says labels, never values", async () => {
  const { Dropdown } = await load(DROPDOWN);
  const options = [
    { value: "207RN0300X", label: "Nephrology" },
    { value: "207RC0000X", label: "Cardiology" },
  ];
  const one = draw(Dropdown, {
    id: "pick",
    labelledBy: "l",
    options,
    value: "207RN0300X",
    onChange: () => {},
  });
  assert.deepEqual(visibleWords(one), ["Nephrology"]);
  const several = draw(Dropdown, {
    id: "pick",
    labelledBy: "l",
    options,
    multiple: true,
    value: ["207RC0000X", "207RN0300X"],
    onChange: () => {},
  });
  assert.deepEqual(visibleWords(several), ["Cardiology, Nephrology"]);
  // Set up hands the drop-down the manifest's options read as choices.
  assert.match(
    read("app/account/flows/ManifestFields.tsx"),
    /options=\{choicesOf\(field\.options\)\}/u,
  );
});

test('B2: several files are one form per file, the same other inputs, one key each; one file, none or a plain form is the one form as before; "{n} files selected", "{n} runs started", at most 200', () => {
  const form = new FormData();
  form.append("subscriptionId", "s1");
  form.append("idempotencyKey", "run-0123456789abcdef");
  form.append("input-control:note", "text");
  form.append("input:note", "same");
  form.append("input-control:scans", "artifact-multiple");
  form.append("input:scans", "f1");
  form.append("input:scans", "f2");
  form.append("input:scans", "f3");
  const forms = perFileForms(form);
  assert.equal(forms.length, 3);
  assert.deepEqual(
    forms.map((one) => [
      one.get("idempotencyKey"),
      one.getAll("input:scans"),
      one.get("input-control:scans"),
      one.get("input:note"),
      one.get("subscriptionId"),
    ]),
    [1, 2, 3].map((n) => [
      `run-0123456789abcdef.${n}`,
      [`f${n}`],
      "artifact",
      "same",
      "s1",
    ]),
  );
  // Each key the start-run action takes.
  for (const one of forms)
    assert.match(one.get("idempotencyKey"), /^[A-Za-z0-9._~:-]{16,128}$/u);

  const single = new FormData();
  single.append("idempotencyKey", "run-0123456789abcdef");
  single.append("input-control:scan", "artifact");
  single.append("input:scan", "f1");
  assert.deepEqual(perFileForms(single), [single]);

  const oneOfSeveral = new FormData();
  oneOfSeveral.append("idempotencyKey", "run-0123456789abcdef");
  oneOfSeveral.append("input-control:scans", "artifact-multiple");
  oneOfSeveral.append("input:scans", "f1");
  const [only, ...rest] = perFileForms(oneOfSeveral);
  assert.equal(rest.length, 0);
  assert.equal(only.get("idempotencyKey"), "run-0123456789abcdef");
  assert.equal(only.get("input-control:scans"), "artifact");
  assert.deepEqual(only.getAll("input:scans"), ["f1"]);

  assert.equal(filesSelected(3), "3 files selected");
  assert.equal(runsStarted(3), "3 runs started");
  assert.equal(FILES_AT_ONCE, 200);
  assert.equal(TOO_MANY_FILES, "Add up to 200 files at a time.");
});

test("B2: a field of several files lets the chooser take several and posts artifact-multiple; a field of one is drawn as before; Start run calls startRun once per file", async () => {
  const { RunFileField } = await load(FILE_FIELD);
  const field = (extra) => ({
    key: "scans",
    title: "Scans",
    control: "artifact",
    required: true,
    ...extra,
  });
  const props = {
    workspaceId: "w",
    subscriptionId: "s",
    onBusyChange: () => {},
  };
  const nodes = (markup) => elements(parse(markup));
  const several = nodes(
    draw(RunFileField, { ...props, field: field({ multiple: true }) }),
  );
  const chooser = several.find((node) => node.attrs.type === "file");
  assert.ok("multiple" in chooser.attrs, "the chooser takes several");
  assert.equal(
    several.find((node) => node.attrs.name === "input-control:scans").attrs
      .value,
    "artifact-multiple",
  );
  const one = nodes(draw(RunFileField, { ...props, field: field() }));
  assert.ok(
    !("multiple" in one.find((node) => node.attrs.type === "file").attrs),
  );
  assert.equal(
    one.find((node) => node.attrs.name === "input-control:scans").attrs.value,
    "artifact",
  );

  // More than 200 is refused before anything is sent.
  const source = read(FILE_FIELD);
  assert.match(
    source,
    /if \(kept\.length \+ chosen\.length > FILES_AT_ONCE\) \{[\s\S]*?TOO_MANY_FILES/u,
  );
  // Start run: one startRun per file's form, the count said once started.
  const start = read("app/account/flows/RunStart.tsx");
  assert.match(start, /const forms = perFileForms\(data\);/u);
  assert.match(
    start,
    /for \(const form of forms\) \{\s*const result = await startRun\(form\);/u,
  );
  assert.match(start, /\{runsStarted\(started\)\}/u);
});

const groupedFixture = BLOCK_FIXTURES.find(
  (fixture) => fixture.name === "review-held-grouped",
);

test("B3: a review's changes keep their group, up to 400, under each heading once, in the order sent", () => {
  assert.equal(REVIEW_LIMIT, 400);
  const changes = Array.from({ length: 401 }, (_, at) => ({
    id: `c-${at}`,
    label: `Change ${at}`,
    group: at < 2 ? "Visit 2" : "Visit 1",
  }));
  const offered = offeredDecisions({ decisions: changes });
  assert.equal(offered.length, 400);
  assert.deepEqual(offered[0], {
    id: "c-0",
    label: "Change 0",
    group: "Visit 2",
  });
  assert.deepEqual(
    reviewGroups(offered).map(({ group, changes: list }) => [
      group,
      list.length,
    ]),
    [
      ["Visit 2", 2],
      ["Visit 1", 398],
    ],
  );
  // A plain review: one run, no heading.
  assert.deepEqual(
    reviewGroups([{ id: "a", label: "A" }]).map(({ group }) => group),
    [null],
  );
});

test("B3: the review form draws each heading over its changes, every group open, and Save review waits for every answer", async () => {
  const { ApprovalDecision } = await load(DECISION);
  const decisions = groupedFixture.blocks.at(-1).form.decisions;
  const markup = draw(ApprovalDecision, {
    approvalId: "a",
    canDecide: true,
    eligibleRoles: ["owner"],
    workspaceId: "w",
    decisions,
  });
  const nodes = elements(parse(markup));
  const groups = nodes.filter(
    (node) => node.attrs["data-testid"] === "review-group",
  );
  assert.deepEqual(
    groups.map((group) =>
      wordsOf(group).filter((word) => word !== "Accept" && word !== "Deny"),
    ),
    [
      [
        "Visit 1 · Oct 1",
        "Line A1 → Add",
        "Line A2 → Remove · Not in the note.",
      ],
      ["Visit 2 · Oct 3", "Line B1 → Keep"],
    ],
  );
  assert.ok(
    nodes.every((node) => node.tag !== "details"),
    "every group open",
  );
  const save = nodes.find(
    (node) => node.tag === "button" && wordsOf(node)[0] === "Save review",
  );
  assert.ok("disabled" in save.attrs, "Save review waits for every answer");

  // A plain review: the one list, no heading, as before.
  const plain = elements(
    parse(
      draw(ApprovalDecision, {
        approvalId: "a",
        canDecide: true,
        eligibleRoles: ["owner"],
        workspaceId: "w",
        decisions: [{ id: "a", label: "A" }],
      }),
    ),
  );
  assert.equal(
    plain.filter((node) => node.attrs["data-testid"] === "review-group").length,
    0,
  );
  assert.equal(plain.filter((node) => node.tag === "h3").length, 0);
});

test("B3: where no form is drawn (ReviewRows), the changes are drawn under their headings too; a plain review's rows as before", async () => {
  const { BlockList } = await load("components/blocks/BlockList.tsx");
  const nodes = elements(
    parse(draw(BlockList, { blocks: groupedFixture.blocks })),
  );
  const groups = nodes.filter(
    (node) => node.attrs["data-testid"] === "block-review-group",
  );
  assert.deepEqual(
    groups.map((group) => wordsOf(group)),
    [
      [
        "Visit 1 · Oct 1",
        "Line A1 → Add",
        "Line A2 → Remove",
        "Not in the note.",
      ],
      ["Visit 2 · Oct 3", "Line B1 → Keep"],
    ],
  );
  const waiting = BLOCK_FIXTURES.find(
    (fixture) => fixture.name === "review-held-waiting",
  );
  const plain = elements(parse(draw(BlockList, { blocks: waiting.blocks })));
  const rows = plain.find(
    (node) => node.attrs["data-testid"] === "block-review-rows",
  );
  assert.equal(rows.tag, "ul");
  assert.equal(
    plain.filter((node) => node.attrs["data-testid"] === "block-review-group")
      .length,
    0,
  );
});

test("B4: the departments are the platform's seventeen, Healthcare last", () => {
  assert.equal(TEAM_TYPES.length, 17);
  assert.equal(TEAM_TYPES.at(-1), "Healthcare");
});

test("B5: a connected app whose authType is none is connected for every workspace, says Connected, and offers no Connect; Set up draws no Connect step for it", () => {
  assert.equal(isKeyless("none"), true);
  assert.equal(isKeyless("oauth2"), false);
  assert.equal(isKeyless(undefined), false);
  assert.equal(connectionState(undefined, "none"), "connected");
  assert.equal(connectionState(undefined, "oauth2"), "not-connected");
  assert.equal(connectionState(undefined), "not-connected");
  assert.deepEqual(connectionLine(undefined, "none"), {
    text: CONNECTION_CONNECTED,
    tone: "muted",
  });
  assert.deepEqual(connectionLine(undefined, "api-key"), {
    text: "Not connected",
    tone: "muted",
  });
  const panel = read("app/account/connections/ConnectionsPanel.tsx");
  assert.match(panel, /const keyless = isKeyless\(provider\.authType\);/u);
  assert.match(panel, /!canManage \|\| keyless \? null :/u);
  const setup = read("app/account/flows/[subscriptionId]/setup/page.tsx");
  assert.match(
    setup,
    /return provider && !isKeyless\(provider\.authType\) \? \[provider\] : \[\];/u,
  );
  for (const page of [
    setup,
    read("app/account/flows/[subscriptionId]/vendor/page.tsx"),
  ])
    assert.match(page, /authType: provider\?\.authType,/u);
});

test("B5: the platform's publicProviders join the one provider list as keyless rows, which every page reads as connected", () => {
  const nppes = {
    providerId: "nppes",
    displayName: "NPI Registry",
    description: "Looks up a clinician by NPI.",
    icon: "IdentificationCard",
  };
  assert.deepEqual(keylessProviders([nppes]), [
    { ...nppes, scopes: [], authType: "none" },
  ]);
  assert.deepEqual(keylessProviders(undefined), []);
  const [row] = keylessProviders([nppes]);
  assert.equal(connectionState(undefined, row.authType), "connected");
  const connections = read("lib/connections.ts");
  assert.match(
    connections,
    /\.\.\.body\.providers,\s*\.\.\.keylessProviders\(body\.publicProviders\),?\s*\]/u,
  );
});

/** A parsed node's words, in reading order, as `visibleWords` reads them: words only a screen reader hears left out. */
function wordsOf(node) {
  if (node.text !== undefined) {
    const text = node.text.trim();
    return text ? [text] : [];
  }
  if ((node.attrs.class ?? "").split(/\s+/u).includes("sr-only")) return [];
  return node.children.flatMap(wordsOf);
}
