import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  execFileSync(prettier, [output, "--write"], {
    cwd: root,
    stdio: "inherit",
  });
}
