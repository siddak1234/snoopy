import assert from "node:assert/strict";
import { test } from "node:test";

import { toAppSession } from "../lib/session-contract.ts";

const userId = "8e126f3c-b18a-4b12-a581-4836757c1709";
const workspaceId = "1b338fcf-1d89-4b56-8bac-7e0983fddfd0";

test("session contract preserves explicit workspace projection", () => {
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
    },
  );
});

test("session contract rejects inferred, duplicate, and malformed workspace state", () => {
  const workspace = {
    id: workspaceId,
    name: "Fixture Workspace",
    type: "personal",
    role: "owner",
  };
  assert.equal(
    toAppSession({
      authenticated: true,
      user: {
        userId,
        email: "fixture@example.com",
        activeWorkspaceId: "305282fc-00e3-42fc-9647-b812cd615dc9",
      },
      workspaces: [workspace],
    }),
    null,
  );
  assert.equal(
    toAppSession({
      authenticated: true,
      user: { userId, email: "fixture@example.com" },
      workspaces: [workspace, workspace],
    }),
    null,
  );
  assert.equal(
    toAppSession({
      authenticated: true,
      user: { userId, email: "fixture@example.com" },
      workspaces: [{ ...workspace, role: "administrator" }],
    }),
    null,
  );
  assert.equal(
    toAppSession({
      authenticated: true,
      user: {
        userId,
        email: "fixture@example.com",
        displayName: { injected: true },
      },
      workspaces: [workspace],
    }),
    null,
  );
  assert.equal(
    toAppSession({
      authenticated: true,
      user: { userId, email: "fixture@example.com" },
      workspaces: [{ ...workspace, uncontracted: true }],
    }),
    null,
  );
});
