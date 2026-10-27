import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  activityHref,
  activityPages,
  activityQuery,
  runsQuery,
} from "../lib/flow-steps.ts";
import { verdictChip, verdictNamesOf } from "../lib/run-verdict.ts";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * Block set v2's screens (backend ADR-0048 amendment 1; the owner's build 30
 * notes F1, F2 and F4 and Q5 and Q7): Activity's search, sort and pages sent
 * on to the platform; a run's score in its verdict's colour with its word;
 * and Download, then Share, on every document, Share the file itself.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const SCORE = "components/dashboard/RunScore.tsx";
const ACTIONS = "components/dashboard/FileActions.tsx";
const CONTROLS = "app/account/runs/ActivityControls.tsx";
const SHARE_ROUTE = "app/account/share/route.ts";

let loaded;
before(async () => {
  loaded = await loadModules(
    [SCORE, ACTIONS, CONTROLS, SHARE_ROUTE, "components/blocks/ListTools.tsx"],
    {
      stubs: {
        "@/lib/app-session":
          "export const getAppSession = async () => ({ user: { id: 'u1', email: 'a@example.test' } });",
        "@/lib/tenancy":
          "export const resolveActiveWorkspaceId = async () => 'w1';",
      },
    },
  );
});
after(() => loaded?.cleanup());

const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const draw = (path, name, props) =>
  renderToStaticMarkup(createElement(loaded.modules[path][name], props));
const byTest = (nodes, id) =>
  nodes.filter((node) => node.attrs["data-testid"] === id);

const FLOW = "0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e";
const SINCE = "2026-10-26T04:00:00.000Z";

test("Activity: q, sort, page, status and since reach the platform, the flow as subscriptionId", () => {
  const query = activityQuery({
    flow: FLOW,
    status: "failed",
    since: SINCE,
    q: "  Harbor Paper  ",
    sort: "oldest",
    page: "2",
  });
  const sent = new URLSearchParams(runsQuery(query).slice(1));
  assert.deepEqual(Object.fromEntries(sent), {
    subscriptionId: FLOW,
    q: "Harbor Paper",
    status: "failed",
    since: SINCE,
    sort: "oldest",
    page: "2",
  });
  // listRuns sends exactly that query.
  assert.match(
    read("lib/automations.ts"),
    /`\$\{scope\(workspaceId\)\}\/runs\$\{query \? runsQuery\(query\) : ""\}`/u,
  );
  assert.match(
    read("app/account/runs/page.tsx"),
    /listRuns\(workspaceId, query\)/u,
  );
  // None of them still sends the sort and the page, so the platform pages
  // plain Activity and counts it (`total`); Home alone reads the newest 100.
  assert.equal(runsQuery(activityQuery({})), "?sort=newest&page=1");
  assert.match(read("app/account/page.tsx"), /listRuns\(workspaceId\)\)/u);
  // What the address may not say is no filter at all.
  assert.deepEqual(
    activityQuery({ q: "x".repeat(90), sort: "random", page: "0" }),
    { q: "x".repeat(80) },
  );
  assert.deepEqual(activityQuery({ page: "201" }), {});
  // The address keeps q, sort and page; a new search or sort is page 1.
  assert.equal(
    activityHref({ ...query, page: 3 }),
    `/account/runs?flow=${FLOW}&status=failed&since=${encodeURIComponent(SINCE)}&q=Harbor+Paper&sort=oldest&page=3`,
  );
});

