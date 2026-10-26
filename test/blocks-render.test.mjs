import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  elements,
  loadBlocks,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The ten block renderers, drawn (backend ADR-0048 decisions 8–10): each type
 * its words, its tone's theme token, its open or closed state and its press;
 * and everything this build does not know — a type at the top level or in a
 * section, a form, a page part, a target, a tone, a step state — drawn as the
 * decision says. The registry is keyed by the generated union, and a copy of
 * the renderer with its fallback taken out fails these cases (decision 11).
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const RUN = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const FILE = "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c";
const ITEM = "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b";
const FLOW = "0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e";

let blocks;
before(async () => {
  blocks = await loadBlocks();
});
after(() => blocks?.cleanup());

const draw = (list, context) => blocks.render(list, context);
const tree = (list, context) => elements(parse(draw(list, context)));
const byTest = (nodes, id) =>
  nodes.filter((node) => node.attrs["data-testid"] === id);

/** The contract's ten types, read from the generated union. */
function unionTypes() {
  const generated = read("lib/generated/platform-contracts/automations.d.ts");
  const start = generated.indexOf("\n    Block:\n");
  const end = generated.indexOf("\n    FlowPages:", start);
  assert.ok(start > 0 && end > start, "the generated Block union");
  return [
    ...generated.slice(start, end).matchAll(/^ {10}type: "([a-z-]+)";$/gmu),
  ].map((match) => match[1]);
}

test("the registry draws exactly the contract's ten types, keyed by the generated union", () => {
  const types = unionTypes();
  assert.equal(types.length, 10, types.join(", "));
  assert.deepEqual(Object.keys(blocks.RENDERERS).sort(), [...types].sort());
  assert.match(
    read("components/blocks/BlockList.tsx"),
    /export const RENDERERS: \{ \[K in Block\["type"\]\]: Renderer<K> \}/u,
  );
});

test("text: its words in the result line's tones, an error one an alert; a label a heading in capitals; strong and muted", () => {
  const nodes = tree([
    { type: "text", text: "Recorded 3 invoices.", tone: "success" },
    { type: "text", text: "The file could not be read.", tone: "error" },
    { type: "text", text: "Documents", style: "label" },
    { type: "text", text: "Bill · Harbor", style: "strong" },
    { type: "text", text: "Oct 14, 2026", style: "muted" },
  ]);
  const [ok, failed, strong, muted] = byTest(nodes, "block-text");
  assert.match(ok.attrs.class, /text-\[var\(--success-text\)\]/u);
  assert.equal(ok.attrs.role, undefined);
  assert.match(failed.attrs.class, /text-\[var\(--error-text\)\]/u);
  assert.equal(failed.attrs.role, "alert");
  const [label] = byTest(nodes, "block-label");
  assert.equal(label.tag, "h2");
  assert.match(label.attrs.class, /uppercase/u);
  assert.match(strong.attrs.class, /font-medium/u);
  assert.match(muted.attrs.class, /text-\[var\(--muted\)\]/u);
  assert.deepEqual(
    visibleWords(
      draw([
        { type: "text", text: "Recorded 3 invoices.", tone: "success" },
        { type: "text", text: "Documents", style: "label" },
      ]),
    ),
    ["Recorded 3 invoices.", "Documents"],
  );
});

test("metric: the tiles, each value large over its label, toned", () => {
  const list = [
    {
      type: "metric",
      items: [
        { label: "Total", value: "3" },
        { label: "Advance", value: "1", tone: "success" },
        { label: "Decline", value: "1", tone: "error" },
      ],
    },
  ];
  assert.deepEqual(visibleWords(draw(list)), [
    "3",
    "Total",
    "1",
    "Advance",
    "1",
    "Decline",
  ]);
  const nodes = tree(list);
  assert.match(byTest(nodes, "block-metric")[0].attrs.class, /grid-cols-3/u);
  assert.match(
    byTest(nodes, "block-metric-2")[0].attrs.class,
    /text-\[var\(--success-text\)\]/u,
  );
  assert.match(
    byTest(nodes, "block-metric-3")[0].attrs.class,
    /text-\[var\(--error-text\)\]/u,
  );
});

