import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The config's security-header rule (the owner's security plan, item 7): what
 * `next.config.ts`'s `headers()` returns, read from the config itself as Next
 * reads it. The config imports its modules without an extension, as Next
 * resolves them; here a relative import with none is the `.ts` file beside
 * it. `turbopack.root` reads `__dirname`, which an ES module has not.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\/[^.]*$/u.test(specifier))
      return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
globalThis.__dirname = root;
const { default: config } = await import("../next.config.ts");

const POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "frame-src 'self' blob:",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

async function sent(nodeEnv) {
  const before = process.env.NODE_ENV;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  try {
    return await config.headers();
  } finally {
    if (before === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = before;
  }
}

test("the config's rule covers every path with the five security headers, the policy report-only, and frames from this site alone (security plan item 7)", async () => {
  for (const nodeEnv of [undefined, "production", "test"]) {
    assert.deepEqual(
      await sent(nodeEnv),
      [
        {
          source: "/:path*",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value:
                "camera=(), microphone=(), geolocation=(), browsing-topics=()",
            },
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "Content-Security-Policy-Report-Only", value: POLICY },
          ],
        },
      ],
      `NODE_ENV=${nodeEnv}`,
    );
  }
});

test("the policy blocks nothing yet, sends no HSTS of its own, and never refuses this site's own frames (security plan item 7)", async () => {
  const [{ headers }] = await sent("production");
  const keys = headers.map(({ key }) => key.toLowerCase());
  // Report-only until the browser suite's evidence lets a later round enforce it.
  assert.ok(!keys.includes("content-security-policy"));
  // Vercel sends Strict-Transport-Security; a second one here could disagree.
  assert.ok(!keys.includes("strict-transport-security"));
  // The site frames its own files and run packages (RunLive, Picture, FileView).
  assert.equal(
    headers.find(({ key }) => key === "X-Frame-Options").value,
    "SAMEORIGIN",
  );
  const policy = headers.find(
    ({ key }) => key === "Content-Security-Policy-Report-Only",
  ).value;
  for (const directive of policy.split("; ")) {
    if (directive.startsWith("frame"))
      assert.match(directive, /^frame-\w+ 'self'/u, directive);
  }
});

test("next dev alone adds 'unsafe-eval' to the scripts, which its refresh needs (security plan item 7)", async () => {
  const [{ headers }] = await sent("development");
  const policy = headers.find(
    ({ key }) => key === "Content-Security-Policy-Report-Only",
  ).value;
  assert.equal(
    policy,
    POLICY.replace(
      "script-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    ),
  );
  for (const nodeEnv of [undefined, "production", "test"]) {
    const [{ headers: built }] = await sent(nodeEnv);
    assert.doesNotMatch(JSON.stringify(built), /unsafe-eval/u, `${nodeEnv}`);
  }
});
