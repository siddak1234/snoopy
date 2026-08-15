import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const before = outputs.map((output) => readFileSync(output));
execFileSync(process.execPath, ["scripts/generate-platform-contracts.mjs"], {
  cwd: root,
  stdio: "inherit",
});
const after = outputs.map((output) => readFileSync(output));

if (before.some((content, index) => !content.equals(after[index]))) {
  throw new Error(
    "Generated platform types were stale; commit the output from npm run generate:platform-contracts",
  );
}
