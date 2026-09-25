import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { writeRepoFacts } from "../scripts/repo-facts.mjs";

/**
 * The facts file `npm run verify` emits is what snoopy-backend commits and
 * asserts (docs/repo-facts/snoopy.json against docs/repo-facts.schema.json).
 * The shape is asserted here so a drift is caught by the repository that emits
 * it, not by the one that quotes it. The schema is read from the backend
 * checkout beside this one when present; when absent those tests skip, as the
 * other contract tests do.
 */

const BACKEND_ROOT = resolve(
  import.meta.dirname,
  "..",
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
);
const SCHEMA_PATH = resolve(BACKEND_ROOT, "docs/repo-facts.schema.json");
// Every count reads one tree: the working tree minus what .gitignore excludes.
const COUNT_BASIS = "git ls-files --cached --others --exclude-standard -- ";
const REQUIRED = ["schemaVersion", "repository", "head", "readAt", "counts"];
const ALLOWED = [...REQUIRED, "gate"];

let emitted;
function emit() {
  // One emission serves every test: the result is immutable and each call
  // spawns six shell processes.
  if (emitted) return emitted;
  const dir = mkdtempSync(join(tmpdir(), "repo-facts-"));
  try {
    const path = join(dir, "snoopy.json");
    const returned = writeRepoFacts(path, { gate: "verify" });
    const written = JSON.parse(readFileSync(path, "utf8"));
    emitted = { returned, written };
    return emitted;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the facts file carries the schema's required keys and nothing else", () => {
  const { returned, written } = emit();
  assert.deepEqual(
    written,
    returned,
    "the file must be what the function returns",
  );
  for (const key of REQUIRED) assert.ok(key in written, `missing ${key}`);
  for (const key of Object.keys(written)) {
    assert.ok(ALLOWED.includes(key), `unexpected top-level key ${key}`);
  }
  assert.equal(written.schemaVersion, 1);
  assert.equal(written.repository, "snoopy");
  assert.equal(written.gate, "verify");
  assert.match(written.head, /^[0-9a-f]{7,40}$/u);
  assert.match(written.readAt, /^\d{4}-\d{2}-\d{2}$/u);
});

test("every count is an integer that names the command that produced it", () => {
  const { written } = emit();
  const units = Object.keys(written.counts);
  assert.ok(units.length >= 1, "counts must not be empty");
  for (const unit of units) {
    const entry = written.counts[unit];
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["command", "value"],
      `${unit} must carry exactly value and command`,
    );
    assert.ok(
      Number.isInteger(entry.value) && entry.value >= 0,
      `${unit}.value`,
    );
    assert.ok(
      typeof entry.command === "string" && entry.command.length > 0,
      `${unit} states a number with no command`,
    );
    // One tree for every unit — `find` reads the raw tree and would count a
    // gitignored Finder copy that the git-aware form does not.
    assert.ok(
      entry.command.startsWith(COUNT_BASIS),
      `${unit} is counted on a different basis: ${entry.command}`,
    );
  }
});

test(
  "the facts file validates against the backend's schema",
  {
    skip: existsSync(SCHEMA_PATH)
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const { written } = emit();
    for (const key of schema.required)
      assert.ok(key in written, `missing ${key}`);
    for (const key of Object.keys(written)) {
      assert.ok(key in schema.properties, `${key} is not a schema property`);
    }
    assert.equal(written.schemaVersion, schema.properties.schemaVersion.const);
    assert.ok(schema.properties.repository.enum.includes(written.repository));
    assert.match(written.head, new RegExp(schema.properties.head.pattern, "u"));
    const entryKeys = Object.keys(
      schema.properties.counts.additionalProperties.properties,
    ).sort();
    for (const [unit, entry] of Object.entries(written.counts)) {
      assert.deepEqual(Object.keys(entry).sort(), entryKeys, unit);
    }
  },
);
