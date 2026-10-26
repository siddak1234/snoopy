import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_GROUPS,
  COULD_NOT_READ,
  OTHER,
  OTHER_CHOICE,
  READING,
  archiveLabel,
  canAddRun,
  firstChoice,
  groupChoices,
  groupItems,
  inSentence,
  itemFieldValues,
  itemGoing,
  itemLine,
  itemPath,
  itemSubheader,
  noneYet,
  pluralOf,
  problemFields,
  selectChoices,
  uploadLabel,
} from "../lib/flow-items.ts";

/**
 * A flow's items as the website draws them (Round 19, plan §5; backend
 * ADR-0046): every word from the platform, the grouping and its order, the
 * select with "Other" and the values typed before, and when an item's page
 * offers its run form. The fixtures are made-up: no flow's words. ~~The
 * ranked runs and a section's links~~ until Round 21 (backend ADR-0048): the
 * platform sends them as blocks, and its tests hold their words
 * (`test/blocks-render.test.mjs` draws them).
 */

const words = { singular: "Batch", plural: "Batches" };
const runWords = { singular: "Entry", plural: "Entries" };
const area = {
  key: "area",
  title: "Area",
  control: "select",
  options: ["North", "South"],
  allowOther: true,
  defaultValue: "North",
  required: true,
};
const name = { key: "name", title: "Name", control: "text", required: true };

function item(id, areaValue, createdAt, rest = {}) {
  return {
    id,
    title: id,
    fields: areaValue ? { area: areaValue, name: id } : { name: id },
    status: "ready",
    runCount: 0,
    topScore: null,
    createdAt,
    ...rest,
  };
}

test("every word for the items is the platform's, inside a sentence where it falls there", () => {
  assert.equal(uploadLabel(words), "Upload batch");
  assert.equal(archiveLabel(words), "Archive batch");
  assert.equal(noneYet(words), "No batches yet.");
  assert.equal(noneYet(runWords), "No entries yet.");
  // A word in capitals keeps them.
  assert.equal(inSentence("NDA"), "NDA");
  assert.equal(uploadLabel({ singular: "NDA", plural: "NDAs" }), "Upload NDA");
  assert.equal(itemPath("s 1", "i/2"), "/account/flows/s%201/items/i%2F2");
});

test("items group by the group field: the groups A–Z, options and typed values alike, then none; rows A–Z by title in each (build 28, items 2 and 3)", () => {
  // The platform's order (newest first) and the options' order, which an
  // A–Z sort changes: North is the first option, South made first.
  const items = [
    item("winter", "North", "2026-08-12T10:00:00Z"),
    item("harbour", "Coastal", "2026-08-12T08:00:00Z"),
    item("autumn", "North", "2026-08-12T11:00:00Z"),
    item("spring", "South", "2026-08-12T13:00:00Z"),
    item("bay", "anchorage", "2026-08-12T07:00:00Z"),
    item("loose", undefined, "2026-08-12T12:00:00Z"),
    item("idle", undefined, "2026-08-12T14:00:00Z"),
  ];
  const groups = groupItems(items, area);
  assert.deepEqual(
    groups.map((group) => [group.title, group.items.map((each) => each.id)]),
    [
      // A–Z whatever their case, an option or a typed value alike.
      ["anchorage", ["bay"]],
      ["Coastal", ["harbour"]],
      ["North", ["autumn", "winter"]],
      ["South", ["spring"]],
      [null, ["idle", "loose"]],
    ],
  );
  // Two of the same title keep the platform's order.
  assert.deepEqual(
    groupItems(
      [
        item("b", "North", "2026-08-12T10:00:00Z", { title: "Same" }),
        item("a", "North", "2026-08-12T11:00:00Z", { title: "Same" }),
      ],
      area,
    )[0].items.map((each) => each.id),
    ["b", "a"],
  );
  // An option with no item draws no group; no group field is one group, A–Z.
  assert.deepEqual(
    groupItems([item("spring", "South", "2026-08-12T09:00:00Z")], area).map(
      (group) => group.title,
    ),
    ["South"],
  );
  assert.deepEqual(
    groupItems(items, undefined).map((group) => [
      group.title,
      group.items.map((each) => each.id),
    ]),
    [[null, ["autumn", "bay", "harbour", "idle", "loose", "spring", "winter"]]],
  );
  assert.deepEqual(groupItems([], area), []);
});

