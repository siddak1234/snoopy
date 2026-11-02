import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  backendRoot as resolveBackendRoot,
  COPY,
  copyProblems,
  inputFiles,
  root,
  sha256,
} from "./backend-contract.mjs";

// The committed contract files against what they came from (Round 21
// hardening, W1, W12): never a skip, in CI or in any clone. The root is
// SNOOPY_BACKEND_ROOT, else ../snoopy-backend, else the committed copy
// (scripts/backend-contract.mjs). Three checks, each reported, none rewriting
// the tree it judged (register F6):
//   1 the copy matches its SHA256SUMS, file for file, and holds nothing else;
//   2 each generated file's header names the sha256 of the copy's bytes it
//     says it came from;
//   3 the generator, run from the root, writes exactly the committed
//     generated files and the committed copy.
const backendRoot = resolveBackendRoot();
const generated = (name) =>
  join(root, "lib/generated/platform-contracts", name);
const outputs = [
  "platform.d.ts",
  "automations.d.ts",
  "connections.d.ts",
  "block-fixtures.ts",
  "block-rules.ts",
  "block-required.ts",
].map(generated);

for (const output of outputs) {
  if (!existsSync(output)) {
    throw new Error(
      "Generated platform types are missing; run npm run generate:platform-contracts and commit the output",
    );
  }
}
console.log(
  `verify-platform-contracts: root ${relative(root, backendRoot) || "."}`,
);

// 1. The copy against its SHA256SUMS.
const problems = copyProblems();
if (problems.length > 0) {
  throw new Error(
    `The backend contract copy is not what its SHA256SUMS says (lib/generated/snoopy-backend): ${problems.join("; ")}. Run npm run generate:platform-contracts from a backend checkout and commit the output; nothing was changed.`,
  );
}

// 2. Each header against the copy's bytes: a document by its own hash, a
// folder by one hash over its *.json files in name order.
const folderHash = (folder) =>
  sha256(
    Buffer.concat(
      inputFiles(COPY)
        .filter((path) => path.startsWith(`${folder}/`))
        .map((path) => readFileSync(join(COPY, path))),
    ),
  );
const headers = [
  ["platform.d.ts", "docs/openapi.yaml", null],
  ["automations.d.ts", "docs/openapi/automations.yaml", null],
  ["connections.d.ts", "docs/openapi/connections.yaml", null],
  ["block-required.ts", "docs/openapi/automations.yaml", null],
  ["block-fixtures.ts", "packages/contracts/fixtures/blocks", "/*.json"],
  ["block-rules.ts", "packages/contracts/fixtures/block-rules", "/*.json"],
];
const unheaded = headers.filter(([name, source, folder]) => {
  const hash = folder
    ? folderHash(source)
    : sha256(readFileSync(join(COPY, source)));
  const want = `// From snoopy-backend ${source}${folder ?? ""}, sha256 ${hash}.`;
  return readFileSync(generated(name), "utf8").split("\n")[0] !== want;
});
if (unheaded.length > 0) {
  throw new Error(
    `Generated platform types do not name the copy they came from: ${unheaded
      .map(([name]) => name)
      .join(
        ", ",
      )}. Run npm run generate:platform-contracts and commit the output; nothing was changed.`,
  );
}

// 3. Regenerate and compare. The generator writes in place, so what it wrote
// is compared and then the committed bytes are put back — the generated files
// and the copy — whether they were stale or the generator failed part-way.
// Regenerating on purpose is `npm run generate:platform-contracts`.
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : [relative(COPY, join(dir, entry.name))],
  );
const snapshotCopy = () =>
  new Map(walk(COPY).map((path) => [path, readFileSync(join(COPY, path))]));
const sameCopy = (a, b) =>
  a.size === b.size &&
  [...a].every(([path, bytes]) => b.get(path)?.equals(bytes));

const before = outputs.map((output) => readFileSync(output));
const copyBefore = snapshotCopy();
let after;
let copyAfter;
try {
  execFileSync(process.execPath, ["scripts/generate-platform-contracts.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
  after = outputs.map((output) => readFileSync(output));
  copyAfter = snapshotCopy();
} finally {
  outputs.forEach((output, index) => {
    if (!readFileSync(output).equals(before[index])) {
      writeFileSync(output, before[index]);
    }
  });
  if (!existsSync(COPY) || !sameCopy(copyBefore, snapshotCopy())) {
    rmSync(COPY, { recursive: true, force: true });
    for (const [path, bytes] of copyBefore) {
      mkdirSync(dirname(join(COPY, path)), { recursive: true });
      writeFileSync(join(COPY, path), bytes);
    }
  }
}

const stale = outputs
  .filter((_, index) => !before[index].equals(after[index]))
  .map((output) => relative(root, output));
if (!sameCopy(copyBefore, copyAfter)) stale.push(relative(root, COPY));
if (stale.length > 0) {
  throw new Error(
    `Generated platform types are stale: ${stale.join(
      ", ",
    )}. Run npm run generate:platform-contracts and commit the output; nothing was changed.`,
  );
}
console.log(
  "verify-platform-contracts: the copy, the headers and a regeneration agree",
);
