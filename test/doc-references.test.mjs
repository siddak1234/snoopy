import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

/**
 * No document names a file that does not exist (backend Gate 22). The audit is
 * run for real, on this repository and on a planted one, so what it finds is
 * observed rather than read from its source.
 */

const root = resolve(import.meta.dirname, "..");
const script = join(root, "scripts/audit-doc-references.mjs");

function audit(repository, backend) {
  const run = spawnSync(process.execPath, [script, repository], {
    encoding: "utf8",
    env: { ...process.env, SNOOPY_BACKEND_ROOT: backend },
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

test("no document in this repository names a file that does not exist", () => {
  const { status, output } = audit(
    root,
    process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
  );
  assert.equal(status, 0, output);
  assert.match(output, /missing 0$/mu);
});

test("a missing file is listed with its document and line; a struck one is a record of its removal", () => {
  const planted = mkdtempSync(join(tmpdir(), "doc-references-"));
  try {
    const repository = join(planted, "web");
    const backend = join(planted, "platform");
    const files = {
      [join(repository, "lib/present.ts")]: "export {};\n",
      [join(repository, "docs/guide.md")]: [
        "Reads `lib/present.ts:12` and links [it](../lib/present.ts).",
        "Names `lib/gone.ts`, which is not there.",
        "Removed: ~~`lib/removed.ts`~~.",
        "The phone app's `snoopy-mobile/app/index.tsx` is not checked here.",
        "The platform's `snoopy-backend/docs/openapi.yaml` and `../snoopy-backend/docs/absent.yaml`.",
        "",
      ].join("\n"),
      [join(backend, "docs/openapi.yaml")]: "openapi: 3.1.0\n",
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    execFileSync("git", ["init", "-q"], { cwd: repository });
    execFileSync("git", ["add", "."], { cwd: repository });

    const { status, output } = audit(repository, backend);
    assert.equal(status, 1, output);
    const missing = output
      .split("\n")
      .filter((line) => line.startsWith("missing\t"));
    assert.deepEqual(missing, [
      "missing\tdocs/guide.md:2\tlib/gone.ts",
      "missing\tdocs/guide.md:5\t../snoopy-backend/docs/absent.yaml",
    ]);
    assert.match(
      output,
      /found 3, struck 1, not checked 1, missing 2$/mu,
      "the present file (twice), the platform's contract, the struck file and the phone app's",
    );
  } finally {
    rmSync(planted, { recursive: true, force: true });
  }
});
