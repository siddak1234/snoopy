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