test("the group filter: All {field, many} first, then each value the items carry A–Z, each held by its words; a choice keeps its group alone (build 28, items 2 and 3)", () => {
  const items = [
    item("winter", "North", "2026-08-12T10:00:00Z"),
    item("harbour", "Coastal", "2026-08-12T08:00:00Z"),
    item("autumn", "North", "2026-08-12T11:00:00Z"),
    item("loose", undefined, "2026-08-12T12:00:00Z"),
  ];
  // South is an option no item carries: not offered.
  assert.deepEqual(groupChoices(items, area), [
    { value: ALL_GROUPS, label: "All areas" },
    { value: "group:Coastal", label: "Coastal" },
    { value: "group:North", label: "North" },
  ]);
  assert.deepEqual(
    groupItems(items, area, "group:North").map((group) => [
      group.title,
      group.items.map((each) => each.id),
    ]),
    [["North", ["autumn", "winter"]]],
  );
  // All, or a group no item carries now (its last one archived): every group.
  for (const chosen of [ALL_GROUPS, "group:South", "North"])
    assert.deepEqual(
      groupItems(items, area, chosen).map((group) => group.title),
      ["Coastal", "North", null],
      chosen,
    );
  // A value typed as "all" is a group, never All.
  assert.deepEqual(
    groupChoices([item("x", "all", "2026-08-12T10:00:00Z")], area).map(
      (choice) => choice.value,
    ),
    [ALL_GROUPS, "group:all"],
  );
});

test("a field's title for many, inside a sentence: departments, areas, categories, statuses", () => {
  assert.equal(pluralOf("Department"), "departments");
  assert.equal(pluralOf("Area"), "areas");
  assert.equal(pluralOf("Category"), "categories");
  assert.equal(pluralOf("Day"), "days");
  assert.equal(pluralOf("Status"), "statuses");
  assert.equal(pluralOf("Branch"), "branches");
  assert.equal(pluralOf("NDA"), "NDAs");
});

test("a row says Reading…, Couldn't read, or its runs and the best score in the flow's words", () => {
  assert.equal(
    itemLine(item("a", "North", "x", { status: "reading" }), runWords),
    READING,
  );
  assert.equal(
    itemLine(item("a", "North", "x", { status: "failed" }), runWords),
    COULD_NOT_READ,
  );
  assert.equal(
    itemLine(item("a", "North", "x", { runCount: 4, topScore: 86 }), runWords),
    "4 entries · Top 86",
  );
  assert.equal(
    itemLine(item("a", "North", "x", { runCount: 1, topScore: 0 }), runWords),
    "1 entry · Top 0",
  );
  assert.equal(itemLine(item("a", "North", "x"), runWords), "0 entries");
});

test("an item's page says its group and where it is: Ready, Reading…, why it was not read, or Archived", () => {
  assert.equal(itemSubheader(item("a", "South", "x"), "area"), "South · Ready");
  assert.equal(
    itemSubheader(item("a", "South", "x", { status: "reading" }), "area"),
    "South · Reading…",
  );
  assert.equal(
    itemSubheader(
      item("a", "South", "x", {
        status: "failed",
        failureReason: "No text.",
      }),
      "area",
    ),
    "South · Couldn't read: No text.",
  );
  assert.equal(
    itemSubheader(item("a", "South", "x", { archivedAt: "y" }), "area"),
    "South · Archived",
  );
  assert.equal(itemSubheader(item("a", "South", "x"), undefined), "Ready");
});

test("Other: a select offers its options, then the values typed before that are not among them, then Other; a field without allowOther offers its options alone", () => {
  assert.deepEqual(selectChoices(area, ["Coastal", "North", "Inland"]), [
    { value: "option:0", label: "North" },
    { value: "option:1", label: "South" },
    { value: "saved:Coastal", label: "Coastal" },
    { value: "saved:Inland", label: "Inland" },
    { value: OTHER_CHOICE, label: OTHER },
  ]);
  assert.deepEqual(
    selectChoices({ ...area, allowOther: false }, ["Coastal"]).map(
      (choice) => choice.label,
    ),
    ["North", "South"],
  );
  // Held by place: an option that reads "Other" is not the choice "Other".
  const literal = { ...area, options: ["Other"] };
  assert.deepEqual(
    selectChoices(literal, []).map((choice) => choice.value),
    ["option:0", OTHER_CHOICE],
  );
  assert.equal(firstChoice(area), "option:0");
  assert.equal(firstChoice({ ...area, defaultValue: undefined }), "");
});

