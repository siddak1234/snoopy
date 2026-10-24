import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COULD_NOT_READ,
  OTHER,
  OTHER_CHOICE,
  READING,
  addRunLabel,
  archiveLabel,
  firstChoice,
  groupItems,
  inSentence,
  itemFieldValues,
  itemGoing,
  itemLine,
  itemPath,
  itemSubheader,
  noneYet,
  problemFields,
  rankedRows,
  sectionLink,
  selectChoices,
  uploadLabel,
} from "../lib/flow-items.ts";

/**
 * A flow's items as the website draws them (Round 19, plan §5; backend
 * ADR-0046): every word from the platform, the grouping and its order, the
 * select with "Other" and the values typed before, the ranked runs, and the
 * links a section may hold. The fixtures are made-up: no flow's words.
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
  assert.equal(addRunLabel(runWords), "Add entry");
  assert.equal(archiveLabel(words), "Archive batch");
  assert.equal(noneYet(words), "No batches yet.");
  assert.equal(noneYet(runWords), "No entries yet.");
  // A word in capitals keeps them.
  assert.equal(inSentence("NDA"), "NDA");
  assert.equal(uploadLabel({ singular: "NDA", plural: "NDAs" }), "Upload NDA");
  assert.equal(itemPath("s 1", "i/2"), "/account/flows/s%201/items/i%2F2");
});

test("items group by the group field: its options' order, then typed values A–Z, then none; newest first in each", () => {
  const items = [
    item("winter", "North", "2026-08-12T10:00:00Z"),
    item("harbour", "Coastal", "2026-08-12T08:00:00Z"),
    item("autumn", "North", "2026-08-12T11:00:00Z"),
    item("spring", "South", "2026-08-12T09:00:00Z"),
    item("bay", "anchorage", "2026-08-12T07:00:00Z"),
    item("loose", undefined, "2026-08-12T12:00:00Z"),
  ];
  const groups = groupItems(items, area);
  assert.deepEqual(
    groups.map((group) => [group.title, group.items.map((each) => each.id)]),
    [
      ["North", ["autumn", "winter"]],
      ["South", ["spring"]],
      // Typed values after the options, A–Z whatever their case.
      ["anchorage", ["bay"]],
      ["Coastal", ["harbour"]],
      [null, ["loose"]],
    ],
  );
  // An option with no item draws no group; no group field is one group.
  assert.deepEqual(
    groupItems([item("spring", "South", "2026-08-12T09:00:00Z")], area).map(
      (group) => group.title,
    ),
    ["South"],
  );
  assert.deepEqual(
    groupItems(items, undefined).map((group) => [
      group.title,
      group.items[0].id,
    ]),
    [[null, "loose"]],
  );
  assert.deepEqual(groupItems([], area), []);
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
    { value: "saved:0", label: "Coastal" },
    { value: "saved:2", label: "Inland" },
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
    itemFieldValues([area, name], saved, { area: "saved:0" }, { name: "A" }),
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

test("an item's runs keep the platform's ranking, numbered 1…n: the title or Reading…, the score, the result line, a failure dimmed", () => {
  const rows = rankedRows([
    {
      id: "a",
      status: "succeeded",
      title: "Ada Lane",
      score: 91,
      resultSummary: "Strong fit",
    },
    { id: "b", status: "succeeded", title: "Ben Ito", score: 0 },
    { id: "c", status: "running" },
    { id: "d", status: "failed", failureReason: "No text." },
    { id: "e", status: "pending" },
  ]);
  assert.deepEqual(rows, [
    {
      id: "a",
      rank: 1,
      title: "Ada Lane",
      score: 91,
      line: "Strong fit",
      dim: false,
    },
    { id: "b", rank: 2, title: "Ben Ito", score: 0, line: null, dim: false },
    { id: "c", rank: 3, title: READING, score: null, line: null, dim: false },
    {
      id: "d",
      rank: 4,
      title: COULD_NOT_READ,
      score: null,
      line: "No text.",
      dim: true,
    },
    { id: "e", rank: 5, title: READING, score: null, line: null, dim: false },
  ]);
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

test("a section's link is drawn only when it is http or https", () => {
  assert.equal(sectionLink("https://example.test/a"), "https://example.test/a");
  assert.equal(sectionLink("http://example.test/"), "http://example.test/");
  for (const refused of [
    "javascript:alert(1)",
    "data:text/html,x",
    "mailto:a@example.test",
    "//example.test",
    "not a url",
    "",
    undefined,
  ])
    assert.equal(sectionLink(refused), null, String(refused));
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
