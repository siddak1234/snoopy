// The deployed contract check (scripts/verify-deployed-contracts.mjs, CI's
// contract-deployed job): the committed headers' hashes against what the
// running platform's /health/live reports (register F94). Every branch of its
// verdict is a pure function, judged here with fixtures — the network is never
// read; readLive's retries run against a stubbed fetch.
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import {
  committedHashes,
  judge,
  readLive,
  readRequirement,
} from "../scripts/verify-deployed-contracts.mjs";

const root = resolve(import.meta.dirname, "..");
const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const D = "d".repeat(64);
const COMMIT = "c6b8650".padEnd(40, "0");
const committed = {
  "openapi.yaml": A,
  "automations.yaml": B,
  "connections.yaml": C,
};
const live = (contracts) => ({
  body: {
    status: "ok",
    service: "snoopy-api",
    version: "0.1.0",
    commit: COMMIT,
    contracts,
  },
});
const last = (verdict) => verdict.lines.at(-1);

test("passes when every committed hash is the deployed one, and names the deployed commit", () => {
  const verdict = judge({ committed, answer: live(committed) });
  assert.equal(verdict.ok, true);
  assert.ok(verdict.lines.includes(`deployed commit ${COMMIT}`));
  assert.match(last(verdict), /^PASS: /u);
});

