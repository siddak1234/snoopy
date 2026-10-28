import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import {
  elements,
  loadBlocks,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The thirteen block renderers, drawn (backend ADR-0048 decisions 8–10, and
 * its amendment 1's image, chart and group): each type
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

/** The contract's thirteen types, read from the generated union. */
function unionTypes() {
  const generated = read("lib/generated/platform-contracts/automations.d.ts");
  const start = generated.indexOf("\n    Block:\n");
  const end = generated.indexOf("\n    FlowPages:", start);
  assert.ok(start > 0 && end > start, "the generated Block union");
  return [
    ...generated.slice(start, end).matchAll(/^ {10}type: "([a-z-]+)";$/gmu),
  ].map((match) => match[1]);
}

test("the registry draws exactly the contract's thirteen types, keyed by the generated union", () => {
  const types = unionTypes();
  assert.equal(types.length, 13, types.join(", "));
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
  const classes = (node) => node.attrs.class.split(/\s+/u);
  assert.ok(classes(strong).includes("font-medium"), strong.attrs.class);
  assert.ok(!classes(ok).includes("font-medium"), ok.attrs.class);
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

test("list: a row that opens a page keeps its subtitle, text and address, in the words' order, the address no second link", () => {
  const list = [
    {
      type: "list",
      items: [
        {
          lead: "1",
          title: "Dana",
          badge: { text: "Advance", tone: "success" },
          value: "88",
          valueLabel: "Score",
          subtitle: "Payroll Lead",
          text: "Ran payroll.",
          url: "https://school.example.test/a",
          open: { target: "run", runId: RUN },
        },
      ],
    },
  ];
  const markup = draw(list);
  assert.deepEqual(visibleWords(markup), [
    "1",
    "Dana",
    "Advance",
    "88",
    "Payroll Lead",
    "Ran payroll.",
    "https://school.example.test/a",
  ]);
  const nodes = elements(parse(markup));
  const [row] = byTest(nodes, "block-list-row");
  assert.equal(row.tag, "a");
  assert.equal(row.attrs.href, `/account/runs/${RUN}`);
  assert.equal(
    nodes.filter((node) => node.tag === "a").length,
    1,
    "the row is the one press",
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
  // Its title is drawn with the form, and only with it: a member, or a flow not
  // live, sees no "Add candidate" with nothing under it.
  const titled = [
    {
      type: "questions",
      title: "Add candidate",
      form: { kind: "run", itemId: ITEM },
    },
  ];
  const offered = tree(titled, context);
  assert.deepEqual(
    byTest(offered, "block-label").map((node) => node.children[0].text),
    ["Add candidate"],
  );
  assert.equal(offered.filter((node) => node.tag === "button").length, 1);
  assert.deepEqual(
    byTest(tree(titled), "block-label"),
    [],
    "no form, no title",
  );
  // The page's form for a member draws nothing (ItemLive's canAdd): no title.
  assert.deepEqual(
    byTest(tree(titled, { forms: { run: () => null } }), "block-label"),
    [],
    "a form that draws nothing, no title",
  );
});

/** Each case this build does not know, and what it must draw. */
const UNKNOWN = [
  [
    "an unknown type at the top level",
    [{ type: "gauge", points: [1] }],
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
  const line = '  if (!render) return notShown(type, "unknown type");\n';
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
      /<Group key=\{`unknown-\$\{at\}`\}>\s*<Fallback \/>/u,
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

const fixture = (name) => {
  const found = BLOCK_FIXTURES.find((one) => one.name === name);
  assert.ok(found, name);
  return found;
};

/** What a renderer hands on: the element a hookless renderer returns, drawn once more. */
function handedOn(type, block, context = {}) {
  const element = blocks.RENDERERS[type](block, context, () => null);
  return element.type(element.props);
}

test("image: its address is its typed target's alone, the file page's own view route; a planted url gives no outside address", () => {
  const [image] = fixture("drawn-image").blocks;
  const picture = handedOn("image", image);
  const page = `/account/runs/${image.open.runId}/files/${image.open.fileId}`;
  assert.equal(picture.props.page, page);
  assert.equal(picture.props.view, `${page}/view`);
  assert.equal(picture.props.alt, image.alt);
  assert.equal(picture.props.pdf, false);
  const [scan] = fixture("drawn-image-pdf").blocks;
  assert.equal(handedOn("image", scan).props.pdf, true);
  // A block that names an address of its own: the address stays the target's.
  const planted = {
    ...image,
    url: "https://evil.example.test/x.jpg",
    src: "https://evil.example.test/y.jpg",
    alt: "https://evil.example.test/z.jpg",
  };
  const drawn = handedOn("image", planted);
  assert.equal(drawn.props.page, page);
  assert.equal(drawn.props.view, `${page}/view`);
  const markup = draw([planted]);
  assert.doesNotMatch(markup, /evil\.example/u);
  assert.doesNotMatch(markup, /<img|<iframe/u, "nothing is read on the server");
  // A target this build does not know: the file's row, with no press.
  const nodes = tree([{ ...image, open: { target: "elsewhere" } }]);
  assert.equal(byTest(nodes, "block-image").length, 0);
  assert.equal(byTest(nodes, "block-file")[0].tag, "div");
});

test("chart: a box read aloud as its alt, its words text nodes a screen reader skips, its bars SVG widths with no style", () => {
  for (const name of [
    "drawn-chart-bar",
    "drawn-chart-line",
    "reviewer-item-scores",
  ]) {
    const chart = fixture(name).blocks.find((block) => block.type === "chart");
    const markup = draw([chart]);
    assert.doesNotMatch(markup, /style=/u, name);
    const nodes = elements(parse(markup));
    const [box] = byTest(nodes, "block-chart");
    assert.equal(box.attrs.role, "img", name);
    assert.equal(box.attrs["aria-label"], chart.alt, name);
    for (const child of box.children)
      assert.equal(child.attrs["aria-hidden"], "true", `${name}: ${child.tag}`);
  }
  const [bar] = fixture("drawn-chart-bar").blocks;
  const widths = byTest(elements(parse(draw([bar]))), "block-chart-bar").map(
    (rect) => Number(rect.attrs.width),
  );
  assert.deepEqual(
    widths.map((width) => Math.round(width * 100) / 100),
    [100, 81.36, 25.9],
  );
  // Text nodes only: a word that looks like markup stays words.
  const planted = {
    ...bar,
    title: "<b>Spend</b>",
    points: [{ label: "<i>x</i>", value: 1, text: "1" }],
  };
  const markup = draw([planted]);
  assert.doesNotMatch(markup, /<b>|<i>/u);
  assert.deepEqual(visibleWords(markup), ["<b>Spend</b>", "<i>x</i>", "1"]);
  // A line: stretched, its stroke and dots kept; a dot at each of 24 or fewer.
  const [line] = fixture("drawn-chart-line").blocks;
  const lineNodes = elements(parse(draw([line])));
  const svg = lineNodes.find((node) => node.tag === "svg");
  assert.equal(svg.attrs.preserveAspectRatio, "none");
  assert.equal(
    lineNodes.find((node) => node.tag === "polyline").attrs["vector-effect"],
    "non-scaling-stroke",
  );
  assert.equal(byTest(lineNodes, "block-chart-dot").length, 6);
  const many = {
    ...line,
    points: Array.from({ length: 30 }, (_, at) => ({
      label: `W${at}`,
      value: at,
      text: String(at),
    })),
  };
  assert.equal(byTest(tree([many]), "block-chart-dot").length, 0);
});

test("group: its title, then one card holding its sections as drop-downs, the first open, none sharing a name", () => {
  const grouped = fixture("reviewer-candidate-grouped");
  const nodes = tree(grouped.blocks);
  const [group] = byTest(nodes, "block-group");
  assert.ok(group, "one group");
  const inside = elements(group);
  assert.equal(byTest(inside, "block-group-title")[0].tag, "h2");
  const cards = group.children.filter((node) =>
    (node.attrs.class ?? "").includes("divide-y"),
  );
  assert.equal(cards.length, 1, "one card");
  assert.equal(group.children.length, 2, "its title, then its card");
  const sections = cards[0].children.filter((node) => node.tag === "details");
  assert.equal(sections.length, 2);
  assert.equal("open" in sections[0].attrs, true);
  assert.equal("open" in sections[1].attrs, false);
  assert.ok(sections.every((section) => !("name" in section.attrs)));
  // The sections have no box of their own: the card's dividers part them.
  assert.ok(
    sections.every((section) => !section.attrs.class.includes("border")),
  );
});

test("list: one card of divided rows; each score toned by its valueTone — success green, error red, none plain — beside its chip", () => {
  const verdicts = fixture("reviewer-item-verdicts");
  const nodes = tree(verdicts.blocks);
  const [card] = byTest(nodes, "block-list");
  assert.equal(card.tag, "ol");
  assert.match(card.attrs.class, /divide-y/u);
  assert.match(card.attrs.class, /border/u);
  const rows = byTest(nodes, "block-list-row");
  assert.equal(rows.length, 3);
  assert.ok(
    rows.every((row) => !/\bborder\b/u.test(row.attrs.class)),
    "no row its own box",
  );
  const values = byTest(nodes, "block-list-value");
  assert.deepEqual(
    values.map((value) => [
      value.attrs["data-tone"],
      value.attrs.class.match(/text-\[var\(--[a-z-]+\)\]/u)[0],
    ]),
    [
      ["success", "text-[var(--success-text)]"],
      ["neutral", "text-[var(--text)]"],
      ["error", "text-[var(--error-text)]"],
    ],
  );
  assert.deepEqual(
    byTest(nodes, "block-badge").map((chip) => [
      chip.attrs["data-tone"],
      chip.children[0].text,
    ]),
    [
      ["success", "Advance"],
      ["error", "Decline"],
    ],
  );
});

/*
 * A known block without a field its schema requires (Round 21, design D2.6):
 * checked before drawing, from the generated `BLOCK_REQUIRED`, so a server
 * render — the item's file page — draws the fallback in its place and the
 * next block, with no boundary in play; and each fallback is logged once with
 * the block's type and the missing field, never its words.
 */
const notDrawnCalls = (calls) =>
  calls
    .filter((call) => call.arguments[0] === "block not drawn")
    .map((call) => call.arguments[1]);

test("a table without rows draws the fallback in its place on a server render, the next block still draws, and one console.error names type table (Round 21, D2.6)", (t) => {
  const error = t.mock.method(console, "error", () => {});
  const words = visibleWords(
    draw([
      { type: "table", columns: [{ title: "Field" }, { title: "Value" }] },
      { type: "text", text: "Next block." },
    ]),
  );
  assert.deepEqual(words, [blocks.FALLBACK, "Next block."]);
  assert.equal(error.mock.callCount(), 1);
  assert.deepEqual(error.mock.calls[0].arguments, [
    "block not drawn",
    { type: "table", error: "rows" },
  ]);
});

test("a missing or mistyped required field anywhere in a block draws the fallback for that block alone, logged with the field's name and no value (Round 21, D2.6)", (t) => {
  const error = t.mock.method(console, "error", () => {});
  const cases = [
    [{ type: "text" }, "text"],
    [{ type: "text", text: 7 }, "text"],
    [{ type: "table", columns: [{}, {}], rows: "Private row" }, "rows"],
    [
      { type: "table", columns: [{}, {}], rows: [{ cells: ["a"] }, {}] },
      "rows[1].cells",
    ],
    [{ type: "list", items: [{ subtitle: "Private" }] }, "items[0].title"],
    [{ type: "file", title: "Contract" }, "open"],
    [{ type: "file", title: "Contract", open: {} }, "open.target"],
    [
      {
        type: "chart",
        kind: "bar",
        title: "Scores",
        alt: "Scores",
        points: [{ label: "A", value: "9", text: "9" }],
      },
      "points[0].value",
    ],
    [
      { type: "group", title: "Details", sections: [{ type: "section" }] },
      "sections[0].title",
    ],
  ];
  for (const [block, field] of cases) {
    error.mock.resetCalls();
    assert.deepEqual(
      visibleWords(draw([block, { type: "text", text: "After." }])),
      [blocks.FALLBACK, "After."],
      JSON.stringify(block),
    );
    assert.deepEqual(notDrawnCalls(error.mock.calls), [
      { type: block.type, error: field },
    ]);
    assert.ok(
      !JSON.stringify(error.mock.calls).includes("Private"),
      "no block value is logged",
    );
  }
  // Inside a section, the section and its other blocks still draw.
  error.mock.resetCalls();
  assert.deepEqual(
    visibleWords(
      draw([
        {
          type: "section",
          title: "Inside",
          open: true,
          blocks: [{ type: "badge" }, { type: "text", text: "Kept." }],
        },
      ]),
    ),
    ["Inside", blocks.FALLBACK, "Kept."],
  );
  assert.deepEqual(notDrawnCalls(error.mock.calls), [
    { type: "badge", error: "text" },
  ]);
  // A block with no type at all: `unknown`.
  error.mock.resetCalls();
  assert.deepEqual(visibleWords(draw(["just text"])), [blocks.FALLBACK]);
  assert.deepEqual(notDrawnCalls(error.mock.calls), [
    { type: "unknown", error: "unknown type" },
  ]);
});

test("every platform fixture body passes the field check: nothing is logged but its unknown parts (Round 21, D2.6)", (t) => {
  const error = t.mock.method(console, "error", () => {});
  for (const { name, blocks: list } of BLOCK_FIXTURES) {
    error.mock.resetCalls();
    draw(list);
    const logged = notDrawnCalls(error.mock.calls);
    // Its unknown parts: a type, or a form (the `unknown-form` fixture).
    assert.ok(
      logged.every(
        (entry) =>
          entry.error === "unknown type" ||
          (entry.type === "questions" && entry.error === "form.kind"),
      ),
      `${name}: ${JSON.stringify(logged)}`,
    );
  }
});

test("the field check reads the generated table: one entry for each of the contract's thirteen types, a table's columns and rows among them", async () => {
  const { modules, cleanup } = await loadModules([
    "lib/generated/platform-contracts/block-required.ts",
  ]);
  try {
    const { BLOCK_REQUIRED } =
      modules["lib/generated/platform-contracts/block-required.ts"];
    assert.deepEqual(
      Object.keys(BLOCK_REQUIRED).sort(),
      [...unionTypes()].sort(),
    );
    assert.deepEqual(Object.keys(BLOCK_REQUIRED.table), [
      "type",
      "columns",
      "rows",
    ]);
  } finally {
    cleanup();
  }
  assert.match(
    read("components/blocks/drawable.ts"),
    /from "@\/lib\/generated\/platform-contracts\/block-required";/u,
  );
});

test("a block whose renderer throws in the browser: its boundary draws the fallback in its place, logged once with its type; every block, nested ones too, is wrapped (Round 21, D2.6)", async (t) => {
  const ENTRY = "components/blocks/BlockBoundary.tsx";
  const { modules, cleanup } = await loadModules([ENTRY]);
  try {
    const { BlockBoundary } = modules[ENTRY];
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const thrown = new TypeError("Cannot read properties of undefined");
    assert.deepEqual(BlockBoundary.getDerivedStateFromError(thrown), {
      failed: true,
    });
    const boundary = new BlockBoundary({
      type: "chart",
      children: createElement("p", null, "Drawn."),
    });
    assert.deepEqual(visibleWords(renderToStaticMarkup(boundary.render())), [
      "Drawn.",
    ]);
    const error = t.mock.method(console, "error", () => {});
    boundary.componentDidCatch(thrown);
    assert.deepEqual(notDrawnCalls(error.mock.calls), [
      { type: "chart", error: thrown },
    ]);
    boundary.state = BlockBoundary.getDerivedStateFromError(thrown);
    assert.deepEqual(visibleWords(renderToStaticMarkup(boundary.render())), [
      blocks.FALLBACK,
    ]);
  } finally {
    cleanup();
  }
  const source = read("components/blocks/BlockList.tsx");
  assert.match(
    source,
    /<BlockBoundary type=\{typeOf\(block\)\} block=\{block\}>\s*\{drawBlock\(block, context, inner\)\}\s*<\/BlockBoundary>/u,
  );
  // Nested blocks are drawn by the same `Blocks`, so each is wrapped too.
  assert.match(source, /<Blocks blocks=\{within\} context=\{context\} \/>/u);
  assert.match(read(ENTRY), /^"use client";/u);
});

test("a caught block is reset by a re-read that sends another block in its place: the new block draws; the same block again stays the fallback (Round 21, D2.6)", async (t) => {
  const ENTRY = "components/blocks/BlockBoundary.tsx";
  const { modules, cleanup } = await loadModules([ENTRY]);
  try {
    const { BlockBoundary } = modules[ENTRY];
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    t.mock.method(console, "error", () => {});
    const broken = { type: "chart", kind: "bar", title: "Scores", points: [] };
    const fixed = { ...broken, points: [{ label: "A", value: 1 }] };
    // React's own steps, in its order: mount, catch, then each new read's props.
    const props = (block, words) => ({
      type: "chart",
      block,
      children: createElement("p", null, words),
    });
    const boundary = new BlockBoundary(props(broken, "Broken."));
    const step = (next) => {
      const derived = BlockBoundary.getDerivedStateFromProps(
        next,
        boundary.state,
      );
      boundary.props = next;
      if (derived) boundary.state = { ...boundary.state, ...derived };
      return visibleWords(renderToStaticMarkup(boundary.render()));
    };
    boundary.state = {
      ...boundary.state,
      ...BlockBoundary.getDerivedStateFromError(new TypeError("x")),
    };
    assert.deepEqual(step(props(broken, "Broken.")), [blocks.FALLBACK]);
    assert.deepEqual(
      step(props(structuredClone(broken), "Broken.")),
      [blocks.FALLBACK],
      "the same block, read again, stays the fallback",
    );
    assert.deepEqual(step(props(fixed, "Drawn.")), ["Drawn."]);
    assert.deepEqual(step(props({ type: "text", text: "Other." }, "Other.")), [
      "Other.",
    ]);
  } finally {
    cleanup();
  }
  assert.match(
    read("components/blocks/BlockList.tsx"),
    /<BlockBoundary type=\{typeOf\(block\)\} block=\{block\}>/u,
  );
});

test("every block fallback is logged: an unknown form, a chart with no points, a group entry not a section, an absent body and a body that is not a list (Round 21, D2.6)", (t) => {
  const error = t.mock.method(console, "error", () => {});
  const cases = [
    [
      [{ type: "questions", form: { kind: "survey" } }],
      { type: "questions", error: "form.kind" },
    ],
    [
      [
        {
          type: "chart",
          kind: "bar",
          title: "Scores",
          alt: "Scores",
          points: [],
        },
      ],
      { type: "chart", error: "points" },
    ],
    [
      [
        {
          type: "group",
          title: "Details",
          sections: [{ type: "text", title: "Private", blocks: [] }],
        },
      ],
      { type: "group", error: "sections[0].type" },
    ],
    [undefined, { type: "unknown", error: "no blocks" }],
    [null, { type: "unknown", error: "not a list" }],
    [{ blocks: [] }, { type: "unknown", error: "not a list" }],
  ];
  for (const [list, logged] of cases) {
    error.mock.resetCalls();
    assert.deepEqual(
      visibleWords(draw(list)),
      [blocks.FALLBACK],
      String(JSON.stringify(list)),
    );
    assert.deepEqual(notDrawnCalls(error.mock.calls), [logged]);
    assert.ok(
      !JSON.stringify(error.mock.calls).includes("Private"),
      "no block value is logged",
    );
  }
});

test("a group's own guard: an entry not a section, drawn by GroupCard itself, is the fallback logged as sections[n].type (Round 21, D2.6)", async (t) => {
  const ENTRY = "components/blocks/GroupCard.tsx";
  const { modules, cleanup } = await loadModules([ENTRY]);
  try {
    const { GroupCard } = modules[ENTRY];
    const { renderToStaticMarkup } = await import("react-dom/server");
    const error = t.mock.method(console, "error", () => {});
    const markup = renderToStaticMarkup(
      GroupCard({
        block: {
          type: "group",
          title: "Details",
          sections: [{ type: "section", title: "Kept", blocks: [] }, "x"],
        },
        inner: () => null,
      }),
    );
    assert.deepEqual(visibleWords(markup), [
      "Details",
      "Kept",
      blocks.FALLBACK,
    ]);
    assert.deepEqual(notDrawnCalls(error.mock.calls), [
      { type: "group", error: "sections[1].type" },
    ]);
  } finally {
    cleanup();
  }
});

test("in a browser a fallback is logged once for each type and reason until the page loads again, though the page draws again at each poll; on the server, at each draw (Round 21, D2.6)", async (t) => {
  const fresh = await loadBlocks();
  const hadWindow = Object.hasOwn(globalThis, "window");
  try {
    const error = t.mock.method(console, "error", () => {});
    const broken = [{ type: "table", columns: [] }];
    fresh.render(broken);
    fresh.render(broken);
    assert.equal(
      notDrawnCalls(error.mock.calls).length,
      2,
      "server: each draw",
    );
    error.mock.resetCalls();
    globalThis.window = {};
    fresh.render(broken);
    fresh.render(broken);
    fresh.render([{ type: "text" }]);
    fresh.render([{ type: "text" }, { type: "badge" }]);
    assert.deepEqual(notDrawnCalls(error.mock.calls), [
      { type: "table", error: "rows" },
      { type: "text", error: "text" },
      { type: "badge", error: "text" },
    ]);
  } finally {
    if (!hadWindow) delete globalThis.window;
    fresh.cleanup();
  }
});
