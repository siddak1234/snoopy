import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";

// Serves the build `npm run build:no-backend` left in `.next`, with no
// BACKEND_API_ORIGIN, as a Vercel preview serves it — the run-time half of
// register F62, whose build-time half is that gate itself. A preview visitor
// must get the public pages, be sent to sign in by the account area, and read
// "not configured" from readiness; nothing may throw. Run straight after
// `build:no-backend`, before `build` replaces its output.

const root = resolve(import.meta.dirname, "..");

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
// A preview is `VERCEL_ENV=preview`, which `lib/env.ts` lets serve with no
// origin; a production runtime with none fails closed at startup instead.
const environment = {
  ...process.env,
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
};
delete environment.BACKEND_API_ORIGIN;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: root, env: environment, stdio: ["ignore", "inherit", "inherit"] },
);

const failures = [];
function expectThat(condition, message) {
  if (!condition) failures.push(message);
}

try {
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (server.exitCode !== null) throw new Error("next start exited early");
    const answer = await fetch(`${origin}/`).catch(() => null);
    if (answer?.status === 200) break;
    if (Date.now() > deadline) throw new Error("next start did not answer");
    await new Promise((done) => setTimeout(done, 250));
  }

  for (const path of ["/", "/login", "/contact"]) {
    const answer = await fetch(`${origin}${path}`);
    const text = await answer.text();
    expectThat(answer.status === 200, `${path} answered ${answer.status}`);
    expectThat(
      !text.includes("This page could not load"),
      `${path} rendered the error boundary`,
    );
  }

  // The account area, with a cookie and without: the proxy finds no platform
  // and sends the person to sign in, back to where they were.
  for (const cookie of [undefined, "autom8x_session=anything"]) {
    const answer = await fetch(`${origin}/account/settings`, {
      redirect: "manual",
      headers: cookie ? { cookie } : {},
    });
    expectThat(
      answer.status === 307,
      `/account/settings (${cookie ? "cookie" : "no cookie"}) answered ${answer.status}`,
    );
    expectThat(
      new URL(answer.headers.get("location") ?? "", origin).pathname +
        new URL(answer.headers.get("location") ?? "", origin).search ===
        "/login?callbackUrl=%2Faccount%2Fsettings",
      `/account/settings went to ${answer.headers.get("location")}`,
    );
  }

  const ready = await fetch(`${origin}/api/ready`);
  const body = await ready.json().catch(() => null);
  expectThat(ready.status === 503, `/api/ready answered ${ready.status}`);
  expectThat(
    body?.status === "not-ready" && body?.backend === "not-configured",
    `/api/ready said ${JSON.stringify(body)}`,
  );
} catch (error) {
  failures.push(error.message);
} finally {
  server.kill("SIGTERM");
  if (server.exitCode === null) await once(server, "exit");
}

if (failures.length > 0) {
  console.error("probe:no-backend: FAILED");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  "probe:no-backend: the site with no backend serves as a preview must",
);
