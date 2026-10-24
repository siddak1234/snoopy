import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  IMAGE_JPEG_QUALITY,
  IMAGE_LONG_SIDE_MAX,
  NOT_A_RUN_FILE,
  RUN_FILE_ACCEPT,
  WORD_FILE,
  boundedSize,
  fileAccept,
  jpegName,
  notAcceptedLine,
  planRunFile,
  takesPhotos,
  typesInWords,
} from "../app/account/flows/run-file-image.ts";

/**
 * What a run's file field sends (backend BUILD-PLAN 25.8.5, the owner's
 * decision 8 of 2026-10-10): the file chooser limited to a PDF, a JPEG or a
 * PNG; Take photo on a phone or a tablet; every image drawn upright and saved
 * as a JPEG whose long side is at most 2,576 px, never enlarged; a PDF sent as
 * it is. The decisions are pure and held here; what the browser does with them
 * is held by e2e/public-edge-fixture.spec.ts ("a photo or an image for a run").
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the file chooser takes a PDF, a JPEG or a PNG, named in code, for a field that names no types", () => {
  assert.equal(RUN_FILE_ACCEPT, "application/pdf,image/jpeg,image/png");
  assert.equal(fileAccept(undefined), RUN_FILE_ACCEPT);
  assert.equal(fileAccept([]), RUN_FILE_ACCEPT);
  const field = read("app/account/flows/RunFileField.tsx");
  assert.match(field, /const accepted = field\.acceptedContentTypes;/u);
  assert.match(
    field,
    /id=\{inputId\}\s*type="file"\s*accept=\{fileAccept\(accepted\)\}/u,
  );
});

test("a field that names its types (acceptedContentTypes, backend ADR-0046) offers those, sends a Word file as it is, and says what it takes (plan §5.5)", () => {
  const items = ["application/pdf", WORD_FILE, "image/jpeg", "image/png"];
  const noImages = ["application/pdf", WORD_FILE];
  assert.equal(fileAccept(items), items.join(","));
  // A Word file is sent as it is, never drawn again; a PDF too.
  assert.equal(planRunFile(WORD_FILE, "chooser", items), "send");
  assert.equal(planRunFile("application/pdf", "chooser", items), "send");
  // A JPEG or a PNG is drawn again while a JPEG is taken.
  assert.equal(planRunFile("image/png", "chooser", items), "re-encode");
  assert.equal(planRunFile("image/jpeg", "camera", items), "re-encode");
  // Outside the field's types: refused, even a PDF's neighbours.
  assert.equal(planRunFile("image/jpeg", "chooser", noImages), "refuse");
  assert.equal(planRunFile("image/heic", "camera", noImages), "refuse");
  assert.equal(planRunFile("application/msword", "chooser", items), "refuse");
  assert.equal(planRunFile("text/plain", "chooser", items), "refuse");
  // Without types, today's rule: a Word file is refused.
  assert.equal(planRunFile(WORD_FILE, "chooser"), "refuse");
  // Take photo only where a JPEG is taken.
  assert.equal(takesPhotos(items), true);
  assert.equal(takesPhotos(noImages), false);
  assert.equal(takesPhotos(undefined), true);
  // The refusal and the line beside the button name what is accepted.
  assert.equal(typesInWords(items), "PDF, Word file or photo");
  assert.equal(typesInWords(noImages), "PDF or Word file");
  assert.equal(typesInWords(["application/pdf"]), "PDF");
  assert.equal(notAcceptedLine(items), "Choose a PDF, Word file or photo.");
  assert.equal(notAcceptedLine(undefined), NOT_A_RUN_FILE);
  assert.equal(NOT_A_RUN_FILE, "Choose a PDF, JPEG or PNG file.");
  const field = read("app/account/flows/RunFileField.tsx");
  assert.match(field, /planRunFile\(chosen\.type, source, accepted\)/u);
  assert.match(field, /setError\(notAcceptedLine\(accepted\)\)/u);
  assert.match(field, /takesPhotos\(accepted\)/u);
});

test("a PDF is sent as it is, a JPEG or a PNG is drawn again, and anything else is refused", () => {
  for (const source of ["chooser", "camera"]) {
    assert.equal(planRunFile("application/pdf", source), "send");
    assert.equal(planRunFile("image/jpeg", source), "re-encode");
    assert.equal(planRunFile("image/png", source), "re-encode");
    assert.equal(planRunFile("IMAGE/PNG", source), "re-encode");
    for (const type of ["text/plain", "application/zip", "video/mp4", ""]) {
      assert.equal(
        planRunFile(type, source),
        "refuse",
        `${type} from ${source}`,
      );
    }
  }
  // Any other image is refused from the chooser, whose accept names three
  // types — but a photo is an image whatever the camera called it, and is
  // sent as a JPEG all the same.
  for (const type of ["image/heic", "image/webp", "image/gif"]) {
    assert.equal(planRunFile(type, "chooser"), "refuse", type);
    assert.equal(planRunFile(type, "camera"), "re-encode", type);
  }
});

test("an image's long side is brought to 2,576 px at most, its proportions kept", () => {
  assert.equal(IMAGE_LONG_SIDE_MAX, 2576);
  // A 12-megapixel phone photo, held either way.
  assert.deepEqual(boundedSize(4032, 3024), { width: 2576, height: 1932 });
  assert.deepEqual(boundedSize(3024, 4032), { width: 1932, height: 2576 });
  // Square, and only just over.
  assert.deepEqual(boundedSize(2577, 2577), { width: 2576, height: 2576 });
  assert.deepEqual(boundedSize(3200, 1800), { width: 2576, height: 1449 });
  // An extreme strip keeps a side of at least one pixel.
  assert.deepEqual(boundedSize(100_000, 1), { width: 2576, height: 1 });
  for (let width = 1; width <= 9000; width += 97) {
    for (let height = 1; height <= 9000; height += 89) {
      const sized = boundedSize(width, height);
      const longest = Math.max(sized.width, sized.height);
      assert.ok(
        longest <= 2576,
        `${width}x${height} → ${sized.width}x${sized.height}`,
      );
      if (Math.max(width, height) > 2576) {
        assert.equal(longest, 2576, `${width}x${height}`);
        // The short side is the only one rounded, by at most half a pixel.
        const exact =
          (Math.min(width, height) * 2576) / Math.max(width, height);
        assert.ok(
          Math.abs(Math.min(sized.width, sized.height) - exact) <= 0.5 ||
            Math.min(sized.width, sized.height) === 1,
          `${width}x${height}`,
        );
      }
    }
  }
});

test("an image within the bound keeps its size: nothing is enlarged", () => {
  assert.deepEqual(boundedSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(boundedSize(2576, 2576), { width: 2576, height: 2576 });
  assert.deepEqual(boundedSize(2576, 10), { width: 2576, height: 10 });
  assert.deepEqual(boundedSize(1, 1), { width: 1, height: 1 });
});

test("an image is sent under its own name ending .jpg, as a high-quality JPEG", () => {
  assert.equal(jpegName("scan.png"), "scan.jpg");
  assert.equal(jpegName("IMG_0001.HEIC"), "IMG_0001.jpg");
  assert.equal(jpegName("receipt.jpeg"), "receipt.jpg");
  assert.equal(jpegName("image.jpg"), "image.jpg");
  assert.equal(jpegName("march.invoice.png"), "march.invoice.jpg");
  assert.equal(jpegName("no-extension"), "no-extension.jpg");
  assert.equal(jpegName(".png"), "image.jpg");
  assert.equal(IMAGE_JPEG_QUALITY, 0.9);
  const image = read("app/account/flows/run-file-image.ts");
  assert.match(
    image,
    /canvas\.toBlob\(resolve, "image\/jpeg", IMAGE_JPEG_QUALITY\)/u,
  );
  assert.match(
    image,
    /new File\(\[jpeg\], jpegName\(image\.name\), \{ type: "image\/jpeg" \}\)/u,
  );
  // Upright: createImageBitmap's own orientation, "from-image", is its
  // default — given no options, it is never told to ignore it or flip.
  assert.match(image, /await createImageBitmap\(image\);/u);
});

test("Take photo is a second file input — the camera, for an image — offered only where the primary pointer is coarse", () => {
  const field = read("app/account/flows/RunFileField.tsx");
  assert.match(field, /const PHONE_OR_TABLET = "\(pointer: coarse\)";/u);
  assert.match(
    field,
    /\{offersCamera \? \([\s\S]*?type="file"\s*accept="image\/\*"\s*capture="environment"\s*hidden/u,
  );
  assert.match(field, /onClick=\{\(\) => camera\.current\?\.click\(\)\}/u);
  // What a run is given is still only the file's id: the camera's input has no
  // name, so the form never carries its file.
  const camera = /<input\s*ref=\{camera\}[\s\S]*?\/>/u.exec(field)?.[0] ?? "";
  assert.ok(camera, "the camera's input is found");
  assert.doesNotMatch(camera, /\bname=/u);
});
