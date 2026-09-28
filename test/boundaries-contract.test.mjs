import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

/**
 * `npm run audit:boundaries` run for real against a planted tree, so what it
 * refuses is observed rather than read from its source. Only the colour rule is
 * planted here (register F14); the tree carries the one file the audit always
 * reads.
 */

const script = resolve(import.meta.dirname, "../scripts/audit-boundaries.mjs");

function auditTree(files) {
  const root = mkdtempSync(join(tmpdir(), "boundaries-"));
  try {
    const tree = {
      "app/(auth)/login/page.tsx": "export default function Login() {}\n",
      ...files,
    };
    for (const [path, content] of Object.entries(tree)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    const run = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    return { status: run.status, output: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a raw hex colour outside the token file is refused (register F14)", () => {
  for (const [path, content] of [
    ["components/Card.tsx", 'export const edge = "#1a2b3c";\n'],
    ["app/page.tsx", 'const c = <div className="bg-[#fff]" />;\n'],
    ["components/extra.css", ".x { color: #12345678; }\n"],
  ]) {
    const { status, output } = auditTree({ [path]: content });
    assert.equal(status, 1, `${path} passed with a raw colour`);
    assert.match(
      output,
      new RegExp(`${path.replace(".", "\\.")}: raw hex colour`, "u"),
    );
  }
});

test("the token file, the OG image and comments may carry what looks like hex", () => {
  const { status, output } = auditTree({
    "app/globals.css": ":root { --accent: #7c5cff; }\n",
    "app/opengraph-image.tsx": 'const background = "#0b0b10";\n',
    "lib/notes.ts":
      '// backend §12.1 #160 names a register row\n/* and so does #175 */\nexport const url = "https://example.test/#top";\n',
  });
  assert.equal(status, 0, output);
});
