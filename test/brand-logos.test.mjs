import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import {
  BRAND_FILE_SHA256,
  BRAND_LOGOS,
  DISCONNECT_BODY,
  brandLogo,
  disconnectTitle,
} from "../lib/brand-logos.ts";

/**
 * A vendor's own logo and connect button, as the vendor gives them (spec §4;
 * backend BUILD-PLAN 25.4.18). Intuit's rules: "Don't alter the QuickBooks
 * logo in any way", "Do not modify the appearance of any button graphics",
 * "All Intuit and QuickBooks logos and buttons in your app use the approved and
 * provided images" — so every bundled file is held to the sha256 recorded from
 * Intuit's download (the spec's §4.1), and the page shows them only as they
 * are.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("every bundled vendor file is the vendor's own, byte for byte (spec §4.1)", () => {
  // The values the spec recorded from Intuit's downloads on 2026-10-14.
  assert.deepEqual(BRAND_FILE_SHA256, {
    "public/vendors/quickbooks-logo.png":
      "67fcdc67a032a068feeecddecb0cd9f4d12020dddb199a3c155837abef3cc2eb",
    "public/vendors/quickbooks-logo-reversed.png":
      "3837c7d32394cc53f9785d02a307cfa71fa5b602b2be159964e02cdcd735b21e",
    "public/vendors/connect-to-quickbooks.svg":
      "7feb6af9992966c8ab6bf8369b076aaec4ad9f55413a066d840c3073ec845ab8",
    "public/vendors/connect-to-quickbooks-hover.svg":
      "0b7fd52dd2287ca94d791e419670a8fb3458e038f8373b31c7e3b3820a236784",
  });
  for (const [path, expected] of Object.entries(BRAND_FILE_SHA256)) {
    assert.equal(sha256(read(path)), expected, path);
  }
  // Nothing else is in public/vendors/, so no file escapes the check.
  assert.deepEqual(
    readdirSync(join(root, "public/vendors")).sort(),
    Object.keys(BRAND_FILE_SHA256)
      .map((path) => path.slice("public/vendors/".length))
      .sort(),
  );
});

test("the registry names only checked files, and the light theme gets the dark wordmark (spec §4.2)", () => {
  const checked = new Set(
    Object.keys(BRAND_FILE_SHA256).map((path) => path.slice("public".length)),
  );
  for (const [name, logo] of Object.entries(BRAND_LOGOS)) {
    for (const src of [
      logo.light,
      logo.dark,
      logo.connectButton.src,
      logo.connectButton.hover,
    ]) {
      assert.ok(checked.has(src), `${name}: ${src} is not a checked file`);
    }
  }
  const quickbooks = BRAND_LOGOS.QuickBooksLogo;
  // The preferred (black wordmark) file on the light ground, the reversed
  // (white wordmark) one on the dark — by the hashes of Intuit's black and
  // white downloads.
  assert.equal(
    sha256(read(`public${quickbooks.light}`)),
    "67fcdc67a032a068feeecddecb0cd9f4d12020dddb199a3c155837abef3cc2eb",
  );
  assert.equal(
    sha256(read(`public${quickbooks.dark}`)),
    "3837c7d32394cc53f9785d02a307cfa71fa5b602b2be159964e02cdcd735b21e",
  );
  // Scaled in proportion: the aspect is the files' own, 2345 × 600 — read
  // from each PNG's header — and the button its own 274 × 48.
  for (const src of [quickbooks.light, quickbooks.dark]) {
    const png = read(`public${src}`);
    assert.equal(png.readUInt32BE(16), 2345, src);
    assert.equal(png.readUInt32BE(20), 600, src);
  }
  assert.equal(quickbooks.aspect, 2345 / 600);
  for (const src of [
    quickbooks.connectButton.src,
    quickbooks.connectButton.hover,
  ]) {
    assert.match(
      read(`public${src}`).toString("utf8"),
      /^<svg width="274" height="48" viewBox="0 0 274 48"/u,
      src,
    );
  }
  assert.equal(quickbooks.connectButton.width, 274);
  assert.equal(quickbooks.connectButton.height, 48);
  // Intuit's own words on its controls.
  assert.equal(quickbooks.connectLabel, "Connect to QuickBooks");
  assert.equal(quickbooks.disconnectLabel, "Disconnect from QuickBooks");
  assert.equal(quickbooks.alt, "QuickBooks");
});

test("a brand is resolved by the provider's icon name alone, and any other name is no brand", () => {
  assert.equal(brandLogo("QuickBooksLogo"), BRAND_LOGOS.QuickBooksLogo);
  for (const name of [
    "PlugsConnected",
    "quickbooks",
    "quickbooksLogo",
    "toString",
    "__proto__",
    "",
    null,
    undefined,
  ]) {
    assert.equal(brandLogo(name), null, String(name));
  }
});

test("a disconnect is confirmed in the vendor's own words where it has them, and the app's words otherwise (spec §3.C, §3.I)", () => {
  assert.equal(
    disconnectTitle("QuickBooksLogo", "QuickBooks Online"),
    "Disconnect from QuickBooks?",
  );
  assert.equal(
    disconnectTitle("link", "Fixture OAuth provider"),
    "Disconnect Fixture OAuth provider?",
  );
  assert.equal(disconnectTitle(undefined, "Acme"), "Disconnect Acme?");
  assert.equal(DISCONNECT_BODY, "You can connect it again any time.");
});

test("the logo is drawn 24 tall from the vendor's files as they are — never re-encoded — and the connect button at its own size", () => {
  const component = read("components/dashboard/VendorLogo.tsx").toString(
    "utf8",
  );
  // Both the logo and the button go out unoptimized: next/image would
  // otherwise serve a re-encoded copy, not the vendor's bytes.
  assert.equal((component.match(/^\s+unoptimized$/gmu) ?? []).length, 4);
  assert.match(component, /height = 24,/u);
  assert.match(
    component,
    /const width = Math\.round\(height \* logo\.aspect\);/u,
  );
  assert.match(
    component,
    /const \{ src, hover, width, height \} = logo\.connectButton;/u,
  );
  assert.match(component, /aria-label=\{logo\.connectLabel\}/u);
  // No containing shape, no recolour: the theme picks a file, never a filter.
  const css = read("app/globals.css").toString("utf8");
  const rules = css.slice(css.indexOf(".vendor-logo-light"));
  assert.doesNotMatch(
    rules.slice(0, rules.indexOf("═")),
    /filter|invert|opacity|background/u,
  );
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
