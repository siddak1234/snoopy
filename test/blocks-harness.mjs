import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

/**
 * The blocks as the browser draws them, in Node (backend ADR-0048): each
 * source `components/blocks/BlockList.tsx` imports, followed through `@/` and
 * relative paths, transpiled with TypeScript as `global-error-render` does,
 * and loaded from under `node_modules` so `react`, `next` and the icons
 * resolve. `mutate` changes a source before it is transpiled — the copy of
 * the renderer a bite proof needs. Not a test file: the block tests share it.
 */

const root = resolve(import.meta.dirname, "..");
const ENTRY = "components/blocks/BlockList.tsx";

function sourceOf(path) {
  for (const candidate of [path, `${path}.tsx`, `${path}.ts`]) {
    const full = join(root, candidate);
    if (existsSync(full) && !candidate.endsWith("/")) {
      if (/\.(?:tsx?|mjs|js)$/u.test(candidate)) return candidate;
    }
  }
  throw new Error(`no source for ${path}`);
}

const local = (specifier) =>
  specifier.startsWith("@/") || specifier.startsWith(".");

function resolveSpecifier(from, specifier) {
  const bare = specifier.startsWith("@/")
    ? specifier.slice(2)
    : relative(root, resolve(join(root, dirname(from)), specifier));
  return sourceOf(bare);
}

const outName = (path) => `${path.replace(/[/[\]]/gu, "_")}.mjs`;

export async function loadBlocks({ mutate = (_, source) => source } = {}) {
  const cache = join(root, "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  const directory = mkdtempSync(join(cache, "blocks-"));
  const done = new Set();
  const pending = [ENTRY];
  while (pending.length > 0) {
    const path = pending.pop();
    if (done.has(path)) continue;
    done.add(path);
    const source = mutate(path, readFileSync(join(root, path), "utf8"));
    let output = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    output = output.replace(
      /(\bfrom\s*|\bimport\s*)"([^"]+)"/gu,
      (whole, lead, specifier) => {
        if (specifier === "next/link") return `${lead}"next/link.js"`;
        if (!local(specifier)) return whole;
        const target = resolveSpecifier(path, specifier);
        pending.push(target);
        return `${lead}"./${outName(target)}"`;
      },
    );
    writeFileSync(join(directory, outName(path)), output);
  }
  const blocks = await import(
    pathToFileURL(join(directory, outName(ENTRY))).href
  );
  const look = await import(
    pathToFileURL(join(directory, outName("components/blocks/look.ts"))).href
  );
  const fallback = await import(
    pathToFileURL(join(directory, outName("components/blocks/Fallback.tsx")))
      .href
  );
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  return {
    ...blocks,
    look,
    FALLBACK: fallback.FALLBACK,
    createElement,
    render: (list, context) =>
      renderToStaticMarkup(
        createElement(blocks.BlockList, { blocks: list, context }),
      ),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

const VOID = new Set([
  "area",
  "br",
  "col",
  "hr",
  "img",
  "input",
  "meta",
  "wbr",
]);

const decode = (text) =>
  text
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;/gu, "'")
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, "&");

/** Static markup as a tree: elements with their attributes, and text. */
export function parse(markup) {
  const top = { tag: "#root", attrs: {}, children: [] };
  const stack = [top];
  const pattern =
    /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)>|<([a-zA-Z0-9-]+)([^>]*?)(\/?)>|([^<]+)/gu;
  for (const match of markup.matchAll(pattern)) {
    const [, close, open, rawAttrs, selfClose, text] = match;
    const here = stack[stack.length - 1];
    if (text !== undefined) {
      here.children.push({ text: decode(text) });
    } else if (close) {
      while (stack.length > 1 && stack.pop().tag !== close);
    } else if (open) {
      const attrs = {};
      for (const [, name, value] of rawAttrs.matchAll(
        /([a-zA-Z0-9:_-]+)(?:="([^"]*)")?/gu,
      ))
        attrs[name] = value === undefined ? "" : decode(value);
      const node = { tag: open, attrs, children: [] };
      here.children.push(node);
      if (!selfClose && !VOID.has(open)) stack.push(node);
    }
  }
  return top;
}

/**
 * The words a person sees, in reading order (the fixtures' `text`): every
 * text node, trimmed; a closed `<details>` its `<summary>` alone; words only
 * a screen reader hears (`sr-only`) and a page's own forms (`data-block-form`)
 * left out; a column drawn reversed (`flex-col-reverse`, a tile's value over
 * its label) read as it is seen.
 */
export function visibleWords(markup) {
  const words = [];
  const walk = (node) => {
    if (node.text !== undefined) {
      const text = node.text.trim();
      if (text) words.push(text);
      return;
    }
    const classes = (node.attrs.class ?? "").split(/\s+/u);
    if (classes.includes("sr-only") || "data-block-form" in node.attrs) return;
    let children = node.children;
    if (node.tag === "details" && !("open" in node.attrs))
      children = children.filter((child) => child.tag === "summary");
    if (classes.includes("flex-col-reverse"))
      children = [...children].reverse();
    children.forEach(walk);
  };
  walk(parse(markup));
  return words;
}

/** Every element of a tree, depth first. */
export function elements(node, out = []) {
  if (node.tag) {
    out.push(node);
    node.children.forEach((child) => elements(child, out));
  }
  return out;
}