test("fails a mismatch, naming the document and both hashes", () => {
  const verdict = judge({
    committed,
    answer: live({ ...committed, "automations.yaml": D }),
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.lines.some((line) =>
      line.includes(
        `automations.yaml  committed ${B}  deployed ${D}  DIFFERENT`,
      ),
    ),
  );
  assert.match(last(verdict), /^FAIL: automations\.yaml — /u);
  assert.match(last(verdict), /aheadOfDeployed/u);
});

test("fails closed when the host could not be read — ahead or not", () => {
  for (const aheadOfDeployed of [false, true]) {
    const verdict = judge({
      committed,
      answer: { error: "4 attempts, the last: fetch failed" },
      aheadOfDeployed,
    });
    assert.equal(verdict.ok, false);
    assert.match(
      last(verdict),
      /^FAIL \(closed\): .* could not be read \(4 attempts/u,
    );
  }
});

test("fails closed on an answer with no marker — today's /health/live — ahead or not", () => {
  for (const aheadOfDeployed of [false, true]) {
    const verdict = judge({
      committed,
      answer: {
        body: { status: "ok", service: "snoopy-api", version: "0.1.0" },
      },
      aheadOfDeployed,
    });
    assert.equal(verdict.ok, false);
    assert.match(last(verdict), /^FAIL \(closed\): .* no deployed marker/u);
  }
});

test("fails closed on a marker that lacks a document or carries no sha256 for it", () => {
  assert.match(
    last(
      judge({
        committed,
        answer: live({ "openapi.yaml": A, "automations.yaml": B }),
      }),
    ),
    /no sha256 for connections\.yaml/u,
  );
  for (const answer of [
    live({ ...committed, "openapi.yaml": "A1" }),
    live(null),
    { body: "ok" },
  ]) {
    assert.equal(judge({ committed, answer }).ok, false);
  }
});

test("passes a mismatch loudly when platform-requirement.json declares the tree ahead", () => {
  const verdict = judge({
    committed,
    answer: live({ ...committed, "openapi.yaml": D }),
    aheadOfDeployed: true,
  });
  assert.equal(verdict.ok, true);
  assert.ok(
    verdict.lines.some((line) =>
      line.startsWith("PASS, AHEAD OF THE DEPLOYED PLATFORM"),
    ),
  );
  assert.ok(
    verdict.lines.some((line) => line.includes("openapi.yaml differs")),
  );
  assert.match(last(verdict), /^!!! .* must not ship/u);
});

test("--release reads no escape: an ahead tree is refused, a matching one passes", () => {
  const verdict = judge({
    committed,
    answer: live({ ...committed, "openapi.yaml": D }),
    aheadOfDeployed: true,
    release: true,
  });
  assert.equal(verdict.ok, false);
  assert.match(last(verdict), /a release never ships ahead of the platform/u);
  assert.equal(
    judge({
      committed,
      answer: live(committed),
      aheadOfDeployed: true,
      release: true,
    }).ok,
    true,
  );
});

test("fails an escape that outlived its change: ahead declared, nothing ahead", () => {
  const verdict = judge({
    committed,
    answer: live(committed),
    aheadOfDeployed: true,
  });
  assert.equal(verdict.ok, false);
  assert.match(last(verdict), /Set it back to \{"aheadOfDeployed": false\}/u);
});

test("readLive retries a refused connection, a non-2xx and a non-JSON answer, then gives up with the last error", async () => {
  const answers = [
    () => {
      throw new Error("connect ECONNREFUSED");
    },
    () => ({ ok: false, status: 502, text: async () => "bad gateway" }),
    () => ({ ok: true, status: 200, text: async () => "<html>" }),
    () => {
      throw new Error("The operation was aborted due to timeout");
    },
  ];
  let calls = 0;
  const result = await readLive("https://x.test/health/live", {
    delays: [0, 0, 0],
    fetch: async () => answers[calls++](),
  });
  assert.equal(calls, 4);
  assert.deepEqual(result, {
    error: "4 attempts, the last: The operation was aborted due to timeout",
  });
});

test("readLive returns the first JSON answer after a transient failure, without trying again", async () => {
  let calls = 0;
  const result = await readLive("https://x.test/health/live", {
    delays: [0, 0, 0],
    fetch: async () => {
      calls += 1;
      if (calls === 1) throw new Error("fetch failed");
      return { ok: true, status: 200, text: async () => '{"status":"ok"}' };
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { body: { status: "ok" } });
});

test("reads this tree's three headers, each a sha256 its file's first line names", () => {
  const hashes = committedHashes(root);
  assert.deepEqual(Object.keys(hashes), [
    "openapi.yaml",
    "automations.yaml",
    "connections.yaml",
  ]);
  const first = readFileSync(
    join(root, "lib/generated/platform-contracts/platform.d.ts"),
    "utf8",
  ).split("\n")[0];
  assert.equal(
    first,
    `// From snoopy-backend docs/openapi.yaml, sha256 ${hashes["openapi.yaml"]}.`,
  );
});

test("refuses a generated file with no header, or a header naming another document", () => {
  const dir = mkdtempSync(join(tmpdir(), "snoopy-deployed-"));
  try {
    mkdirSync(join(dir, "lib/generated/platform-contracts"), {
      recursive: true,
    });
    const write = (file, first) =>
      writeFileSync(
        join(dir, "lib/generated/platform-contracts", file),
        `${first}\nexport {};\n`,
      );
    write(
      "platform.d.ts",
      `// From snoopy-backend docs/openapi.yaml, sha256 ${A}.`,
    );
    write(
      "automations.d.ts",
      `// From snoopy-backend docs/openapi/connections.yaml, sha256 ${B}.`,
    );
    write("connections.d.ts", "/** hand-written */");
    assert.throws(
      () => committedHashes(dir),
      /automations\.d\.ts names docs\/openapi\/connections\.yaml, not docs\/openapi\/automations\.yaml/u,
    );
    write(
      "automations.d.ts",
      `// From snoopy-backend docs/openapi/automations.yaml, sha256 ${B}.`,
    );
    assert.throws(() => committedHashes(dir), /connections\.d\.ts carries no/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("platform-requirement.json is committed as not ahead, and nothing but that one boolean is read", () => {
  assert.deepEqual(readRequirement(root), { aheadOfDeployed: false });
  const dir = mkdtempSync(join(tmpdir(), "snoopy-requirement-"));
  try {
    assert.throws(() => readRequirement(dir), /is missing/u);
    for (const text of [
      '{"aheadOfDeployed": "yes"}',
      '{"aheadOfDeployed": true, "x": 1}',
      "[true]",
      "ahead",
    ]) {
      writeFileSync(join(dir, "platform-requirement.json"), text);
      assert.throws(() => readRequirement(dir), /platform-requirement\.json/u);
    }
    writeFileSync(
      join(dir, "platform-requirement.json"),
      '{"aheadOfDeployed": true}',
    );
    assert.deepEqual(readRequirement(dir), { aheadOfDeployed: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
