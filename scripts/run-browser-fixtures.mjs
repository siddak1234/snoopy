import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const playwrightSelectors = process.argv.slice(2);
// Twelve of e2e/accessibility.spec.ts's tests read the same page here as in
// CI's browser job (ci.yml `browser`, `npm run test:browser`, no backend): the
// axe baselines of the six prerendered public routes and the six ghost-button
// contrast tests. Those pages make one platform read, the nav's session, which
// ends "signed out" on the fixture's 401 exactly as on no backend's failed
// proxy — in three engines the settled ARIA tree, axe's whole result and the
// buttons' pixel contrast were identical (register F91) — so they run once,
// there, not again in each of the three legs. /login stays: its provider list
// is the platform's, and only the fixture can show the page with one. The
// fourteen authenticated baselines run only here. Matched on Playwright's grep
// title — "<project> <file, relative to testDir> <describe…> <title>", e.g.
// "chromium accessibility.spec.ts public accessibility baseline: /" — anchored
// to the project, this spec's file and the title's end, so /login, the
// authenticated baselines and the other specs' own button tests are untouched;
// Playwright reads a plain --grep-invert string with the flags gi.
const browserJobOnly = String.raw`^[a-z]+ accessibility\.spec\.ts (public accessibility baseline: /(solutions|contact|automation-builder|privacy|terms)?|a ghost button keeps AA contrast at rest, hovered and pressed: .*)$`;
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
      "e2e/account-surfaces.spec.ts",
      // One worker: every test here talks to ONE fixture process whose state is
      // global (the active workspace, billing, exports), and some tests move it
      // and put it back. With two workers the other file's scans could land
      // inside that window — the billing axe scan did, on the personal
      // workspace, and read Next's error page.
      "--workers=1",
      "--grep-invert",
      browserJobOnly,
      ...playwrightSelectors,
    ],
    { cwd: root, env: environment, stdio: "inherit" },
  );
} finally {
  await stopFixture();
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
