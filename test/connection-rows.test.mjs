import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  CONNECTIONS_MANAGED_BY,
  connectionAction,
  connectionFor,
  connectionLine,
  connectionState,
  disconnectBody,
  disconnectTitle,
} from "../lib/connection-rows.ts";

/**
 * The one connection row (Build 21, spec A4; the owner's build 20 items 6 and
 * 7: "Logo then to the right name then below the account email", "Standard
 * format and size for each connection component on the list not random
 * buttons"): line 2 says the account's email, else its state; one button of
 * ours — Connect, Reconnect, Disconnect — and Disconnect asks first, saying
 * what it stops. The app's words (`snoopy-mobile/lib/content/screen-states.ts`).
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
/** A source file's code, without its comments — which may say what was removed. */
const code = (path) =>
  read(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");

const connection = (overrides = {}) => ({
  id: "c1",
  providerId: "google",
  status: "connected",
  externalAccount: { displayName: "person@example.com" },
  usedByCount: 0,
  ...overrides,
});

test("a connection's state: connected; needing attention when the platform asks for a new sign-in or names an error; else not connected", () => {
  assert.equal(connectionState(undefined), "not-connected");
  assert.equal(connectionState(connection()), "connected");
  assert.equal(
    connectionState(connection({ errorCode: "invalid_grant" })),
    "attention",
  );
  assert.equal(
    connectionState(connection({ status: "reauthorization-required" })),
    "attention",
  );
  for (const status of ["authorizing", "disconnected"])
    assert.equal(connectionState(connection({ status })), "not-connected");
});

test("line 2: the account's email when it is one, else the state in a word — Needs attention in the warning tone", () => {
  assert.deepEqual(connectionLine(connection()), {
    text: "person@example.com",
    tone: "muted",
  });
  assert.deepEqual(
    connectionLine(
      connection({ externalAccount: { displayName: "Fixture Company" } }),
    ),
    { text: "Connected", tone: "muted" },
  );
  assert.deepEqual(
    connectionLine(
      connection({
        status: "reauthorization-required",
        externalAccount: { displayName: "Acme" },
      }),
    ),
    { text: "Needs attention", tone: "warn" },
  );
  // An email is said even while it needs attention (the app's M10).
  assert.deepEqual(
    connectionLine(connection({ status: "reauthorization-required" })),
    { text: "person@example.com", tone: "muted" },
  );
  assert.deepEqual(connectionLine(undefined), {
    text: "Not connected",
    tone: "muted",
  });
  assert.deepEqual(connectionLine(connection({ status: "disconnected" })), {
    text: "Not connected",
    tone: "muted",
  });
});

test("one button: Connect, Reconnect, Disconnect — and Disconnect's question says what it stops", () => {
  assert.equal(connectionAction("not-connected"), "Connect");
  assert.equal(connectionAction("attention"), "Reconnect");
  assert.equal(connectionAction("connected"), "Disconnect");
  assert.equal(disconnectTitle("Google"), "Disconnect Google?");
  assert.equal(disconnectBody(0), "You can connect it again any time.");
  assert.equal(
    disconnectBody(1),
    "1 live flow uses it. It stops until you connect it again.",
  );
  assert.equal(
    disconnectBody(3),
    "3 live flows use it. They stop until you connect it again.",
  );
  assert.equal(
    CONNECTIONS_MANAGED_BY,
    "Only an owner or admin of this workspace can connect or disconnect an account.",
  );
});

test("of several rows for one provider, the live one speaks for it", () => {
  const old = connection({ id: "old", status: "disconnected" });
  const live = connection({ id: "live" });
  assert.equal(connectionFor([old, live], "google")?.id, "live");
  assert.equal(
    connectionFor(
      [old, connection({ id: "repair", status: "reauthorization-required" })],
      "google",
    )?.id,
    "repair",
  );
  assert.equal(connectionFor([old], "google")?.id, "old");
  assert.equal(connectionFor([old], "quickbooks"), undefined);
});

test("Connections lists every provider in one row each — no description, no 'Used by', no Available connections, no Replace account — and the row is at least 64 tall", () => {
  const panel = code("app/account/connections/ConnectionsPanel.tsx");
  assert.match(panel, /providers\.map\(\(provider\) => \{/u);
  assert.match(panel, /<ConnectionRow\b/u);
  for (const removed of [
    /provider\.description/u,
    /Used by/u,
    /Available connections/u,
    />\s*Replace account\s*</u,
    /StatusPill/u,
  ])
    assert.doesNotMatch(panel, removed);
  // Disconnect is asked first, in the spec's words.
  assert.match(panel, /\{disconnectTitle\(disconnecting\.displayName\)\}/u);
  assert.match(
    panel,
    /\{disconnectBody\(\s*connectionOf\(disconnecting\.providerId\)\?\.usedByCount \?\? 0,?\s*\)\}/u,
  );
  assert.match(panel, /\{pending \? "Disconnecting…" : "Disconnect"\}/u);
  const row = read("components/dashboard/ConnectionRow.tsx");
  assert.match(
    row,
    /"flex min-h-16 w-full items-center gap-2 py-3 text-left"/u,
  );
});
