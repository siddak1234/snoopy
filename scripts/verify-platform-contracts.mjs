import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputs = [
  join(root, "lib/generated/platform-contracts/platform.d.ts"),
  join(root, "lib/generated/platform-contracts/automations.d.ts"),
  join(root, "lib/generated/platform-contracts/connections.d.ts"),
];

for (const output of outputs) {
  if (!existsSync(output)) {
    throw new Error(
      "Generated platform types are missing; run npm run generate:platform-contracts and commit the output",
    );
  }
}

// A check reports what it finds; it does not leave the tree it judged changed
// (register F6). The generator writes in place, so what it wrote is compared and
// then the committed bytes are put back — whether the files were stale or the
// generator failed part-way. Regenerating on purpose is
// `npm run generate:platform-contracts`.
const before = outputs.map((output) => readFileSync(output));
let after;
try {
  execFileSync(process.execPath, ["scripts/generate-platform-contracts.mjs"], {
    cwd: root,
    stdio: "inherit",
  });
  after = outputs.map((output) => readFileSync(output));
} finally {
  outputs.forEach((output, index) => {
    if (!readFileSync(output).equals(before[index])) {
      writeFileSync(output, before[index]);
    }
  });
}

const stale = outputs.filter((_, index) => !before[index].equals(after[index]));
if (stale.length > 0) {
  throw new Error(
    `Generated platform types are stale: ${stale
      .map((output) => relative(root, output))
      .join(
        ", ",
      )}. Run npm run generate:platform-contracts and commit the output; nothing was changed.`,
  );
}
