import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * The spacing check's reader (backend ADR-0048 amendment 1; the owner's F3
 * and Q8): every padding, margin and gap class in a source's strings — its
 * quoted and template text, `${…}` left out — so `test/spacing.test.mjs` can
 * hold each to the table's classes (`lib/spacing.ts`). Not a test file.
 */

const root = resolve(import.meta.dirname, "..");

/** A padding, margin, gap or space class, at any breakpoint or state. */
export const SPACING_CLASS =
  /^(?:[a-z0-9/[\]-]+:)*!?-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y)-(?:\d+(?:\.\d+)?|px|\[[^\]]+\])$/u;

/** The text of a source's string literals: quoted, and template parts outside `${…}`. */
function stringTexts(source) {
  const out = [];
  const pattern =
    /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/gu;
  for (const match of source.matchAll(pattern)) {
    const text = match[1] ?? match[2] ?? match[3] ?? "";
    out.push(
      match[3] !== undefined ? text.replace(/\$\{[^}]*\}/gu, " ") : text,
    );
  }
  return out;
}

/**
 * A band or a section title typed by hand (the review's finding 4): a string
 * holding a band's classes — the table's `group` above and below (`py-4`),
 * none above the first (`first:pt-0`), or a divider over `pt-4` — or a
 * title's small capitals (`tracking-wide` with `uppercase`). The page card's
 * bands are `Group` (or `GROUP_BAND` with `SectionTitle`), its titles
 * `SectionTitle`; each says it once, in `lib/spacing.ts` and those parts.
 */
export function handBands(source) {
  const out = [];
  // Comments are words about the classes, not classes.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/^\s*\/\/.*$/gmu, " ");
  for (const text of stringTexts(code)) {
    const tokens = new Set(text.split(/\s+/u));
    if (
      tokens.has("py-4") ||
      tokens.has("first:pt-0") ||
      (tokens.has("border-t") && tokens.has("pt-4"))
    )
      out.push(`band: ${text.trim()}`);
    if (tokens.has("tracking-wide") && tokens.has("uppercase"))
      out.push(`title: ${text.trim()}`);
  }
  return out;
}

/** Each spacing class a source names, in order. */
export function spacingTokens(source) {
  return stringTexts(source)
    .flatMap((text) => text.split(/\s+/u))
    .filter((token) => SPACING_CLASS.test(token));
}

/** The sources the check reads: components/ and app/account, .ts and .tsx. */
export function spacingSources() {
  const out = [];
  const walk = (folder) => {
    for (const name of readdirSync(join(root, folder)).sort()) {
      const path = join(folder, name);
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else if (/\.tsx?$/u.test(name))
        out.push(relative(root, join(root, path)));
    }
  };
  walk("components");
  walk("app/account");
  return out;
}

/** Each source's classes not in `allowed`, counted: `{ path: { class: n } }`. */
export function offTable(
  allowed,
  read = (path) => readFileSync(join(root, path), "utf8"),
) {
  const set = new Set(allowed);
  const found = {};
  for (const path of spacingSources()) {
    for (const token of spacingTokens(read(path))) {
      if (set.has(token)) continue;
      found[path] ??= {};
      found[path][token] = (found[path][token] ?? 0) + 1;
    }
  }
  return found;
}
