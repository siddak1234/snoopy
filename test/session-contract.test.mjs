import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { toAppSession } from "../lib/session-contract.ts";

const userId = "8e126f3c-b18a-4b12-a581-4836757c1709";
const workspaceId = "1b338fcf-1d89-4b56-8bac-7e0983fddfd0";

test("session projection uses the generated public contract", () => {
  const source = readFileSync("lib/session-contract.ts", "utf8");
  assert.match(source, /components\["schemas"\]\["SessionResponse"\]/);
  assert.deepEqual(
    toAppSession({
      authenticated: true,
      user: {
        userId,
        email: "fixture@example.com",
        displayName: "Fixture User",
        activeWorkspaceId: workspaceId,
      },
      workspaces: [
        {
          id: workspaceId,
          name: "Fixture Workspace",
          type: "personal",
          role: "owner",
        },
      ],
    }),
    {
      user: {
        id: userId,
        email: "fixture@example.com",
        name: "Fixture User",
        workspaceId,
      },
      workspaces: [
        {
          id: workspaceId,
          name: "Fixture Workspace",
          type: "personal",
          role: "owner",
        },
      ],
      workspacesTruncated: false,
    },
  );
});

test("a bounded session list does not infer workspace non-membership", () => {
  const projected = toAppSession({
    authenticated: true,
    user: {
      userId,
      email: "fixture@example.com",
      activeWorkspaceId: "305282fc-00e3-42fc-9647-b812cd615dc9",
    },
    workspaces: [
      {
        id: workspaceId,
        name: "Fixture Workspace",
        type: "personal",
        role: "owner",
      },
    ],
    workspacesTruncated: true,
  });
  assert.equal(projected.workspacesTruncated, true);
  assert.equal(
    projected.user.workspaceId,
    "305282fc-00e3-42fc-9647-b812cd615dc9",
  );
});

test("no session means 401 — a refused or failed read is not a sign-out", () => {
  // Backend §12.1 #160: every failure used to read as "no session", so a 429
  // sent a signed-in person to /login. Only a 401 and an unconfigured site are
  // null now; anything else is thrown for the account area to render.
  const source = readFileSync("lib/app-session.ts", "utf8");
  assert.match(source, /export const getAppSession = cache\(/);
  assert.match(
    source,
    /error instanceof PlatformNotConfiguredError\) return null/,
  );
  assert.match(source, /error\.status === 401\)\s*\{\s*return null;/u);
  assert.match(source, /throw error;/);
  const layout = readFileSync("app/account/layout.tsx", "utf8");
  assert.match(layout, /<PlatformUnavailable/);
  assert.match(layout, /error\.status === 429/);
  const boundary = readFileSync("app/account/error.tsx", "utf8");
  assert.match(boundary, /<PlatformUnavailable retry=\{retry\} \/>/);
  // The proxy reads the session too, before any page: it may send a person to
  // sign in on a 401 (or a site with no platform), and on nothing else.
  const proxy = readFileSync("proxy.ts", "utf8");
  assert.match(
    proxy,
    /sessionResponse === "not-configured" \|\| sessionResponse\?\.status === 401/u,
  );
  // No cookie at all is no session, answered without spending the website's
  // shared address bucket at the Edge.
  assert.match(
    proxy,
    /if \(!request\.headers\.get\("cookie"\)\) return loginRedirect\(request\);\s*\n\s*const sessionResponse/u,
  );
  assert.doesNotMatch(
    proxy,
    /if \(!sessionResponse\?\.ok\) return loginRedirect/u,
    "a refused or failed session read must not redirect to sign-in",
  );
});

test("no link in the account area prefetches", () => {
  // Backend §12.1 #160: each visible <Link> prefetched, and one page view cost
  // 23 Edge requests against a 120-a-minute bucket.
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx")) files.push(path);
    }
  };
  walk("app/account");
  walk("components/dashboard");
  let links = 0;
  for (const path of files) {
    for (const match of readFileSync(path, "utf8").matchAll(
      /<Link\b[^>]*>/gu,
    )) {
      links += 1;
      assert.match(
        match[0],
        /prefetch=\{false\}/u,
        `${path}: ${match[0].slice(0, 60)} must not prefetch`,
      );
    }
  }
  assert.ok(links > 0, "no account-area links were found to check");
});

test("the login page reads the provider list on the server, cached and cookieless", () => {
  // The one read every signed-out visitor makes, identical for all of them.
  const loginPage = readFileSync("app/(auth)/login/page.tsx", "utf8");
  assert.match(
    loginPage,
    /platformPublicJson<LoginProvidersResponse>\(\s*"\/v1\/auth\/providers",\s*60,?\s*\)/u,
  );
  const server = readFileSync("lib/platform-server.ts", "utf8");
  const publicRead =
    /export async function platformPublicJson[\s\S]*?\n\}/u.exec(server);
  assert.ok(publicRead, "platformPublicJson not found");
  assert.match(publicRead[0], /next: \{ revalidate: revalidateSeconds \}/);
  assert.doesNotMatch(
    publicRead[0],
    /cookie|forwardedHeaders|headers\(/iu,
    "a cached public read must carry nothing session-scoped",
  );
});

