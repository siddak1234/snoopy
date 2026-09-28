import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

/**
 * `app/global-error.tsx` renders only when the root layout itself throws, and
 * nothing in this tree can make it throw — so no browser test reaches it
 * (register § Round 15, surface 23). It is rendered here instead: transpiled
 * with TypeScript, the one alias it uses pointed at the transpiled Button, the
 * stylesheet import dropped (Node cannot load CSS), and rendered to markup.
 * The source is checked to still import the stylesheet before it is dropped.
 */

const root = resolve(import.meta.dirname, "..");

function transpile(path) {
  return ts.transpileModule(readFileSync(join(root, path), "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

test("the last boundary brings its own document and says the site could not load, with Try again", async () => {
  // Under node_modules so `react` and `next` resolve from the transpiled files.
  const cache = join(root, "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  const directory = mkdtempSync(join(cache, "global-error-"));
  try {
    // `next` publishes no exports map, so Node's ESM loader needs the file.
    writeFileSync(
      join(directory, "Button.mjs"),
      transpile("components/ui/Button.tsx").replace(
        '"next/link"',
        '"next/link.js"',
      ),
    );
    const boundary = transpile("app/global-error.tsx");
    assert.match(boundary, /import "\.\/globals\.css";/u);
    writeFileSync(
      join(directory, "global-error.mjs"),
      boundary
        .replace('import "./globals.css";', "")
        .replace('"@/components/ui/Button"', '"./Button.mjs"'),
    );
    const { default: GlobalError } = await import(
      pathToFileURL(join(directory, "global-error.mjs")).href
    );
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(
      createElement(GlobalError, { retry() {} }),
    );
    // It replaces the root layout, so it is a whole document in the default
    // (dark) theme — the theme script does not run here.
    assert.match(
      markup,
      /^<html lang="en" data-theme="dark">(?:<head><\/head>)?<body[^>]*>/u,
    );
    assert.match(markup, /role="alert" aria-labelledby="global-error-title"/u);
    assert.match(
      markup,
      /<h1 id="global-error-title"[^>]*>Autom8x could not load<\/h1>/u,
    );
    assert.match(markup, /<button[^>]*>Try again<\/button>/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