test("Activity never sends needsReview: the website has no Needs review", () => {
  const query = { ...activityQuery({ status: "held" }), needsReview: true };
  assert.doesNotMatch(runsQuery(query), /needsReview/u);
  assert.doesNotMatch(runsQuery(query), /held/u);
  for (const path of [
    "lib/automations.ts",
    "lib/flow-steps.ts",
    "app/account/runs/page.tsx",
    CONTROLS,
  ])
    assert.doesNotMatch(
      read(path).replace(/\/\/.*|\/\*[\s\S]*?\*\//gu, ""),
      /needsReview/u,
      path,
    );
});

test("Activity: a total of 30 is long, its sort and pager shown; 25 or no total is one page", () => {
  assert.deepEqual(activityPages(30, 25), { long: true, pages: 2 });
  assert.deepEqual(activityPages(25, 25), { long: false, pages: 1 });
  assert.deepEqual(activityPages(undefined, 25), { long: false, pages: 1 });
  const view = (long) =>
    draw(CONTROLS, "ActivityToolsView", {
      query: { q: "harbor" },
      long,
      onGo: () => {},
    });
  const long = elements(parse(view(true)));
  assert.equal(
    byTest(long, "activity-search")[0].attrs.placeholder,
    "Search runs",
  );
  assert.equal(byTest(long, "activity-search")[0].attrs.value, "harbor");
  assert.equal(byTest(long, "activity-sort").length, 1);
  assert.ok(visibleWords(view(true)).includes("Newest first"));
  const short = elements(parse(view(false)));
  assert.equal(
    byTest(short, "activity-search").length,
    1,
    "the search box always",
  );
  assert.equal(byTest(short, "activity-sort").length, 0);
  // The page draws the pager only when long, from the platform's count.
  const page = read("app/account/runs/page.tsx");
  assert.match(
    page,
    /const \{ long, pages \} = activityPages\(listed\.total, BLOCK_SEARCH\.pageSize\);/u,
  );
  assert.match(
    page,
    /\{long \? (?:\(\s*)?<ActivityPager query=\{query\} pages=\{pages\} \/>(?:\s*\))? : null\}/u,
  );
});

test("Activity with no search, filter, sort or page: a total of 30 shows the sort and the pager", () => {
  const bare = activityQuery({});
  const sent = new URLSearchParams(runsQuery(bare).slice(1));
  assert.equal(sent.get("sort"), "newest");
  assert.equal(sent.get("page"), "1");
  // The platform (the snapshot's contract): any of these, and the answer is
  // one page of 25 with `total`.
  assert.match(
    read("lib/generated/platform-contracts/automations.d.ts"),
    /With none of `q`, `status`, `needsReview`, `since`, `sort` and `page`, the answer is today's newest 100, unchanged\. With any of them, it is one page of 25 and `total`/u,
  );
  const { long, pages } = activityPages(30, 25);
  assert.deepEqual({ long, pages }, { long: true, pages: 2 });
  const tools = elements(
    parse(
      draw(CONTROLS, "ActivityToolsView", {
        query: bare,
        long,
        onGo: () => {},
      }),
    ),
  );
  assert.equal(byTest(tools, "activity-search").length, 1);
  assert.equal(byTest(tools, "activity-sort").length, 1);
  const pager = draw("components/blocks/ListTools.tsx", "Pager", {
    page: bare.page ?? 1,
    pages,
    onPage: () => {},
    testId: "activity-pager",
  });
  assert.equal(byTest(elements(parse(pager)), "activity-pager").length, 1);
  assert.ok(visibleWords(pager).includes("Page 1 of 2"), visibleWords(pager));
});

const NAMES = { positive: "Advance", negative: "Decline" };

test("F1: a positive run's score is green with the chip Advance; a negative one red with Decline; none plain, no chip", () => {
  assert.deepEqual(verdictNamesOf({ items: { verdictWords: NAMES } }), NAMES);
  assert.equal(verdictNamesOf({ items: {} }), undefined);
  const score = (verdict, names = NAMES) =>
    elements(
      parse(
        draw(SCORE, "RunScore", {
          score: 82,
          chip: verdictChip(verdict, names),
        }),
      ),
    );
  const cases = [
    [
      "positive",
      "success",
      "text-[var(--success-text)]",
      [["success", "Advance"]],
    ],
    ["negative", "error", "text-[var(--error-text)]", [["error", "Decline"]]],
    [undefined, "neutral", "text-[var(--text)]", []],
  ];
  for (const [verdict, tone, colour, chips] of cases) {
    const nodes = score(verdict);
    const [value] = byTest(nodes, "run-score");
    assert.equal(value.attrs["data-tone"], tone, String(verdict));
    assert.ok(value.attrs.class.split(" ").includes(colour), value.attrs.class);
    assert.deepEqual(
      byTest(nodes, "block-badge").map((chip) => [
        chip.attrs["data-tone"],
        chip.children[0].text,
      ]),
      chips,
    );
  }
  // A flow that names no verdict: plain, with no chip, whatever the run says.
  const unnamed = score("positive", null);
  assert.equal(byTest(unnamed, "run-score")[0].attrs["data-tone"], "neutral");
  assert.equal(byTest(unnamed, "block-badge").length, 0);
  // The run page reads it from the run and its flow.
  assert.match(
    read("app/account/runs/[runId]/RunLive.tsx"),
    /chip=\{verdictChip\(run\.verdict, flow\?\.verdictNames\)\}/u,
  );
  assert.match(
    read("app/account/runs/[runId]/run-page-data.ts"),
    /const verdictNames = verdictNamesOf\(subscription\);/u,
  );
});

const actionsView = (props) =>
  elements(
    parse(
      draw(ACTIONS, "FileActionsView", {
        busy: false,
        shareReady: true,
        error: null,
        onAct: () => {},
        onShare: () => {},
        ...props,
      }),
    ),
  );
const buttonWords = (nodes) =>
  nodes
    .filter((node) => node.tag === "button")
    .map((node) => visibleWords(renderNode(node)).join(" "));
/** A node's words: its text, depth first. */
function renderNode(node) {
  const texts = [];
  const walk = (at) => {
    if (at.text !== undefined) texts.push(at.text);
    else at.children.forEach(walk);
  };
  walk(node);
  return texts.join(" ");
}

test("F4: Download, then Share, on all five places; with canShare false, no Share", () => {
  const one = actionsView({
    downloads: [{ label: "Download", run: async () => null }],
    canShare: true,
  });
  assert.deepEqual(buttonWords(one), ["Download", "Share"]);
  const pkg = actionsView({
    downloads: [
      { label: "Download PDF", run: async () => null },
      { label: "Download Excel", run: async () => null },
    ],
    canShare: true,
  });
  assert.deepEqual(buttonWords(pkg), [
    "Download PDF",
    "Download Excel",
    "Share",
  ]);
  assert.deepEqual(
    buttonWords(
      actionsView({
        downloads: [{ label: "Download", run: async () => null }],
        canShare: false,
      }),
    ),
    ["Download"],
  );
  // Share waits, disabled, until its file is read.
  const waiting = actionsView({
    downloads: [{ label: "Download", run: async () => null }],
    canShare: true,
    shareReady: false,
  }).filter((node) => node.tag === "button");
  assert.deepEqual(
    waiting.map((node) => node.attrs.disabled !== undefined),
    [false, true],
  );
  // The five places: both file pages (FileView), the package's two
  // documents, and Settings › Data's two exports — each FileActions, with
  // its downloads first and a file to share.
  for (const [path, downloads] of [
    [
      "components/dashboard/FileView.tsx",
      /downloads=\{\[\{ label: DOWNLOAD, run: download \}\]\}/u,
    ],
    [
      "app/account/runs/[runId]/RunLive.tsx",
      /\{ label: DOWNLOAD_PDF, run: download\("pdf"\) \},\s*\{ label: DOWNLOAD_EXCEL, run: download\("xlsx"\) \},/u,
    ],
    [
      "app/account/settings/CompleteExportSection.tsx",
      /\{ label: "Download file", run: download, disabled: pending \},/u,
    ],
    [
      "app/account/settings/WorkspaceExportSection.tsx",
      /label: "Download JSON",/u,
    ],
  ]) {
    const source = read(path);
    assert.match(source, /<FileActions\b/u, path);
    assert.match(source, downloads, path);
    assert.match(source, /share=\{\{/u, path);
  }
  for (const path of [
    "app/account/flows/[subscriptionId]/items/[itemId]/file/page.tsx",
    "app/account/runs/[runId]/files/[fileId]/page.tsx",
  ])
    assert.match(read(path), /<FileView\b/u, path);
});

test("F4: Share sends the file itself, a File of its bytes and type — never a URL", async () => {
  const sent = [];
  const sheet = { share: async (data) => sent.push(data) };
  const bytes = new Blob(["%PDF-1.4"], { type: "application/octet-stream" });
  const { preparedShare, readShareFile, shareFile } = loaded.modules[ACTIONS];
  const file = await readShareFile({
    filename: "run.pdf",
    contentType: "application/pdf",
    read: async () => ({ blob: bytes, filename: "0a0a.pdf" }),
  });
  const error = await shareFile(file, sheet);
  assert.equal(error, null);
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0]).sort(), ["files", "title"]);
  const [shared] = sent[0].files;
  assert.ok(shared instanceof File);
  assert.equal(shared.name, "0a0a.pdf");
  assert.equal(shared.type, "application/pdf");
  assert.equal(await shared.text(), "%PDF-1.4");
  // With no name from the route, its own.
  assert.equal(
    (
      await readShareFile({
        filename: "a.pdf",
        contentType: "application/pdf",
        read: async () => ({ blob: bytes }),
      })
    ).name,
    "a.pdf",
  );
  // Closing the sheet is no refusal; anything else is.
  const closed = await shareFile(file, {
    share: async () => {
      throw new DOMException("closed", "AbortError");
    },
  });
  assert.equal(closed, null);
  const refused = await preparedShare({
    filename: "a.pdf",
    contentType: "application/pdf",
    read: async () => {
      throw new Error("no");
    },
  }).press(sheet);
  assert.equal(refused, "Could not share. Try again.");
  // Each place reads the bytes from this site's own routes, never a signed link.
  assert.match(
    read("components/dashboard/FileView.tsx"),
    /read: async \(\) => \(\{ blob: await siteFileBlob\(viewHref\) \}\)/u,
  );
  assert.match(
    read("app/account/runs/[runId]/RunLive.tsx"),
    /siteFileNamed\(\s*shareHref\(\{ runId, format: "pdf", timeZone: browserTimeZone\(\) \}\),?\s*\)/u,
  );
  assert.match(
    read("app/account/settings/CompleteExportSection.tsx"),
    /read: \(\) => siteFileNamed\(shareHref\(\{ exportId: job\.id \}\)\)/u,
  );
  assert.match(
    read("app/account/settings/WorkspaceExportSection.tsx"),
    /read: async \(\) => exportFile\(response\)/u,
  );
});

