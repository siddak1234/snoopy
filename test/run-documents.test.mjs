import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  DOWNLOAD_EXCEL,
  DOWNLOAD_FAILED,
  DOWNLOAD_PDF,
  PACKAGE_UNAVAILABLE,
  RUN_PACKAGE_MAXIMUM_BYTES,
  VIEW_PACKAGE,
  askPackageOnceMore,
  packageFileHref,
  packageRetryWaitMs,
} from "../lib/run-documents.ts";

/**
 * The run package (Build 24, P12; backend ADR-0045): its words, the app's;
 * the one retry both askers use; the downloads, followed only when https.
 * ~~A run's documents, each on its own card~~ until Round 21 (backend
 * ADR-0048): the platform sends them as blocks, and the backend's
 * `apps/runs/test/pages-*.test.ts` hold every word this file's card tables
 * held; `test/blocks-parity.test.mjs` draws them.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the run package's words, the app's (Build 24, P12; ~~Download JSON~~ until then); offered when the platform says the job has one (packageAvailable)", () => {
  assert.equal(VIEW_PACKAGE, "View package");
  assert.equal(DOWNLOAD_PDF, "Download PDF");
  assert.equal(DOWNLOAD_EXCEL, "Download Excel");
  assert.equal(DOWNLOAD_FAILED, "Could not download. Try again.");
  assert.equal(PACKAGE_UNAVAILABLE, "This run has no package yet.");
  // The answer says it (backend ADR-0048), on the run's page and the package's.
  assert.match(
    read("app/account/runs/[runId]/package/page.tsx"),
    /const ready = detail\.packageAvailable === true;/u,
  );
});

test("the platform busy building others: asked once more after its retry-after (2 s when none, not past 10 s); the frame's route by the job's id and the browser's zone; the platform's 32 MB bound, as MiB (P12)", () => {
  assert.deepEqual([undefined, 0, 1, 5, 10, 11, 300].map(packageRetryWaitMs), [
    2_000,
    0,
    1_000,
    5_000,
    10_000,
    null,
    null,
  ]);
  assert.equal(
    packageFileHref("fixture-run-invoice", "America/Chicago"),
    "/account/runs/fixture-run-invoice/package/file?timeZone=America%2FChicago",
  );
  assert.equal(
    packageFileHref("a b", null),
    "/account/runs/a%20b/package/file",
  );
  assert.equal(RUN_PACKAGE_MAXIMUM_BYTES, 26_214_400);
});

test("a package request is asked once more after a 503's wait — 2 s when it names none, never past 10 s — and busy again, any other refusal, or no status at all is the caller's (Build 25, the review's R5c 5: the one helper both askers use)", async () => {
  const busy = (retryAfterSeconds) =>
    Object.assign(new Error("busy"), { status: 503, retryAfterSeconds });
  const refusal = (error) =>
    error instanceof Error && "status" in error ? error : null;
  const asker = (...answers) => {
    const asked = [];
    const ask = async () => {
      const answer = answers[asked.length];
      asked.push(answer);
      if (answer instanceof Error) throw answer;
      return answer;
    };
    return { ask, asked };
  };
  const slept = [];
  const sleep = async (ms) => {
    slept.push(ms);
  };
  // Busy once, naming 3 s: waited, asked again, answered.
  let made = asker(busy(3), "file");
  assert.equal(await askPackageOnceMore(made.ask, refusal, sleep), "file");
  assert.equal(made.asked.length, 2);
  // Busy naming no wait: 2 s.
  made = asker(busy(undefined), "file");
  assert.equal(await askPackageOnceMore(made.ask, refusal, sleep), "file");
  assert.deepEqual(slept, [3_000, 2_000]);
  // Busy again: the second refusal is the caller's — asked twice, no more.
  const again = busy(1);
  made = asker(busy(1), again, "never");
  await assert.rejects(
    askPackageOnceMore(made.ask, refusal, sleep),
    (error) => error === again,
  );
  assert.equal(made.asked.length, 2);
  // A wait over 10 s, another status, or an error with none: said at once.
  for (const error of [
    busy(11),
    Object.assign(new Error("gone"), { status: 409 }),
    new Error("offline"),
  ]) {
    made = asker(error, "never");
    await assert.rejects(
      askPackageOnceMore(made.ask, refusal, sleep),
      (thrown) => thrown === error,
    );
    assert.equal(made.asked.length, 1);
  }
  assert.deepEqual(slept, [3_000, 2_000, 1_000]);
});

test("Download PDF and Download Excel: the platform's link, asked through /api/platform in the browser's zone with a key, then followed — a busy platform asked once more, a refusal said; never a hand-written fetch, and Download JSON gone (P12)", () => {
  const live = read("app/account/runs/[runId]/RunLive.tsx");
  assert.match(
    live,
    /platformApiJson<RunPackageFile>\(\s*`\/v1\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}\/runs\/\$\{encodeURIComponent\(runId\)\}\/package`,\s*\{\s*method: "POST",\s*headers: \{\s*"content-type": "application\/json",\s*"idempotency-key": `run-package-\$\{format\}-\$\{crypto\.randomUUID\(\)\}`,/u,
  );
  assert.match(live, /\.\.\.\(zone \? \{ timeZone: zone \} : \{\}\)/u);
  // Followed only when https (Build 25, the review's R5c 2).
  assert.match(
    live,
    /if \(!followSignedLink\(file\.downloadUrl\)\) setError\(DOWNLOAD_FAILED\);/u,
  );
  assert.doesNotMatch(live, /window\.location\.assign/u);
  // The one retry, the route's too (Build 25, the review's R5c 5).
  assert.match(
    live,
    /\(error\) => \(error instanceof PlatformApiError \? error : null\),/u,
  );
  assert.match(
    read("app/account/runs/[runId]/package/file/route.ts"),
    /const file = await askPackageOnceMore\(\s*\(\) => createRunPackageFile\(workspaceId, runId, body, origin\),\s*\(error\) => \(error instanceof PlatformServerError \? error : null\),\s*\);/u,
  );
  for (const asker of [
    live,
    read("app/account/runs/[runId]/package/file/route.ts"),
  ]) {
    assert.doesNotMatch(asker, /packageRetryWaitMs|setTimeout\(resolve/u);
  }
  assert.match(live, /setError\(DOWNLOAD_FAILED\);/u);
  // Offered once the job can be packaged, with View package on the run page,
  // in a row of their own over Run details (build 28's review, finding 2).
  assert.match(
    live,
    /\{detail\.packageAvailable === true \? \(\s*<div className="mb-5 flex flex-wrap items-center gap-2">\s*<PackageActions workspaceId=\{workspaceId\} runId=\{run\.id\} view \/>/u,
  );
  // Gone, but in the struck-through history of its comments.
  assert.doesNotMatch(
    live.replace(/~~[\s\S]*?~~/gu, ""),
    /Download JSON|DOWNLOAD_JSON|documentsFileName/u,
  );
  assert.doesNotMatch(live, /\bfetch\(/u);
  assert.doesNotMatch(read("lib/platform-api.ts"), /platformApiFile/u);
});