test("Other: what is sent is the option, the saved value, or what was typed for Other, trimmed; an empty value is left out", () => {
  const saved = { area: ["Coastal"] };
  assert.deepEqual(
    itemFieldValues(
      [area, name],
      saved,
      { area: "option:1" },
      { name: "  Spring intake " },
    ),
    { area: "South", name: "Spring intake" },
  );
  assert.deepEqual(
    itemFieldValues(
      [area, name],
      saved,
      { area: "saved:Coastal" },
      { name: "A" },
    ),
    { area: "Coastal", name: "A" },
  );
  // A typed value is the field's value, saved by the platform and offered
  // again (`choices`) — the owner's "save that name".
  assert.deepEqual(
    itemFieldValues(
      [area, name],
      saved,
      { area: OTHER_CHOICE },
      { area: " Inland ", name: "A" },
    ),
    { area: "Inland", name: "A" },
  );
  // Typed text is ignored unless Other is chosen.
  assert.deepEqual(
    itemFieldValues(
      [area, name],
      saved,
      { area: "option:0" },
      { area: "Inland", name: "A" },
    ),
    { area: "North", name: "A" },
  );
  assert.deepEqual(
    itemFieldValues([area, name], saved, { area: "" }, { name: " " }),
    {},
  );
});

test("a saved value is held by its words: a name typed meanwhile that sorts ahead of it, read while the card is open, never changes what is sent (Round 19 review, finding 1)", () => {
  // Picked from the list the card opened with…
  const pick = selectChoices(area, ["Coastal", "Inland"]).find(
    (choice) => choice.label === "Inland",
  );
  assert.ok(pick);
  // …and sent after a re-read in which "Delta" joined ahead of it.
  assert.deepEqual(
    itemFieldValues(
      [area, name],
      { area: ["Coastal", "Delta", "Inland"] },
      { area: pick.value },
      { name: "A" },
    ),
    { area: "Inland", name: "A" },
  );
  // Still the same words when the list no longer holds it at all.
  assert.deepEqual(
    itemFieldValues([area, name], { area: [] }, { area: pick.value }, {}),
    { area: "Inland" },
  );
});

test("Add is offered only where a run can start: an owner or admin, the item ready and not archived, the flow live, answering and declaring a run file (Round 19 review, finding 3)", () => {
  const can = {
    canManage: true,
    item: { status: "ready", archivedAt: null },
    live: true,
    available: true,
    runInputs: 1,
  };
  assert.equal(canAddRun(can), true);
  for (const [why, change] of [
    ["a member", { canManage: false }],
    ["still being read", { item: { status: "reading", archivedAt: null } }],
    ["not read", { item: { status: "failed", archivedAt: null } }],
    ["archived", { item: { status: "ready", archivedAt: "2026-08-02" } }],
    ["the flow off", { live: false }],
    ["the flow not answering", { available: false }],
    ["no run file", { runInputs: 0 }],
  ])
    assert.equal(canAddRun({ ...can, ...change }), false, why);
});

test("an item's page is read again while it, or one of its runs, is going", () => {
  assert.equal(itemGoing({ status: "reading" }, []), true);
  assert.equal(itemGoing({ status: "ready" }, [{ status: "pending" }]), true);
  assert.equal(itemGoing({ status: "ready" }, [{ status: "running" }]), true);
  assert.equal(
    itemGoing({ status: "ready" }, [
      { status: "succeeded" },
      { status: "failed" },
    ]),
    false,
  );
  assert.equal(itemGoing({ status: "failed" }, []), false);
});

test("a refused item names its fields from the platform's problems, and nothing else", () => {
  const fields = [area, name];
  assert.deepEqual(
    problemFields(
      [
        { path: "fields.name", message: "is required" },
        { path: "area", message: "too long" },
        { path: "fields.other", message: "x" },
        { message: "no path" },
        "text",
      ],
      fields,
    ),
    ["name", "area"],
  );
  assert.deepEqual(problemFields(undefined, fields), []);
  assert.deepEqual(problemFields({ path: "name" }, fields), []);
});