test("badge: the document chip, with an error tone; an unknown tone neutral", () => {
  const nodes = tree([
    { type: "badge", text: "Not approved", tone: "error" },
    { type: "badge", text: "Waiting", tone: "warning" },
    { type: "badge", text: "Odd", tone: "purple" },
  ]);
  const [error, warning, odd] = byTest(nodes, "block-badge");
  assert.match(
    error.attrs.class,
    /bg-\[var\(--error-bg\)\] text-\[var\(--error-text\)\]/u,
  );
  assert.match(warning.attrs.class, /bg-\[var\(--warning-bg\)\]/u);
  assert.match(
    odd.attrs.class,
    /bg-\[var\(--surface-strong\)\] text-\[var\(--muted\)\]/u,
  );
  assert.match(error.attrs.class, /rounded-full/u);
});

test("table: column titles, each row's cells then its note, ends aligned, muted columns, strong rows, divided", () => {
  const list = [
    {
      type: "table",
      columns: [
        { title: "Check", muted: true },
        { title: "Result", align: "end" },
      ],
      rows: [
        { cells: ["Totals add up", "Yes"] },
        {
          cells: ["Total", "$1.00"],
          strong: true,
          note: "Read from the header.",
        },
        { cells: ["Empty", ""] },
      ],
      divided: true,
    },
  ];
  assert.deepEqual(visibleWords(draw(list)), [
    "Check",
    "Result",
    "Totals add up",
    "Yes",
    "Total",
    "$1.00",
    "Read from the header.",
    "Empty",
  ]);
  const nodes = tree(list);
  const cells = nodes.filter((node) => node.tag === "td");
  assert.match(cells[0].attrs.class, /text-left text-\[var\(--muted\)\]/u);
  assert.match(cells[1].attrs.class, /text-right text-\[var\(--text\)\]/u);
  assert.ok(
    nodes.some(
      (node) =>
        node.tag === "tr" && /font-medium/u.test(node.attrs.class ?? ""),
    ),
  );
  assert.ok(
    nodes
      .filter((node) => node.tag === "tbody")
      .every((node) => /border-t/u.test(node.attrs.class ?? "")),
  );
});

test("list: a row with a target a PageRow to its route, its score read as Score; the rest entries, an https address a link opening outside; an empty list its line", () => {
  const list = [
    {
      type: "list",
      items: [
        {
          lead: "1",
          title: "Dana",
          value: "88",
          valueLabel: "Score",
          open: { target: "run", runId: RUN },
        },
        {
          lead: "2",
          title: "Failed",
          muted: true,
          open: { target: "run", runId: RUN },
        },
      ],
    },
    {
      type: "list",
      items: [
        {
          title: "B.S. Accounting",
          subtitle: "2019",
          text: "Line one",
          url: "https://school.example.test/a",
          badge: { text: "Found", tone: "success" },
        },
        { title: "Old site", url: "http://old.example.test/" },
      ],
    },
    { type: "list", items: [], empty: "No candidates yet." },
  ];
  const markup = draw(list);
  assert.deepEqual(visibleWords(markup), [
    "1",
    "Dana",
    "88",
    "2",
    "Failed",
    "B.S. Accounting",
    "Found",
    "2019",
    "Line one",
    "https://school.example.test/a",
    "Old site",
    "http://old.example.test/",
    "No candidates yet.",
  ]);
  assert.match(markup, /<span class="sr-only">Score <\/span>88/u);
  const nodes = elements(parse(markup));
  const rows = byTest(nodes, "block-list-row");
  assert.equal(rows[0].tag, "a");
  assert.equal(rows[0].attrs.href, `/account/runs/${RUN}`);
  assert.equal(rows[1].attrs["data-dim"], "true");
  const anchors = nodes.filter((node) => node.tag === "a" && node.attrs.target);
  assert.deepEqual(
    anchors.map((node) => [node.attrs.href, node.attrs.target, node.attrs.rel]),
    [["https://school.example.test/a", "_blank", "noopener noreferrer"]],
    "only the https address is a link",
  );
});

