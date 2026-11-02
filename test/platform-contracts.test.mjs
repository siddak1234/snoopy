import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * The generated client and the scripts that keep it honest (register F6, F7;
 * Round 21 hardening, W1, W7, W12). Every test reads the committed copy of the
 * backend's contract files (lib/generated/snoopy-backend, its SHA256SUMS;
 * scripts/backend-contract.mjs), so each runs in CI and in any clone, never a
 * skip. The script tests run the real check in a copy of the files it touches,
 * with no sibling checkout, so they never rewrite this tree while the other
 * contract tests read it.
 */

const root = resolve(import.meta.dirname, "..");
const backendRoot = resolve(root, "lib/generated/snoopy-backend");
const generated = [
  ["platform.d.ts", "docs/openapi.yaml"],
  ["automations.d.ts", "docs/openapi/automations.yaml"],
  ["connections.d.ts", "docs/openapi/connections.yaml"],
  ["block-required.ts", "docs/openapi/automations.yaml"],
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("each generated file names the sha256 of the contract it came from (register F7)", () => {
  for (const [file, input] of generated) {
    const first = readFileSync(
      join(root, "lib/generated/platform-contracts", file),
      "utf8",
    ).split("\n")[0];
    assert.equal(
      first,
      `// From snoopy-backend ${input}, sha256 ${sha256(readFileSync(join(backendRoot, input)))}.`,
      `${file} does not name the contract it was generated from`,
    );
  }
});

test("the block fixtures name one sha256 over the fixtures' bytes, each file in name order — the app's rule, so the two headers agree (backend ADR-0048 decision 9)", () => {
  const directory = join(backendRoot, "packages/contracts/fixtures/blocks");
  const hash = createHash("sha256");
  for (const name of readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort())
    hash.update(readFileSync(join(directory, name)));
  const first = readFileSync(
    join(root, "lib/generated/platform-contracts/block-fixtures.ts"),
    "utf8",
  ).split("\n")[0];
  assert.equal(
    first,
    `// From snoopy-backend packages/contracts/fixtures/blocks/*.json, sha256 ${hash.digest("hex")}.`,
  );
});

test("the copy is byte for byte what its SHA256SUMS lists: the six backend inputs, nothing else", () => {
  const sums = readFileSync(join(backendRoot, "SHA256SUMS"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("  "));
  const paths = sums.map(([, path]) => path);
  for (const input of [
    "docs/openapi.yaml",
    "docs/openapi/automations.yaml",
    "docs/openapi/connections.yaml",
    "docs/repo-facts.schema.json",
  ])
    assert.ok(paths.includes(input), input);
  for (const folder of [
    "packages/contracts/fixtures/blocks/",
    "packages/contracts/fixtures/block-rules/",
  ])
    assert.ok(
      paths.some((path) => path.startsWith(folder)),
      folder,
    );
  for (const [hash, path] of sums)
    assert.equal(sha256(readFileSync(join(backendRoot, path))), hash, path);
});

/** The check's own files in a fresh folder with no sibling checkout beside it. */
function checkCopy() {
  const copy = mkdtempSync(join(tmpdir(), "platform-contracts-"));
  for (const path of [
    "scripts/backend-contract.mjs",
    "scripts/generate-platform-contracts.mjs",
    "scripts/verify-platform-contracts.mjs",
    "lib/generated/platform-contracts",
    "lib/generated/snoopy-backend",
    "app/globals.css",
    ".prettierrc.json",
    ".prettierignore",
  ]) {
    cpSync(join(root, path), join(copy, path), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(copy, "node_modules"));
  return copy;
}

/** The check, run in `copy`, with no SNOOPY_BACKEND_ROOT unless one is given. */
function runCheck(copy, backend) {
  const env = { ...process.env };
  delete env.SNOOPY_BACKEND_ROOT;
  if (backend) env.SNOOPY_BACKEND_ROOT = backend;
  return spawnSync(
    process.execPath,
    [join(copy, "scripts/verify-platform-contracts.mjs")],
    { cwd: copy, encoding: "utf8", env },
  );
}

test("with no sibling checkout and no SNOOPY_BACKEND_ROOT the check reads the copy and passes — never a skip (W1, W12)", () => {
  const copy = checkCopy();
  try {
    const run = runCheck(copy);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /root lib\/generated\/snoopy-backend/u);
    assert.match(run.stdout, /the copy, the headers and a regeneration agree/u);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test("an edited byte in the copy fails the check against SHA256SUMS, and the copy is left as found (W1)", () => {
  const copy = checkCopy();
  try {
    const path = join(
      copy,
      "lib/generated/snoopy-backend/docs/openapi/automations.yaml",
    );
    const edited = readFileSync(path, "utf8").replace("openapi:", "openapi: ");
    writeFileSync(path, edited);
    const run = runCheck(copy);
    assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
    assert.match(
      run.stderr,
      /docs\/openapi\/automations\.yaml does not match its SHA256SUMS line/u,
    );
    assert.equal(readFileSync(path, "utf8"), edited);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test("a stale generated file is reported and left as found, not rewritten (register F6)", () => {
  const copy = checkCopy();
  try {
    const stalePath = join(
      copy,
      "lib/generated/platform-contracts/automations.d.ts",
    );
    const stale = `${readFileSync(stalePath, "utf8")}\n// edited by hand\n`;
    writeFileSync(stalePath, stale);
    // The blocks' required fields (Round 21, D2.6) are checked the same way.
    const requiredPath = join(
      copy,
      "lib/generated/platform-contracts/block-required.ts",
    );
    const requiredStale = `${readFileSync(requiredPath, "utf8")}\n// edited by hand\n`;
    writeFileSync(requiredPath, requiredStale);

    const run = runCheck(copy);
    assert.equal(run.status, 1, "a stale file must fail the check");
    assert.match(
      run.stderr,
      /Generated platform types are stale: lib\/generated\/platform-contracts\/automations\.d\.ts, lib\/generated\/platform-contracts\/block-required\.ts\./u,
    );
    assert.equal(readFileSync(requiredPath, "utf8"), requiredStale);
    assert.equal(
      readFileSync(stalePath, "utf8"),
      stale,
      "the check rewrote the file it judged",
    );
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test("a copy older than the backend it is checked against is reported as stale and left as found (W1)", () => {
  const copy = checkCopy();
  const backend = mkdtempSync(join(tmpdir(), "platform-contracts-backend-"));
  try {
    cpSync(join(copy, "lib/generated/snoopy-backend"), backend, {
      recursive: true,
    });
    rmSync(join(backend, "SHA256SUMS"));
    // The platform moved one rule on: the copy still holds the old bytes.
    const rule = join(
      backend,
      "packages/contracts/fixtures/block-rules/words.json",
    );
    writeFileSync(rule, `${readFileSync(rule, "utf8").trimEnd()}\n\n`);
    const sums = join(copy, "lib/generated/snoopy-backend/SHA256SUMS");
    const before = readFileSync(sums);
    const run = runCheck(copy, backend);
    assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
    assert.match(
      run.stderr,
      /Generated platform types are stale: lib\/generated\/platform-contracts\/block-rules\.ts, lib\/generated\/snoopy-backend\./u,
    );
    assert.ok(readFileSync(sums).equals(before), "the copy was rewritten");
  } finally {
    rmSync(copy, { recursive: true, force: true });
    rmSync(backend, { recursive: true, force: true });
  }
});
