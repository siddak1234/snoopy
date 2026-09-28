import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * The generated client and the scripts that keep it honest (register F6, F7).
 * Both tests read the backend checkout beside this one and skip, as the other
 * contract tests do, when it is absent. The stale-file test runs the real
 * script in a copy of the files it touches, so it never rewrites this tree
 * while the other contract tests read it.
 */

const root = resolve(import.meta.dirname, "..");
const backendRoot = resolve(
  root,
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
);
const generated = [
  ["platform.d.ts", "docs/openapi.yaml"],
  ["automations.d.ts", "docs/openapi/automations.yaml"],
  ["connections.d.ts", "docs/openapi/connections.yaml"],
];
const sibling = generated.every(([, input]) =>
  existsSync(join(backendRoot, input)),
)
  ? false
  : "snoopy-backend is not checked out beside this repository";

test(
  "each generated file names the sha256 of the contract it came from (register F7)",
  { skip: sibling },
  () => {
    for (const [file, input] of generated) {
      const first = readFileSync(
        join(root, "lib/generated/platform-contracts", file),
        "utf8",
      ).split("\n")[0];
      const sha256 = createHash("sha256")
        .update(readFileSync(join(backendRoot, input)))
        .digest("hex");
      assert.equal(
        first,
        `// From snoopy-backend ${input}, sha256 ${sha256}.`,
        `${file} does not name the contract it was generated from`,
      );
    }
  },
);

test(
  "a stale generated file is reported and left as found, not rewritten (register F6)",
  { skip: sibling },
  () => {
    const copy = mkdtempSync(join(tmpdir(), "platform-contracts-"));
    try {
      for (const path of [
        "scripts/generate-platform-contracts.mjs",
        "scripts/verify-platform-contracts.mjs",
        "lib/generated/platform-contracts",
        "app/globals.css",
        ".prettierrc.json",
      ]) {
        cpSync(join(root, path), join(copy, path), { recursive: true });
      }
      symlinkSync(join(root, "node_modules"), join(copy, "node_modules"));
      const stalePath = join(
        copy,
        "lib/generated/platform-contracts/automations.d.ts",
      );
      const stale = `${readFileSync(stalePath, "utf8")}\n// edited by hand\n`;
      writeFileSync(stalePath, stale);

      const run = spawnSync(
        process.execPath,
        [join(copy, "scripts/verify-platform-contracts.mjs")],
        {
          cwd: copy,
          encoding: "utf8",
          env: { ...process.env, SNOOPY_BACKEND_ROOT: backendRoot },
        },
      );
      assert.equal(run.status, 1, "a stale file must fail the check");
      assert.match(
        run.stderr,
        /Generated platform types are stale: lib\/generated\/platform-contracts\/automations\.d\.ts\./u,
      );
      assert.equal(
        readFileSync(stalePath, "utf8"),
        stale,
        "the check rewrote the file it judged",
      );
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  },
);
