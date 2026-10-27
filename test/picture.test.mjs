import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  COULD_NOT_SHOW,
  FILE_GONE,
  FILE_OPENING,
  TRY_AGAIN,
} from "../lib/run-files.ts";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The image block's picture (backend ADR-0048 amendment 1, decision 2): read
 * once from its file page's own view route, through `siteFileBlob`, and drawn
 * by its state — "Opening the file…" while it is read, "This file is no
 * longer kept." for a 404, "Could not open the file. Try again." and Try
 * again for any other refusal (which reads again), the image or the PDF's
 * frame once read. The fetch is never written by hand: each answer it gives
 * is the one the site's real view route (`fileViewResponse`) made, in this
 * test, for the platform's answer — a signed link to a real PNG's bytes, its
 * 404, its 500 — with only the session and the workspace stood in. The four
 * words are `lib/run-files.ts`'s, the app's exactly, and Picture.tsx holds
 * none of them.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const PICTURE = "components/blocks/Picture.tsx";
const FILE_VIEW = "lib/file-view.ts";
const SERVER = "lib/platform-server.ts";
const API = "lib/platform-api.ts";
// A real PNG, this repository's own: the store's bytes behind the signed link.
const PNG = readFileSync(
  join(root, "e2e/marketing.visual.spec.ts-snapshots/contact-linux.png"),
);
const PAGE = "/account/runs/r1/files/f1";
const VIEW = `${PAGE}/view`;

let loaded;
let recorded;
before(async () => {
  loaded = await loadModules([PICTURE, FILE_VIEW, SERVER, API], {
    stubs: {
      "@/lib/app-session":
        "export const getAppSession = async () => ({ user: { id: 'u1', email: 'a@example.test' } });",
      "@/lib/tenancy":
        "export const resolveActiveWorkspaceId = async () => 'w1';",
    },
  });
  recorded = await recordViewAnswers();
});
after(() => loaded?.cleanup());

/** The view route's real answers, as this site's page asks for the file. */
async function recordViewAnswers() {
  const { fileViewResponse } = loaded.modules[FILE_VIEW];
  const { PlatformServerError } = loaded.modules[SERVER];
  const request = {
    headers: new Headers({ "sec-fetch-site": "same-origin" }),
  };
  const file = {
    id: "f1",
    filename: "receipt.png",
    contentType: "image/png",
    format: "PNG",
    sizeBytes: PNG.byteLength,
    pages: 1,
    measuredKind: "png",
  };
  const store = globalThis.fetch;
  // The signed link's store: the PNG's bytes, as an object store answers them.
  globalThis.fetch = async () =>
    new Response(PNG, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(PNG.byteLength),
      },
    });
  try {
    const shown = await fileViewResponse(request, async () => ({
      file,
      downloadUrl: "https://store.example.test/receipt.png?signature=x",
    }));
    const gone = await fileViewResponse(request, async () => {
      throw new PlatformServerError("Not found", 404);
    });
    const failed = await fileViewResponse(request, async () => {
      throw new PlatformServerError("The platform failed", 500);
    });
    return {
      shown: {
        status: shown.status,
        headers: [...shown.headers],
        body: new Uint8Array(await shown.arrayBuffer()),
      },
      gone: {
        status: gone.status,
        headers: [...gone.headers],
        body: await gone.text(),
      },
      failed: {
        status: failed.status,
        headers: [...failed.headers],
        body: await failed.text(),
      },
    };
  } finally {
    globalThis.fetch = store;
  }
}

/** The browser's fetch, answering every read with one recorded answer; the paths it was asked. */
function answering(answer) {
  const asked = [];
  globalThis.fetch = async (path) => {
    asked.push(path);
    return new Response(answer.body, {
      status: answer.status,
      headers: answer.headers,
    });
  };
  return asked;
}

async function readWith(answer) {
  const store = globalThis.fetch;
  const asked = answering(answer);
  try {
    return { result: await loaded.modules[PICTURE].readPicture(VIEW), asked };
  } finally {
    globalThis.fetch = store;
  }
}

const { renderToStaticMarkup } = await import("react-dom/server");
const drawn = (state, { pdf = false, onRetry = () => {} } = {}) =>
  loaded.modules[PICTURE].PictureView({
    state,
    alt: "The receipt",
    page: PAGE,
    pdf,
    onRetry,
  });
