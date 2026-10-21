import assert from "node:assert/strict";
import { test } from "node:test";
import { followSignedLink, httpsLink } from "../lib/signed-link.ts";

/**
 * A signed link the browser goes to: https only (Build 25, the review's R5c
 * 2) — the run package's downloads and the complete export's, as the server's
 * `platformSignedFile` and the app's `signedLink` take them.
 */

test("an https link is followed; http:, javascript:, data: and no address at all are refused and never followed", () => {
  const went = [];
  const go = (link) => went.push(link);
  const https =
    "https://127.0.0.1:3443/__fixture/package-file?run=fixture-run-invoice&format=pdf";
  assert.equal(followSignedLink(https, go), true);
  assert.deepEqual(went, [https]);
  for (const refused of [
    "http://127.0.0.1:3443/__fixture/package-file?run=fixture-run-invoice&format=pdf",
    "javascript:document.title='followed'",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.example/file.pdf",
    "/account/runs",
    "",
  ]) {
    assert.equal(followSignedLink(refused, go), false, refused);
    assert.equal(httpsLink(refused), null, refused);
  }
  assert.deepEqual(went, [https]);
});
