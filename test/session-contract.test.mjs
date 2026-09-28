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