test("section: its own box, closed unless open, its title, subtitle and chip on its bar, its blocks inside", () => {
  const list = [
    {
      type: "section",
      title: "Invoice 1 of 2",
      subtitle: "Harbor · $1.00",
      badge: { text: "Recorded", tone: "success" },
      blocks: [{ type: "text", text: "Inside one" }],
    },
    {
      type: "section",
      title: "Experience",
      open: true,
      blocks: [{ type: "text", text: "Inside two" }],
    },
  ];
  const nodes = tree(list);
  const [closed, open] = byTest(nodes, "block-section");
  assert.equal(closed.tag, "details");
  assert.equal("open" in closed.attrs, false);
  assert.equal("open" in open.attrs, true);
  const bar = elements(closed).find((node) => node.tag === "summary");
  assert.match(bar.attrs.class, /py-3/u);
  assert.doesNotMatch(bar.attrs.class, /py-4/u);
  assert.deepEqual(visibleWords(draw(list)), [
    "Invoice 1 of 2",
    "Harbor · $1.00",
    "Recorded",
    "Experience",
    "Inside two",
  ]);
});

test("file: its row, its title alone, to the run's file page or the item's — an item's only where the page names its flow", () => {
  const list = [
    {
      type: "file",
      title: "View resume",
      open: { target: "run-file", runId: RUN, fileId: FILE },
    },
    {
      type: "file",
      title: "Job description",
      open: { target: "item-file", itemId: ITEM },
    },
  ];
  const placed = byTest(tree(list, { subscriptionId: FLOW }), "block-file");
  assert.deepEqual(
    placed.map((node) => node.attrs.href),
    [
      `/account/runs/${RUN}/files/${FILE}`,
      `/account/flows/${FLOW}/items/${ITEM}/file`,
    ],
  );
  const unplaced = byTest(tree(list), "block-file");
  assert.equal(unplaced[1].tag, "div", "no flow, no press");
  assert.deepEqual(visibleWords(draw(list)), [
    "View resume",
    "Job description",
  ]);
});

test("link: its title, then its host muted under it, opening outside — https only, checked again when drawn", () => {
  const list = [
    {
      type: "link",
      title: "Where the rules live",
      url: "https://help.example.test/rules",
    },
    { type: "link", title: "Not this", url: "http://help.example.test/rules" },
    {
      type: "link",
      title: "Nor this",
      url: "https://user:pw@help.example.test/",
    },
  ];
  const markup = draw(list);
  assert.deepEqual(visibleWords(markup), [
    "Where the rules live",
    "help.example.test",
    "Not this",
    "Nor this",
  ]);
  const links = byTest(elements(parse(markup)), "block-link");
  assert.deepEqual(
    links.map((node) => [
      node.tag,
      node.attrs.href,
      node.attrs.target,
      node.attrs.rel,
    ]),
    [
      ["a", "https://help.example.test/rules", "_blank", "noopener noreferrer"],
      ["p", undefined, undefined, undefined],
      ["p", undefined, undefined, undefined],
    ],
  );
});

test("timeline: each step its state's look — the running one spinning — and a state this build does not know the unknown look", () => {
  const nodes = tree([
    {
      type: "timeline",
      items: [
        { title: "Read", state: "done" },
        { title: "Check", sub: "One left", state: "working" },
        { title: "Later", state: "teleported" },
      ],
    },
  ]);
  const steps = nodes.filter((node) => node.tag === "li");
  assert.deepEqual(
    steps.map((node) => node.attrs["data-state"]),
    ["done", "working", "unknown"],
  );
  const icons = nodes.filter((node) => node.tag === "svg");
  assert.match(icons[0].attrs.class, /text-\[var\(--success-text\)\]/u);
  assert.match(icons[1].attrs.class, /motion-safe:animate-spin/u);
  assert.match(icons[2].attrs.class, /text-\[var\(--muted\)\]/u);
});

test("questions: the page's own form for each, with its context; nothing where the page offers none; an unknown form the fallback", () => {
  const { createElement } = blocks;
  const list = [
    {
      type: "questions",
      form: { kind: "approval", approvalId: RUN, eligibleRoles: ["owner"] },
    },
    { type: "questions", form: { kind: "run", itemId: ITEM } },
  ];
  const context = {
    forms: {
      approval: (form) =>
        createElement("button", null, `Decide ${form.eligibleRoles.join(",")}`),
      run: (form) => createElement("button", null, `Start ${form.itemId}`),
    },
  };
  const nodes = tree(list, context);
  assert.deepEqual(
    nodes
      .filter((node) => node.tag === "button")
      .map((node) => node.children[0].text),
    ["Decide owner", `Start ${ITEM}`],
  );
  assert.deepEqual(
    visibleWords(draw(list)),
    [],
    "no form offered, nothing drawn",
  );
  assert.deepEqual(
    visibleWords(
      draw([{ type: "questions", form: { kind: "survey" } }], context),
    ),
    [blocks.FALLBACK],
  );
});

