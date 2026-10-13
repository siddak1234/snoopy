import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  MEASUREMENT_RETRIES,
  MEASUREMENT_RETRY_LONGEST_WAIT_MS,
  MEASUREMENT_RETRY_WAIT_MS,
  completeWhenMeasured,
  waitsToBeMeasured,
} from "../app/account/flows/upload-completion.ts";
import { uploadRefusalMessage } from "../app/account/flows/upload-refusals.ts";

/**
 * A run's file whose completion finds no place yet to measure it is completed
 * again by itself (Round 17's B5; backend BUILD-PLAN 25.2.39): at most four
 * more times, each after the answer's `retry-after` or else 1.5 s, and said in
 * words only when it still waits after the last. Any other answer is the
 * field's at once. Timed on node:test's fake clock. The browser's half — the
 * Run window still uploading meanwhile, then ready with nothing said and the
 * run started; the words after five completions; another 429 said at once — is
 * held by e2e/public-edge-fixture.spec.ts ("a file waiting to be measured is
 * completed again by itself", "each refusal of a file the platform names" and
 * "any other 429 at a completion").
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const WORDS =
  "Files are checked one at a time. Nothing was lost. Choose the file again in a moment.";

/** The file, measured: what the field is given to start the run with. */
const measured = {
  ok: true,
  file: {
    artifactId: "0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f",
    filename: "invoice.pdf",
    contentType: "application/pdf",
    sizeBytes: 24,
  },
};

