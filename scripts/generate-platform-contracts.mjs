import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// SNOOPY_BACKEND_ROOT points at another checkout; scripts/verify.mjs and the
// contract tests read the same variable and resolve it from the repository
// root as this does, so every reader agrees. Empty means unset.
const backendRoot = resolve(
  root,
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
);
const generator = join(root, "node_modules/.bin/openapi-typescript");
const prettier = join(root, "node_modules/.bin/prettier");

// The public root document owns workspace export. The detailed fragments own
// their named product surfaces. Internal service contracts are excluded: browser
// code may call only public Edge operations.
const contracts = [
  {
    input: join(backendRoot, "docs/openapi.yaml"),
    output: join(root, "lib/generated/platform-contracts/platform.d.ts"),
  },
  {
    input: join(backendRoot, "docs/openapi/automations.yaml"),
    output: join(root, "lib/generated/platform-contracts/automations.d.ts"),
  },
  {
    input: join(backendRoot, "docs/openapi/connections.yaml"),
    output: join(root, "lib/generated/platform-contracts/connections.d.ts"),
  },
];

if (!existsSync(generator) || !existsSync(prettier)) {
  throw new Error(
    "generation dependencies are not installed; run npm install before generating contracts",
  );
}

for (const { input, output } of contracts) {
  if (!existsSync(input)) {
    throw new Error(`Required platform contract is unavailable: ${input}`);
  }
  execFileSync(generator, [input, "--output", output], {
    cwd: root,
    stdio: "inherit",
  });
  // Each file names the contract it came from by the hash of that contract's
  // bytes (register F7), so which version of the backend's contract the website
  // was built against is read from the file, not recorded by hand beside it.
  const source = relative(backendRoot, input);
  const sha256 = createHash("sha256").update(readFileSync(input)).digest("hex");
  writeFileSync(
    output,
    `// From snoopy-backend ${source}, sha256 ${sha256}.\n` +
      "// Regenerate with `npm run generate:platform-contracts`; never edit by hand.\n" +
      readFileSync(output, "utf8"),
  );
  execFileSync(prettier, [output, "--write"], {
    cwd: root,
    stdio: "inherit",
  });
}

// The block fixtures (backend ADR-0048 decision 9): every page body both
// clients must draw to exactly its `text`. One file, headed by one sha256 over
// the fixtures' bytes, each file in filename order — the rule both clients
// share, so the two headers are equal when both clients assert the same
// fixtures.
const fixtureDirectory = join(
  backendRoot,
  "packages/contracts/fixtures/blocks",
);
if (!existsSync(fixtureDirectory)) {
  throw new Error(
    `Required block fixtures are unavailable: ${fixtureDirectory}`,
  );
}
const fixtureFiles = readdirSync(fixtureDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort();
const fixtureHash = createHash("sha256");
const fixtures = fixtureFiles.map((name) => {
  const bytes = readFileSync(join(fixtureDirectory, name));
  fixtureHash.update(bytes);
  return JSON.parse(bytes.toString("utf8"));
});
const fixtureOutput = join(
  root,
  "lib/generated/platform-contracts/block-fixtures.ts",
);
writeFileSync(
  fixtureOutput,
  `// From snoopy-backend ${relative(backendRoot, fixtureDirectory)}/*.json, sha256 ${fixtureHash.digest("hex")}.\n` +
    "// Regenerate with `npm run generate:platform-contracts`; never edit by hand.\n" +
    "/** A page body and its visible words in reading order, closed sections left out. */\n" +
    "export type BlockFixture = {\n  name: string;\n  about: string;\n  blockSetVersion: number;\n  blocks: readonly unknown[];\n  text: readonly string[];\n};\n\n" +
    `export const BLOCK_FIXTURES: readonly BlockFixture[] = ${JSON.stringify(fixtures)};\n`,
);
execFileSync(prettier, [fixtureOutput, "--write"], {
  cwd: root,
  stdio: "inherit",
});

// The block rules (backend ADR-0048 amendment 1, decision 8): the words for
// search, sort and pages (`words.json`), the spacing table (`spacing.json`)
// and the cases both clients' search and sort must pass (`search.json`,
// `sort.json`). One file, headed by its own sha256 over the folder's files in
// filename order — the fixtures' rule — so a client reads the platform's
// words and numbers, never its own copy.
const rulesDirectory = join(
  backendRoot,
  "packages/contracts/fixtures/block-rules",
);
if (!existsSync(rulesDirectory)) {
  throw new Error(`Required block rules are unavailable: ${rulesDirectory}`);
}
const ruleFiles = readdirSync(rulesDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort();
const rulesHash = createHash("sha256");
const rules = Object.fromEntries(
  ruleFiles.map((name) => {
    const bytes = readFileSync(join(rulesDirectory, name));
    rulesHash.update(bytes);
    return [name.replace(/\.json$/u, ""), JSON.parse(bytes.toString("utf8"))];
  }),
);
for (const name of ["words", "spacing", "search", "sort"]) {
  if (!rules[name])
    throw new Error(`Required block rule is unavailable: ${name}.json`);
}
const rulesOutput = join(
  root,
  "lib/generated/platform-contracts/block-rules.ts",
);
writeFileSync(
  rulesOutput,
  `// From snoopy-backend ${relative(backendRoot, rulesDirectory)}/*.json, sha256 ${rulesHash.digest("hex")}.\n` +
    "// Regenerate with `npm run generate:platform-contracts`; never edit by hand.\n" +
    "/** Search, sort and pages' words (owner-words rows 1–16). */\n" +
    `export const BLOCK_WORDS = ${JSON.stringify(rules.words.blockWords)} as const;\n\n` +
    "/** The spacing table's names and numbers: pixels on this site. */\n" +
    `export const BLOCK_SPACING = ${JSON.stringify(rules.spacing.blockSpacing)} as const;\n\n` +
    "/** The cases a search must pass: its page size, the longest query and each case. */\n" +
    `export const BLOCK_SEARCH = ${JSON.stringify(rules.search)} as const;\n\n` +
    "/** The cases a sort must pass: each list or table, its choices and the order one gives. */\n" +
    `export const BLOCK_SORT = ${JSON.stringify(rules.sort)} as const;\n`,
);
execFileSync(prettier, [rulesOutput, "--write"], {
  cwd: root,
  stdio: "inherit",
});