const markup = (state, options) => renderToStaticMarkup(drawn(state, options));

test("the view route's answers, recorded: the PNG inline in its type, a 404 and a 502 in its words", () => {
  assert.equal(recorded.shown.status, 200);
  assert.ok(
    recorded.shown.headers.some(
      ([name, value]) => name === "content-type" && value === "image/png",
    ),
  );
  assert.deepEqual(
    [...recorded.shown.body.slice(0, 4)],
    [0x89, 0x50, 0x4e, 0x47],
  );
  assert.equal(recorded.gone.status, 404);
  assert.equal(recorded.failed.status, 502);
  assert.equal(recorded.failed.body, COULD_NOT_SHOW);
});

test("while it is read: Opening the file…; the server's first draw says nothing", () => {
  assert.deepEqual(visibleWords(markup({ kind: "opening" })), [FILE_OPENING]);
  assert.deepEqual(visibleWords(markup({ kind: "idle" })), []);
});

test("a 404 from its route: This file is no longer kept.", async () => {
  const { result, asked } = await readWith(recorded.gone);
  assert.deepEqual(asked, [VIEW]);
  assert.deepEqual(result, { kind: "gone" });
  assert.deepEqual(visibleWords(markup(result)), [FILE_GONE]);
});

test("any other refusal: Could not open the file. Try again., and Try again, which reads it again", async () => {
  for (const answer of [recorded.failed, { ...recorded.failed, status: 500 }]) {
    const { result } = await readWith(answer);
    assert.deepEqual(result, { kind: "failed" });
    assert.deepEqual(visibleWords(markup(result)), [COULD_NOT_SHOW, TRY_AGAIN]);
  }
  // Pressing Try again: the press is the picture's read again.
  let reads = 0;
  const view = drawn({ kind: "failed" }, { onRetry: () => (reads += 1) });
  const button = view.props.children.find(
    (child) => child && child.props && child.props.children === TRY_AGAIN,
  );
  button.props.onClick();
  assert.equal(reads, 1);
  // The live part reads once per press: its effect keys on the count of reads.
  assert.match(
    read(PICTURE),
    /onRetry=\{\(\) => setReads\(\(count\) => count \+ 1\)\}/u,
  );
  assert.match(read(PICTURE), /\}, \[view, reads\]\);/u);
});

test("read: a JPEG or PNG an <img> with its alt, inside its file page's link; a PDF an <iframe> titled with its alt", async () => {
  const { result } = await readWith(recorded.shown);
  assert.equal(result.kind, "shown");
  assert.equal(result.blob.type, "image/png");
  const state = { kind: "shown", url: "blob:https://site.example.test/1" };
  const image = elements(parse(markup(state)));
  const img = image.find((node) => node.tag === "img");
  assert.equal(img.attrs.alt, "The receipt");
  assert.equal(img.attrs.src, state.url);
  assert.match(img.attrs.class, /max-h-\[480px\]/u);
  assert.match(img.attrs.class, /object-contain/u);
  assert.equal(image.find((node) => node.tag === "a").attrs.href, PAGE);
  const frame = elements(parse(markup(state, { pdf: true }))).find(
    (node) => node.tag === "iframe",
  );
  assert.equal(frame.attrs.title, "The receipt");
  assert.match(frame.attrs.class, /h-\[480px\]/u);
});

test("the four words are lib/run-files.ts's, the app's exactly, and Picture.tsx types none of them", () => {
  assert.equal(FILE_OPENING, "Opening the file…");
  assert.equal(FILE_GONE, "This file is no longer kept.");
  assert.equal(COULD_NOT_SHOW, "Could not open the file. Try again.");
  assert.equal(TRY_AGAIN, "Try again");
  const source = read(PICTURE);
  for (const words of [FILE_OPENING, FILE_GONE, COULD_NOT_SHOW, TRY_AGAIN])
    assert.ok(!source.includes(`"${words}"`), words);
  // The file route says the same words, from the same place.
  assert.match(read(FILE_VIEW), /import \{\s*COULD_NOT_SHOW,/u);
  assert.doesNotMatch(read(FILE_VIEW), /const COULD_NOT_SHOW =/u);
});

test("the object URL is let go when the picture leaves the page", () => {
  assert.match(
    read(PICTURE),
    /return \(\) => \{\s*live = false;\s*if \(url\) URL\.revokeObjectURL\(url\);\s*\};/u,
  );
});
