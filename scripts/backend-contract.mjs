// Where the backend's contract files are read from (Round 21 hardening, W1,
// option (b) as the owner chose 2026-11-01: a hash-checked COPY, no key).
//
// The generator (scripts/generate-platform-contracts.mjs), its check
// (scripts/verify-platform-contracts.mjs) and the contract tests read six
// backend paths. They are committed, byte for byte, under
// lib/generated/snoopy-backend/<the same paths>, with SHA256SUMS beside them,
// so every check runs in CI and in any clone, with no sibling checkout and
// never a skip. The copy is written only by the generator, from a real
// backend checkout; it is never edited by hand.
//
// The root, in order: SNOOPY_BACKEND_ROOT (resolved from this repository's
// root; empty means unset), else ../snoopy-backend when it holds every input,
// else the copy.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const root = resolve(import.meta.dirname, "..");
export const COPY = join(root, "lib/generated/snoopy-backend");
export const SUMS = join(COPY, "SHA256SUMS");

/** The six backend paths the website reads: three documents, a schema, two folders of JSON. */
export const INPUTS = [
  "docs/openapi.yaml",
  "docs/openapi/automations.yaml",
  "docs/openapi/connections.yaml",
  "docs/repo-facts.schema.json",
  "packages/contracts/fixtures/blocks",
  "packages/contracts/fixtures/block-rules",
];

/** The backend root every reader agrees on. */
export function backendRoot() {
  if (process.env.SNOOPY_BACKEND_ROOT)
    return resolve(root, process.env.SNOOPY_BACKEND_ROOT);
  const sibling = resolve(root, "../snoopy-backend");
  if (INPUTS.every((input) => existsSync(join(sibling, input)))) return sibling;
  return COPY;
}

/** Each input file under `base`, as a path relative to it, in name order; a folder's `*.json` only. */
export function inputFiles(base) {
  return INPUTS.flatMap((input) => {
    const path = join(base, input);
    if (!existsSync(path))
      throw new Error(`Required backend input is unavailable: ${path}`);
    if (!statSync(path).isDirectory()) return [input];
    return readdirSync(path)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => `${input}/${name}`);
  });
}

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** SHA256SUMS's text for the files under `base`: `<sha256>  <path>` lines, as `shasum -a 256 -c` reads them. */
export function sumsText(base) {
  return inputFiles(base)
    .map((path) => `${sha256(readFileSync(join(base, path)))}  ${path}\n`)
    .join("");
}

/**
 * The copy against its SHA256SUMS: every listed file present with its hash,
 * and no file in the copy that the list does not name. The problems found;
 * none is a sound copy.
 */
export function copyProblems() {
  if (!existsSync(SUMS)) return [`${relative(root, SUMS)} is missing`];
  const listed = new Map(
    readFileSync(SUMS, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, path] = line.split(/ {2}/u);
        return [path, hash];
      }),
  );
  const problems = [];
  for (const input of INPUTS) {
    if (
      ![...listed.keys()].some(
        (path) => path === input || path.startsWith(`${input}/`),
      )
    )
      problems.push(`${input} is not in SHA256SUMS`);
  }
  for (const [path, hash] of listed) {
    const file = join(COPY, path);
    if (!existsSync(file)) problems.push(`${path} is listed but missing`);
    else if (sha256(readFileSync(file)) !== hash)
      problems.push(`${path} does not match its SHA256SUMS line`);
  }
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : [relative(COPY, join(dir, entry.name))],
    );
  for (const path of walk(COPY)) {
    if (path !== "SHA256SUMS" && !listed.has(path))
      problems.push(`${path} is in the copy but not in SHA256SUMS`);
  }
  return problems;
}
