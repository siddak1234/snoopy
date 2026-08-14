import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
