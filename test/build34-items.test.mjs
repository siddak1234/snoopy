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