test("F4: Share opens the sheet in the press itself, its file read before — a slow read is no NotAllowedError", async () => {
  const { preparedShare } = loaded.modules[ACTIONS];
  // A browser's share sheet: open only while the press lasts (its user
  // activation), refused with NotAllowedError after.
  let pressing = false;
  const sent = [];
  const sheet = {
    share: async (data) => {
      if (!pressing) throw new DOMException("no activation", "NotAllowedError");
      sent.push(data);
    },
  };
  const press = (prepared) => {
    pressing = true;
    const done = prepared.press(sheet);
    pressing = false;
    return done;
  };
  const slow = (read) => ({
    filename: "run.pdf",
    contentType: "application/pdf",
    read: () =>
      new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(read());
          } catch (thrown) {
            reject(thrown);
          }
        }, 30),
      ),
  });
  const bytes = () => ({ blob: new Blob(["%PDF-1.4"]) });
  // Read as soon as Share can show; the press then shares at once.
  const prepared = preparedShare(slow(bytes));
  assert.equal(prepared.ready(), null);
  assert.ok((await prepared.reading) instanceof File);
  assert.equal(await press(prepared), null);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].files[0].name, "run.pdf");
  // A read that failed is read again in the press: the sheet then refuses,
  // said as a refusal, never thrown.
  let reads = 0;
  const failing = preparedShare(
    slow(() => {
      reads += 1;
      if (reads === 1) throw new Error("busy");
      return bytes();
    }),
  );
  assert.equal(await failing.reading, null);
  assert.equal(await press(failing), "Could not share. Try again.");
  assert.equal(sent.length, 1);
  // The page asks it at once: Share waits for the read, and the press calls it.
  const source = read(ACTIONS);
  assert.match(source, /const made = preparedShare\(latest\.current\);/u);
  assert.match(
    source,
    /if \(ready && prepared\) void act\(\(\) => prepared\.share\.press\(\)\);/u,
  );
});

