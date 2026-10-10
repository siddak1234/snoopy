/**
 * What a run's file field sends (backend BUILD-PLAN 25.8.5, the owner's
 * decision 8 of 2026-10-10), as the app sends it (25.8.3): a PDF as it is, and
 * every image drawn upright onto a canvas and saved as a JPEG whose long side
 * is at most 2,576 px. Anything else is refused before anything is sent.
 *
 * The decisions are pure, so `test/run-file-image.test.mjs` holds them;
 * `reencodeImage` is the browser's half.
 */

/**
 * The file chooser's `accept`: a PDF, a JPEG or a PNG. Named here because a
 * run-input field carries no list of types.
 */
export const RUN_FILE_ACCEPT = "application/pdf,image/jpeg,image/png";

/** The longest side, in pixels, an image is sent at. */
export const IMAGE_LONG_SIDE_MAX = 2576;

/** The quality an image is saved at as a JPEG: high, so print stays legible. */
export const IMAGE_JPEG_QUALITY = 0.9;

/** A file of a type the field does not send, said before anything is sent. */
export const NOT_A_RUN_FILE = "Choose a PDF, JPEG or PNG file.";

/** An image the browser could not decode, or could not save again. */
export const IMAGE_UNREADABLE = "The image could not be read. Try another.";

/** Where a file came from: the file chooser, or Take photo's camera. */
export type RunFileSource = "chooser" | "camera";

/**
 * What happens to a file, by its type: a PDF is sent as it is; a JPEG or a PNG
 * is drawn again and sent as a JPEG; anything else is refused. A photo is an
 * image whatever type the camera gave it, so it is drawn again too — what the
 * platform receives is a JPEG either way.
 */
export function planRunFile(
  type: string,
  source: RunFileSource,
): "send" | "re-encode" | "refuse" {
  const media = type.toLowerCase();
  if (media === "application/pdf") return "send";
  if (media === "image/jpeg" || media === "image/png") return "re-encode";
  if (source === "camera" && media.startsWith("image/")) return "re-encode";
  return "refuse";
}

/**
 * An image's size once its long side is at most `longest`, its proportions
 * kept. An image already within it keeps its size: nothing is enlarged.
 */
export function boundedSize(
  width: number,
  height: number,
  longest: number = IMAGE_LONG_SIDE_MAX,
): { width: number; height: number } {
  if (Math.max(width, height) <= longest) return { width, height };
  // The long side is the bound exactly; only the short side is rounded, so
  // rounding can never take the long side past it.
  if (width >= height) {
    return {
      width: longest,
      height: Math.max(1, Math.round((height * longest) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * longest) / height)),
    height: longest,
  };
}

/** The name an image is sent under: its own, ending `.jpg`. */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^.]*$/u, "");
  return `${base || "image"}.jpg`;
}

/**
 * The image drawn upright and saved once as a JPEG within the bound.
 *
 * `createImageBitmap` turns the image the way its own orientation says (EXIF):
 * its `imageOrientation` option is "from-image" unless told otherwise, so a
 * photo taken with the phone held sideways is drawn the way it was held.
 * Transparent pixels are drawn on white, the paper an invoice is printed on —
 * a JPEG keeps no transparency, and a canvas left empty saves them black.
 * Refused, in words, when the browser cannot decode the image.
 */
export async function reencodeImage(image: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    throw new Error(IMAGE_UNREADABLE);
  }
  const canvas = document.createElement("canvas");
  try {
    const { width, height } = boundedSize(bitmap.width, bitmap.height);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(IMAGE_UNREADABLE);
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY),
    );
    if (!jpeg) throw new Error(IMAGE_UNREADABLE);
    return new File([jpeg], jpegName(image.name), { type: "image/jpeg" });
  } finally {
    bitmap.close();
    // A phone's browser bounds the memory all its canvases hold together;
    // this one is given back now rather than when it is collected.
    canvas.width = 0;
    canvas.height = 0;
  }
}
