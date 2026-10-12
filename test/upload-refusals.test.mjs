import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadRefusalMessage } from "../app/account/flows/upload-refusals.ts";

/**
 * A run's file refused by the platform, said in words (FR-14), including the
 * five reasons the platform gives since it measures a file when its upload is
 * sealed (backend BUILD-PLAN 25.2.28). The browser's half — each reason shown
 * in the Run window and the field emptied — is held by
 * e2e/public-edge-fixture.spec.ts ("each refusal of a file the platform names").
 */

test("a measured file's refusal names its numbers when the platform sends them", () => {
  assert.equal(
    uploadRefusalMessage("file_too_many_pages", {
      reason: "file_too_many_pages",
      pageCount: "14",
      maximumPdfPages: "10",
    }),
    "This PDF has 14 pages. This flow reads at most 10.",
  );
  assert.equal(
    uploadRefusalMessage("file_image_too_large", {
      reason: "file_image_too_large",
      widthPixels: "9000",
      heightPixels: "120",
      maximumImageSidePixels: "8000",
    }),
    "This image is 9000 × 120 pixels. This flow takes images up to 8000 pixels on a side.",
  );
});

test("a number that is not a whole number is never shown; the sentence without numbers is said", () => {
  for (const pageCount of [
    undefined,
    "",
    "14 pages",
    "-3",
    "1e3",
    "<b>14</b>",
    "12345678901",
  ]) {
    assert.equal(
      uploadRefusalMessage("file_too_many_pages", {
        pageCount,
        maximumPdfPages: "10",
      }),
      "This PDF has more pages than this flow reads.",
      String(pageCount),
    );
  }
  assert.equal(
    uploadRefusalMessage("file_image_too_large", {
      widthPixels: "9000",
      maximumImageSidePixels: "8000",
    }),
    "This image is larger than this flow takes.",
  );
});

test("every reason the website names has its sentence; one it does not name is left to the platform's title", () => {
  const named = {
    content_type_not_accepted: "This flow does not accept that type of file.",
    file_too_large: "The file is larger than this flow accepts.",
    subscription_not_live: "Go live first; a paused flow takes no files.",
    no_file_input: "This flow does not take a file.",
    session_expired: "The upload took too long. Choose the file again.",
    no_object: "The file did not arrive. Choose it again.",
    too_large: "The file is larger than this flow accepts.",
    file_content_mismatch:
      "This file's contents don't match its type. Choose the original file again.",
    file_encrypted:
      "This PDF is password-protected. Remove the password and upload it again.",
    file_unreadable:
      "This file could not be read. Choose it again, or try another copy.",
  };
  for (const [reason, words] of Object.entries(named)) {
    assert.equal(uploadRefusalMessage(reason, { reason }), words, reason);
  }
  for (const reason of [
    "a_reason_not_named_here",
    "toString",
    "__proto__",
    undefined,
    42,
  ]) {
    assert.equal(uploadRefusalMessage(reason, {}), undefined, String(reason));
  }
});