const request = (fetchSite, search = "?run=r1&format=pdf") => ({
  headers: new Headers(
    fetchSite === null ? {} : { "sec-fetch-site": fetchSite },
  ),
  nextUrl: new URL(`https://site.example.test/account/share${search}`),
});

test("F4: the share route refuses a request another site started, or one that does not say, before it asks the platform", async () => {
  const { GET } = loaded.modules[SHARE_ROUTE];
  const store = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = async () => {
    asked += 1;
    throw new Error("the platform was asked");
  };
  try {
    for (const site of ["cross-site", "same-site", null]) {
      const answer = await GET(request(site));
      assert.equal(answer.status, 403, String(site));
      assert.equal(answer.headers.get("cache-control"), "private, no-store");
    }
    // An address that names neither a package's document nor an export: not found.
    for (const search of [
      "",
      "?run=r1",
      "?run=r1&format=docx",
      "?export=e1&run=r1&format=pdf",
      "?export=../x",
    ]) {
      const answer = await GET(request("same-origin", search));
      assert.equal(answer.status, 404, search);
    }
  } finally {
    globalThis.fetch = store;
  }
  assert.equal(asked, 0);
  // Its answer: the bytes as an attachment of no type, never cached, nosniff.
  const route = read(SHARE_ROUTE);
  assert.match(route, /"content-type": "application\/octet-stream",/u);
  assert.match(
    route,
    /"content-disposition": `attachment; filename="\$\{safeFilename\(filename\)\}"`,/u,
  );
  assert.match(route, /"cache-control": "private, no-store",/u);
  assert.match(route, /"x-content-type-options": "nosniff",/u);
  // Only /account/ paths are read in the browser: the route is one.
  assert.match(
    read("lib/run-documents.ts"),
    /return `\/account\/share\?export=/u,
  );
});