test("OAuth provider UI consumes the generated public provider policy", () => {
  const oauthButtons = readFileSync("components/auth/OAuthButtons.tsx", "utf8");
  const linkedAccounts = readFileSync(
    "components/account/LinkedAccountsSection.tsx",
    "utf8",
  );

  for (const source of [oauthButtons, linkedAccounts]) {
    assert.match(source, /operations\["listLoginProviders"\]/);
    assert.match(
      source,
      /platformApiJson<LoginProvidersResponse>\("\/v1\/auth\/providers"\)/,
    );
  }
  assert.match(oauthButtons, /providers\.map\(\(provider\) =>/);
  assert.doesNotMatch(oauthButtons, /oauthHref\("(?:google|microsoft|apple)"/);
  assert.match(linkedAccounts, /state\.providers\.map/);
});

test("a server-side call sends the Edge cookies, never cookie attributes (register F51)", async () => {
  const { requestCookieHeader } = await import("../lib/cookie-header.ts");
  const { ResponseCookies, RequestCookies } =
    await import("next/dist/compiled/@edge-runtime/cookies/index.js");
  // The store a server action or a route handler gets is a RESPONSE store, and
  // its own serialisation carries `Set-Cookie` attributes — the defect.
  const actionStore = new ResponseCookies(new Headers());
  actionStore.set("e2e-public-edge-session", "owner a;b");
  actionStore.set("theme", "dark");
  assert.match(
    actionStore.toString(),
    /; Path=\//u,
    "Next's response store no longer adds Path= — re-read what F51 guards",
  );
  const header = requestCookieHeader(actionStore);
  assert.equal(header, "e2e-public-edge-session=owner%20a%3Bb; theme=dark");
  assert.doesNotMatch(header, /Path=|Expires=|Max-Age=|HttpOnly|SameSite/iu);
  // Encoded as the request store encodes, so the Edge reads the same values
  // the browser sent.
  const parsed = new RequestCookies(new Headers({ cookie: header }));
  assert.equal(parsed.get("e2e-public-edge-session")?.value, "owner a;b");
  assert.equal(parsed.toString(), header);

  const server = readFileSync("lib/platform-server.ts", "utf8");
  assert.match(server, /cookie: cookieHeader,/u);
  assert.match(server, /requestCookieHeader\(await cookies\(\)\)/u);
  assert.doesNotMatch(
    server,
    /cookieStore\.toString\(\)|cookies\(\)\)\.toString\(\)/u,
  );
});

test("a refused request says when to try again, from retry-after (backend §12.1 #114)", async () => {
  const { busyMessage, retryAfterSeconds, tryAgainIn } =
    await import("../lib/retry-after.ts");
  // Whole seconds, as the Edge sends them; anything else is not interpreted.
  assert.equal(retryAfterSeconds("30"), 30);
  assert.equal(retryAfterSeconds(" 60 "), 60);
  for (const value of [null, undefined, "", "-1", "1.5", "Wed, 21 Oct 2026"]) {
    assert.equal(retryAfterSeconds(value), undefined, String(value));
  }
  assert.equal(tryAgainIn(undefined), "Try again in a moment.");
  assert.equal(tryAgainIn(1), "Try again in a second.");
  assert.equal(tryAgainIn(30), "Try again in 30 seconds.");
  assert.equal(tryAgainIn(120), "Try again in 2 minutes.");
  assert.equal(
    busyMessage(30),
    "The platform is busy right now. Try again in 30 seconds.",
  );
  // Both clients word a 429 this way, never with the Edge's "Too Many Requests".
  const server = readFileSync("lib/platform-server.ts", "utf8");
  const browser = readFileSync("lib/platform-api.ts", "utf8");
  for (const [name, source] of [
    ["lib/platform-server.ts", server],
    ["lib/platform-api.ts", browser],
  ]) {
    assert.match(
      source,
      /response\.status === 429\)\s*\{\s*const wait = retryAfterSeconds\(response\.headers\.get\("retry-after"\)\);/u,
      name,
    );
  }
  const panel = readFileSync(
    "components/dashboard/PlatformUnavailable.tsx",
    "utf8",
  );
  assert.match(panel, /tryAgainIn\(busy \? retryAfterSeconds : undefined\)/u);
});

test("a server read takes the request's cookies before the origin, so no page is prerendered around it (register F62)", () => {
  const server = readFileSync("lib/platform-server.ts", "utf8");
  // Comments stripped, so a comment naming the call cannot stand in for it.
  const read = server
    .slice(server.indexOf("export async function platformServerJson"))
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "");
  const cookiesAt = read.indexOf("await cookies()");
  const originAt = read.indexOf("backendApiOrigin()");
  assert.ok(cookiesAt > 0 && originAt > 0, "platformServerJson changed shape");
  assert.ok(
    cookiesAt < originAt,
    "with no backend, a platform read before the cookies fails the build",
  );
});
