import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import {
  BRAND_FILE_SHA256,
  BRAND_MARK_NAMES,
  QUICKBOOKS_SYMBOL,
  brandMark,
} from "../lib/brand-logos.ts";

/**
 * A vendor's mark on the one connection row (Build 21, spec A4; the session's
 * S12; the owner's build 20 items 6–8 and his ~04:15Z: "we will list on apples
 * app store not intuits. so we do not need that"): QuickBooks' round symbol —
 * a square crop of Intuit's preferred logo, its pixels unchanged — and the
 * design's own Google glyph, each at 24; no Intuit button image and no
 * "Disconnect from QuickBooks". Every bundled file is held to its sha256.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("every bundled vendor file is held to its sha256 — the symbol the app bundles, byte for byte — and nothing else is in public/vendors/", () => {
  assert.deepEqual(BRAND_FILE_SHA256, {
    "public/vendors/quickbooks-logo.png":
      "67fcdc67a032a068feeecddecb0cd9f4d12020dddb199a3c155837abef3cc2eb",
    "public/vendors/quickbooks-logo-reversed.png":
      "3837c7d32394cc53f9785d02a307cfa71fa5b602b2be159964e02cdcd735b21e",
    // snoopy-mobile assets/vendors/quickbooks-symbol.png's sha256.
    "public/vendors/quickbooks-symbol.png":
      "616e1f163e195b6267d2ff92735a40db13f83ca04c42af97060b702694ecaf9b",
  });
  for (const [path, expected] of Object.entries(BRAND_FILE_SHA256)) {
    assert.equal(sha256(read(path)), expected, path);
  }
  assert.deepEqual(
    readdirSync(join(root, "public/vendors")).sort(),
    Object.keys(BRAND_FILE_SHA256)
      .map((path) => path.slice("public/vendors/".length))
      .sort(),
  );
});

test("the QuickBooks symbol is the preferred logo's top-left 536 × 536, from the file the record names", () => {
  assert.equal(QUICKBOOKS_SYMBOL.file, "public/vendors/quickbooks-symbol.png");
  assert.equal(QUICKBOOKS_SYMBOL.source, "public/vendors/quickbooks-logo.png");
  assert.equal(
    sha256(read(QUICKBOOKS_SYMBOL.source)),
    QUICKBOOKS_SYMBOL.sourceSha256,
  );
  assert.deepEqual(QUICKBOOKS_SYMBOL.crop, {
    left: 0,
    top: 0,
    width: 536,
    height: 536,
  });
  // Its size, read from the PNG's header; the source's own 2345 × 600.
  const symbol = read(QUICKBOOKS_SYMBOL.file);
  assert.equal(symbol.readUInt32BE(16), 536);
  assert.equal(symbol.readUInt32BE(20), 536);
  const logo = read(QUICKBOOKS_SYMBOL.source);
  assert.equal(logo.readUInt32BE(16), 2345);
  assert.equal(logo.readUInt32BE(20), 600);
});

test("a mark is resolved by the provider's icon name alone: QuickBooks' symbol, Google's glyph, and any other name none", () => {
  assert.deepEqual(BRAND_MARK_NAMES, ["QuickBooksLogo", "GoogleLogo"]);
  assert.deepEqual(brandMark("QuickBooksLogo"), {
    kind: "image",
    src: "/vendors/quickbooks-symbol.png",
    alt: "QuickBooks",
  });
  assert.deepEqual(brandMark("GoogleLogo"), {
    kind: "glyph",
    provider: "google",
    alt: "Google",
  });
  // The image a row draws is a checked file.
  assert.ok(
    Object.hasOwn(
      BRAND_FILE_SHA256,
      `public${brandMark("QuickBooksLogo").src}`,
    ),
  );
  for (const name of [
    "PlugsConnected",
    "quickbooks",
    "quickbooksLogo",
    "toString",
    "constructor",
    "__proto__",
    "",
    null,
    undefined,
  ]) {
    assert.equal(brandMark(name), null, String(name));
  }
});

test("a row draws a mark at 24 × 24, the vendor's file as it is — never re-encoded — and no Intuit button anywhere", () => {
  const row = read("components/dashboard/ConnectionRow.tsx").toString("utf8");
  assert.match(row, /width=\{24\}\s+height=\{24\}\s+unoptimized/u);
  assert.match(
    row,
    /<ProviderGlyph provider=\{mark\.provider\} size=\{24\} \/>/u,
  );
  assert.match(row, /export const CONNECTION_ROW =\s*"flex min-h-16 /u);
  // Gone with the owner's ~04:15Z: the button image, its words, its styles.
  const css = read("app/globals.css").toString("utf8");
  assert.doesNotMatch(css, /vendor-connect|vendor-logo/u);
  for (const path of websiteModules()) {
    // Code only: a comment may say what was removed.
    const code = read(path)
      .toString("utf8")
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/^\s*\/\/.*$/gmu, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "");
    assert.doesNotMatch(
      code,
      /connect-to-quickbooks|Connect to QuickBooks|Disconnect from QuickBooks|VendorConnectButton/u,
      path,
    );
  }
});

/** The website's own modules, parsed, less the generated contracts. */
function websiteModules() {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (path !== "lib/generated") walk(path);
      } else if (/\.tsx?$/u.test(entry.name)) found.push(path);
    }
  };
  for (const directory of ["app", "components", "lib"]) walk(directory);
  return found;
}

test("QuickBooks is never 'QB' or 'QBO' in words a person reads (Intuit's co-branding guidelines, p24)", () => {
  const said = [];
  for (const path of websiteModules()) {
    const source = ts.createSourceFile(
      path,
      read(path).toString("utf8"),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      if (
        (ts.isStringLiteralLike(node) || ts.isJsxText(node)) &&
        /\bQBO?\b/u.test(node.text)
      )
        said.push(`${path}: ${node.text.trim()}`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(said, []);
});