/** `completeRunUpload`'s answer to a 429 `measurement_busy` (`upload-actions.ts`). */
const busy = (retryAfterSeconds) => ({
  ok: false,
  error: uploadRefusalMessage("measurement_busy", {
    reason: "measurement_busy",
  }),
  measurementBusy: true,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

/** Every answer already given, taken up: the real setImmediate, which the fake clock leaves alone. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/**
 * The platform as one answer per completion, the last repeated, on a fake
 * clock from 0: when each completion was asked, and what the field was given.
 */
function completing(t, answers, signal = new AbortController().signal) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const asked = [];
  const given = { settled: false, answer: undefined };
  void completeWhenMeasured(async () => {
    asked.push(Date.now());
    return answers[Math.min(asked.length, answers.length) - 1];
  }, signal).then((answer) => {
    given.settled = true;
    given.answer = answer;
  });
  return { asked, given };
}

/**
 * Each wait run out as it is set, forty in a row — far more than a bounded run
 * sets, so one that never stops asks forty-one times rather than hanging.
 */
async function runOut(t) {
  for (let wait = 0; wait < 40; wait += 1) {
    await settle();
    t.mock.timers.runAll();
  }
  await settle();
}

test("a file waiting once is completed again 1.5 s later, and the field is given the file with nothing said", async (t) => {
  assert.equal(MEASUREMENT_RETRY_WAIT_MS, 1_500);
  const { asked, given } = completing(t, [busy(), measured]);
  await settle();
  assert.deepEqual(asked, [0]);
  t.mock.timers.tick(1_499);
  await settle();
  assert.deepEqual(asked, [0], "not asked again before 1.5 s");
  assert.equal(given.settled, false, "nothing reaches the field meanwhile");
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(asked, [0, 1_500]);
  assert.equal(given.settled, true);
  assert.deepEqual(given.answer, measured);
  assert.equal("error" in given.answer, false, "no words");
  await runOut(t);
  assert.deepEqual(asked, [0, 1_500], "nothing is asked after the file");
});

test("a file still waiting after four more completions, 1.5 s apart, is said in its words: five completions in all", async (t) => {
  assert.equal(MEASUREMENT_RETRIES, 4);
  const { asked, given } = completing(t, [busy()]);
  await runOut(t);
  assert.deepEqual(asked, [0, 1_500, 3_000, 4_500, 6_000]);
  assert.equal(given.settled, true);
  assert.equal(given.answer.ok, false);
  assert.equal(given.answer.error, WORDS, "the words already said for it");
});

test("any other answer is the field's at once, from one completion: another 429, a refusal, a changed workspace", async (t) => {
  for (const [name, answer] of [
    // A 429 that is not this one — the Edge's flood limit or a plan's request
    // limit — carries no flag (`upload-actions.ts`), with a wait short enough
    // to be waited out, or without one.
    [
      "another 429, with a wait",
      {
        ok: false,
        error: "The platform is busy right now. Try again in 2 seconds.",
        retryAfterSeconds: 2,
      },
    ],
    [
      "another 429",
      {
        ok: false,
        error: "The platform is busy right now. Try again in a moment.",
      },
    ],
    [
      "a refusal",
      {
        ok: false,
        error:
          "This file could not be read. Choose it again, or try another copy.",
      },
    ],
    [
      "an expired upload",
      { ok: false, error: "The upload took too long. Choose the file again." },
    ],
    [
      "a changed workspace",
      {
        ok: false,
        error:
          "The active workspace changed in another tab. Reload this page before continuing.",
      },
    ],
    ["the file", measured],
  ]) {
    await t.test(name, async (t) => {
      const { asked, given } = completing(t, [answer, measured]);
      await runOut(t);
      assert.deepEqual(asked, [0], name);
      assert.equal(given.answer, answer, name);
    });
  }
});

test("only a 429 naming measurement_busy is a file waiting to be measured", () => {
  assert.equal(waitsToBeMeasured(429, { reason: "measurement_busy" }), true);
  for (const [status, details] of [
    // The Edge's flood limit names no reason; a plan's request limit, and run
    // creation's full queue, name their own.
    [429, undefined],
    [429, {}],
    [429, { reason: "over_workspace_quota" }],
    [429, { reason: "max_concurrent_runs" }],
    [429, { reason: "Measurement_busy" }],
    [400, { reason: "measurement_busy" }],
    [409, { reason: "measurement_busy" }],
    [503, { reason: "measurement_busy" }],
  ]) {
    assert.equal(
      waitsToBeMeasured(status, details),
      false,
      `${status} ${JSON.stringify(details)}`,
    );
  }
  // And the server action flags that answer alone, with its wait when named.
  const uploads = read("app/account/flows/upload-actions.ts");
  assert.match(
    uploads,
    /const answer = refused\(error\);\s*if \(\s*error instanceof PlatformServerError &&\s*waitsToBeMeasured\(error\.status, error\.details\)\s*\) \{\s*return \{\s*\.\.\.answer,\s*measurementBusy: true,\s*\.\.\.\(error\.retryAfterSeconds === undefined\s*\? \{\}\s*: \{ retryAfterSeconds: error\.retryAfterSeconds \}\),\s*\};\s*\}\s*return answer;/u,
  );
  assert.equal((uploads.match(/measurementBusy: true/gu) ?? []).length, 1);
});

test("the wait the answer names is honoured: no completion before it, one at it", async (t) => {
  const { asked, given } = completing(t, [busy(3), busy(2), measured]);
  await settle();
  t.mock.timers.tick(2_999);
  await settle();
  assert.deepEqual(asked, [0], "not before its 3 s");
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(asked, [0, 3_000]);
  t.mock.timers.tick(1_999);
  await settle();
  assert.deepEqual(asked, [0, 3_000], "not before its 2 s");
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(asked, [0, 3_000, 5_000]);
  assert.deepEqual(given.answer, measured);
});

test("the waits are bounded: a named wait of 5 s at most is waited out, 20 s in all; a longer one is said at once", async (t) => {
  assert.equal(MEASUREMENT_RETRY_LONGEST_WAIT_MS, 5_000);
  await t.test("5 s each time", async (t) => {
    const { asked, given } = completing(t, [busy(5)]);
    await runOut(t);
    assert.deepEqual(asked, [0, 5_000, 10_000, 15_000, 20_000]);
    assert.equal(given.answer.error, WORDS);
  });
  for (const seconds of [6, 60, 3_600]) {
    await t.test(`${seconds} s`, async (t) => {
      const { asked, given } = completing(t, [busy(seconds), measured]);
      await runOut(t);
      assert.deepEqual(asked, [0]);
      assert.equal(given.answer.error, WORDS);
    });
  }
});

test("a field that goes, or a new choice, stops the waiting at once, and nothing more is asked", async (t) => {
  await t.test("while it waits", async (t) => {
    const field = new AbortController();
    const { asked, given } = completing(t, [busy(), measured], field.signal);
    await settle();
    t.mock.timers.tick(1_000);
    field.abort();
    await settle();
    assert.equal(given.settled, true, "the wait ends with the field");
    await runOut(t);
    assert.deepEqual(asked, [0]);
  });
  await t.test("while a completion is on its way", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    const field = new AbortController();
    let answer = () => {};
    let asked = 0;
    // The first answer is held until the field has gone; any later one would
    // be the file, at once.
    const given = completeWhenMeasured(() => {
      asked += 1;
      if (asked > 1) return Promise.resolve(measured);
      return new Promise((resolve) => {
        answer = resolve;
      });
    }, field.signal);
    await settle();
    field.abort();
    answer(busy());
    assert.equal((await given).measurementBusy, true);
    await runOut(t);
    assert.equal(asked, 1);
  });
});

test("the Run window completes through it with the upload's own signal, and drops an answer once that is aborted", () => {
  const field = read("app/account/flows/RunFileField.tsx");
  assert.match(
    field,
    /const \{ uploadSessionId \} = opened\.ticket;\s*const completed = await completeWhenMeasured\(\s*\(\) => completeRunUpload\(workspaceId, uploadSessionId\),\s*upload\.signal,\s*\);\s*if \(upload\.signal\.aborted\) return;\s*if \(!completed\.ok\) throw new Error\(completed\.error\);/u,
  );
  assert.equal(
    (field.match(/completeRunUpload\(/gu) ?? []).length,
    1,
    "the field's one completion goes through it",
  );
});
