// What this repository reports about itself, in the shape snoopy-backend's
// docs/repo-facts.schema.json declares, so that repository can quote the
// website's counts without reading its files (BUILD-PLAN 20.4.2; backend
// §12.2 #68). Every count carries the command that produced it: a number
// without its command is the thing that drifted.
//
// Emitted by `npm run verify` and NEVER committed here — it would restate this
// repository's own HEAD, which is stale the moment it is written. Round 5's
// close commits the emitted file into snoopy-backend as docs/repo-facts/snoopy.json.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");
/** Where `npm run verify` writes the file; gitignored. */
export const FACTS_PATH = ".autom8x/repo-facts/snoopy.json";

// SYSTEM-MANIFEST §9's units, in its order, on ONE basis: the working tree
// minus what .gitignore excludes — tracked and untracked alike, never
// node_modules, .next or a Finder conflict copy. §9's own `find` commands read
// the raw tree (its fourth counts node_modules: 347 on a machine with
// dependencies installed), so the backend's row is corrected from this file.
const BASIS = "git ls-files --cached --others --exclude-standard -- ";
const COUNTS = [
  ["pages", `${BASIS}':(glob)app/**/page.tsx' | wc -l`],
  ["components", `${BASIS}':(glob)components/**/*.tsx' | wc -l`],
  ["libModules", `${BASIS}lib | wc -l`],
  ["testFiles", `${BASIS}':(glob)**/*.test.*' | wc -l`],
];

// `pipefail`, so a producer that fails cannot hide behind `wc`'s exit 0 and be
// recorded as a verified count of zero.
function sh(command) {
  return execFileSync("bash", ["-c", `set -o pipefail; ${command}`], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function count(unit, command) {
  const out = sh(command);
  const value = Number(out);
  if (out === "" || !Number.isInteger(value) || value < 0) {
    throw new Error(`repo-facts: ${unit} produced "${out}", not a count`);
  }
  return value;
}

export function repoFacts({ gate } = {}) {
  const counts = {};
  for (const [unit, command] of COUNTS) {
    counts[unit] = { value: count(unit, command), command };
  }
  return {
    schemaVersion: 1,
    repository: "snoopy",
    head: sh("git rev-parse --short HEAD"),
    readAt: new Date().toISOString().slice(0, 10),
    ...(gate ? { gate } : {}),
    counts,
  };
}

export function writeRepoFacts(outPath, options) {
  const facts = repoFacts(options);
  if (sh("git status --porcelain")) {
    console.warn(
      "repo-facts: the tree is dirty — counts are from the working tree while `head` is the last commit; the close copies only a clean-main emission",
    );
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(facts, null, 2)}\n`);
  return facts;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const gateIndex = process.argv.indexOf("--gate");
  const gate = gateIndex === -1 ? undefined : process.argv[gateIndex + 1];
  const facts = writeRepoFacts(resolve(root, FACTS_PATH), { gate });
  console.log(JSON.stringify(facts, null, 2));
}
