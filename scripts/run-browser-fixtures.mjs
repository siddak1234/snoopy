import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const playwrightSelectors = process.argv.slice(2);
const fixtureDirectory = mkdtempSync(join(tmpdir(), "autom8x-public-edge-"));
const certificate = join(fixtureDirectory, "cert.pem");
const privateKey = join(fixtureDirectory, "key.pem");
const storageState = join(fixtureDirectory, "owner.json");
let fixture;
const environment = {
  ...process.env,
  BACKEND_API_ORIGIN: "https://127.0.0.1:3443",
  NODE_EXTRA_CA_CERTS: certificate,
  FIXTURE_EDGE_PORT: "3443",
  FIXTURE_EDGE_CERT: certificate,
  FIXTURE_EDGE_KEY: privateKey,
  E2E_AUTHENTICATED_AUDIT: "1",
  PLAYWRIGHT_AUTH_STORAGE_STATE: storageState,
  E2E_PUBLIC_EDGE_FIXTURE: "1",
  CI: "1",
};

async function stopFixture() {
  if (!fixture || fixture.exitCode !== null) return;
  fixture.kill("SIGTERM");
  await Promise.race([
    once(fixture, "exit"),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000)),
  ]);
  if (fixture.exitCode === null) fixture.kill("SIGKILL");
}

async function waitForFixture(child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Public Edge fixture exited before becoming ready");
    }
    const listening = await new Promise((resolvePromise) => {
      const socket = connect({ host: "127.0.0.1", port: 3443 });
      socket.once("connect", () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.once("error", () => resolvePromise(false));
    });
    if (listening) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("Public Edge fixture did not become ready");
}

try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
      "-keyout",
      privateKey,
      "-out",
      certificate,
    ],
    { stdio: "ignore" },
  );
  writeFileSync(
    storageState,
    JSON.stringify({
      cookies: [
        {
          name: "e2e-public-edge-session",
          value: "owner",
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
  // Next serializes rewrites into the build output. Rebuild with this test-only
  // origin so the browser exercises the same compiled proxy path as production.
  execFileSync("npm", ["run", "build", "--", "--webpack"], {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  // `output: standalone` deliberately leaves static/public copying to the
  // deployment layer. Mirror the web image here so the browser exercises the
  // complete standalone layout instead of an unstyled partial server.
  cpSync(
    join(root, ".next", "static"),
    join(root, ".next", "standalone", ".next", "static"),
    {
      recursive: true,
    },
  );
  cpSync(join(root, "public"), join(root, ".next", "standalone", "public"), {
    recursive: true,
  });
  fixture = spawn(
    process.execPath,
    ["--experimental-strip-types", "e2e/fixtures/public-edge.ts"],
    { cwd: root, env: environment, stdio: "inherit" },
  );
  const terminate = () => fixture?.kill("SIGTERM");
  process.on("exit", terminate);
  await waitForFixture(fixture);
  execFileSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "e2e/accessibility.spec.ts",
      "e2e/public-edge-fixture.spec.ts",
      ...playwrightSelectors,
    ],
    { cwd: root, env: environment, stdio: "inherit" },
  );
} finally {
  await stopFixture();
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