/** Each case this build does not know, and what it must draw. */
const UNKNOWN = [
  [
    "an unknown type at the top level",
    [{ type: "chart", points: [1] }],
    (b) => [b.FALLBACK],
  ],
  [
    "an unknown type inside a section",
    [
      {
        type: "section",
        title: "Inside",
        open: true,
        blocks: [{ type: "gauge" }],
      },
    ],
    (b) => ["Inside", b.FALLBACK],
  ],
  [
    "an unknown form",
    [{ type: "questions", form: { kind: "survey" } }],
    (b) => [b.FALLBACK],
  ],
  ["no blocks at all", undefined, (b) => [b.FALLBACK]],
];

for (const [name, list, expected] of UNKNOWN) {
  test(`${name} draws the fallback sentence`, () => {
    assert.deepEqual(visibleWords(draw(list)), expected(blocks));
  });
}

test("an unknown target draws its row without a press; an unknown tone draws neutral", () => {
  const nodes = tree([
    {
      type: "list",
      items: [
        {
          title: "Opens nothing here",
          open: { target: "invoice", invoiceId: "x" },
        },
      ],
    },
    { type: "text", text: "Plain", tone: "ultraviolet" },
  ]);
  assert.equal(nodes.filter((node) => node.tag === "a").length, 0);
  assert.equal(byTest(nodes, "block-list-entry").length, 1);
  assert.match(
    byTest(nodes, "block-text")[0].attrs.class,
    /text-\[var\(--text\)\]/u,
  );
});

test("the one fallback sentence is the owner's, held in one place", () => {
  assert.equal(blocks.FALLBACK, "This part can't be shown here yet.");
});

test("a copy of the renderer with its fallback taken out fails the unknown cases (ADR-0048 decision 11)", async () => {
  const line = "  if (!render) return <Fallback />;\n";
  assert.ok(
    read("components/blocks/BlockList.tsx").includes(line),
    "the fallback line",
  );
  const broken = await loadBlocks({
    mutate: (path, source) =>
      path === "components/blocks/BlockList.tsx"
        ? source.replace(line, "")
        : source,
  });
  try {
    for (const [name, list, expected] of UNKNOWN.slice(0, 2)) {
      assert.throws(
        () =>
          assert.deepEqual(visibleWords(broken.render(list)), expected(broken)),
        undefined,
        `${name} still drew the fallback without it`,
      );
    }
  } finally {
    broken.cleanup();
  }
});

test("a page's parts follow its flow's manifest, else today's order; a part this build does not know is the fallback's place", () => {
  const { pageParts } = blocks.look;
  const known = ["dashboard", "steps", "items"];
  assert.deepEqual(pageParts(undefined, known, ["dashboard", "steps"]), [
    "dashboard",
    "steps",
  ]);
  assert.deepEqual(pageParts(["items"], known, ["dashboard", "steps"]), [
    "items",
  ]);
  assert.deepEqual(
    pageParts(["steps", "widgets", "dashboard"], known, ["items"]),
    ["steps", null, "dashboard"],
  );
  // The flow page and the item's file page draw the fallback in its place.
  for (const path of [
    "app/account/flows/[subscriptionId]/page.tsx",
    "app/account/flows/[subscriptionId]/items/[itemId]/file/page.tsx",
  ]) {
    const page = read(path);
    assert.match(
      page,
      /pageParts\(\n\s+subscription\??\.pages\?\.(?:flow|file),/u,
      path,
    );
    assert.match(
      page,
      /<div key=\{`unknown-\$\{at\}`\} className="py-5 first:pt-0">\s*<Fallback \/>/u,
      path,
    );
  }
});

test("an address opens outside only when it is https with a host and no user or password; any other is never a link", () => {
  const { httpsLink } = blocks.look;
  assert.deepEqual(httpsLink("https://example.test/a"), {
    href: "https://example.test/a",
    host: "example.test",
  });
  for (const refused of [
    "http://example.test/",
    "javascript:alert(1)",
    "data:text/html,x",
    "mailto:a@example.test",
    "//example.test",
    "https://user:pw@example.test/",
    "not a url",
    "",
    undefined,
  ])
    assert.equal(httpsLink(refused), null, String(refused));
});
