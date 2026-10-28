import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "@redocly/openapi-core";

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

// The blocks' required fields (Round 21, design D2.6): for each block type,
// each field its schema requires and that field's basic JSON type, and the
// same for each array's items and each object's own required fields, read
// from `automations.yaml`'s `Block` union — never typed here. A block held in
// a block (a section's `blocks`) is checked when it is drawn, so it is only an
// object here. `components/blocks/drawable.ts` reads it to draw `Fallback` in
// place of a block the platform sent without a required field, on a server
// render as in a browser. Headed by the contract's sha256, as the types are.
const automationsInput = join(backendRoot, "docs/openapi/automations.yaml");
const automationsBytes = readFileSync(automationsInput);
// `parseYaml` is openapi-typescript's own reader: its dependency, installed with it.
const schemas = parseYaml(automationsBytes.toString("utf8")).components.schemas;
const BASIC = new Map([
  ["string", "string"],
  ["integer", "number"],
  ["number", "number"],
  ["boolean", "boolean"],
  ["object", "object"],
  ["array", "array"],
  ["null", "null"],
]);
function basic(name, where) {
  const kind = BASIC.get(name);
  if (!kind) throw new Error(`Unsupported type ${name} at ${where}`);
  return kind;
}
function shapeOf(node, where) {
  if (node.$ref) {
    const name = node.$ref.replace("#/components/schemas/", "");
    if (name === "Block") return { kinds: ["object"] };
    if (!schemas[name]) throw new Error(`Unknown schema ${name} at ${where}`);
    return shapeOf(schemas[name], `${where} (${name})`);
  }
  const kinds =
    node.const !== undefined
      ? [basic(typeof node.const, where)]
      : Array.isArray(node.type)
        ? node.type.map((name) => basic(name, where))
        : node.type
          ? [basic(node.type, where)]
          : null;
  if (!kinds) throw new Error(`No type at ${where}`);
  const shape = { kinds };
  if (kinds.includes("object") && node.required?.length) {
    shape.fields = Object.fromEntries(
      node.required.map((field) => [
        field,
        shapeOf(node.properties[field], `${where}.${field}`),
      ]),
    );
  }
  if (kinds.includes("array") && node.items)
    shape.items = shapeOf(node.items, `${where}[]`);
  return shape;
}
const blockRequired = Object.fromEntries(
  schemas.Block.oneOf.map((variant) => {
    const type = variant.properties.type.const;
    const { fields } = shapeOf(variant, `Block ${type}`);
    return [type, fields];
  }),
);
const requiredOutput = join(
  root,
  "lib/generated/platform-contracts/block-required.ts",
);
writeFileSync(
  requiredOutput,
  `// From snoopy-backend ${relative(backendRoot, automationsInput)}, sha256 ${createHash("sha256").update(automationsBytes).digest("hex")}.\n` +
    "// Regenerate with `npm run generate:platform-contracts`; never edit by hand.\n" +
    '/** A JSON value\'s basic type, as `typeof` names it, with "array" and "null" told apart. */\n' +
    'export type BlockKind = "string" | "number" | "boolean" | "object" | "array" | "null";\n\n' +
    "/** A required field: the basic types it may have; an object's own required fields; an array's items. */\n" +
    "export type BlockField = {\n  kinds: readonly BlockKind[];\n  fields?: { readonly [name: string]: BlockField };\n  items?: BlockField;\n};\n\n" +
    "/** Each block type's required fields, `type` among them (the `Block` union's `required`). */\n" +
    `export const BLOCK_REQUIRED: { readonly [type: string]: { readonly [name: string]: BlockField } } = ${JSON.stringify(blockRequired)};\n`,
);
execFileSync(prettier, [requiredOutput, "--write"], {
  cwd: root,
  stdio: "inherit",
});
