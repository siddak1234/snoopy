/**
 * What a run's file field sends (backend BUILD-PLAN 25.8.5, the owner's
 * decision 8 of 2026-10-10), as the app sends it (25.8.3): a PDF as it is, and
 * every image drawn upright onto a canvas and saved as a JPEG whose long side
 * is at most 2,576 px. Anything else is refused before anything is sent.
 *
 * A field that names its types (`acceptedContentTypes`, backend ADR-0046; a
 * run's file field and an item's file) is offered those: a JPEG or a PNG
 * among them is still drawn again, any other — a Word file — is sent as it
 * is, never re-encoded, and a type outside them is refused in words that
 * name what is accepted ("Choose a PDF, Word file or photo."). Without them,
 * today's PDF, JPEG or PNG.
 *
 * The decisions are pure, so `test/run-file-image.test.mjs` holds them;
 * `reencodeImage` is the browser's half.
 */

/**
 * The file chooser's `accept` for a field that names no types: a PDF, a JPEG
 * or a PNG.
 */
export const RUN_FILE_ACCEPT = "application/pdf,image/jpeg,image/png";

/** A Word file (.docx): sent as it is. */
export const WORD_FILE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** The chooser's `accept`: the field's own types when it names them, else a PDF, a JPEG or a PNG. */
export function fileAccept(accepted?: readonly string[]): string {
  return accepted && accepted.length > 0 ? accepted.join(",") : RUN_FILE_ACCEPT;
}

/** Whether Take photo is offered: a photo is sent as a JPEG, so only where a JPEG is taken. */
export function takesPhotos(accepted?: readonly string[]): boolean {
  return (
    !accepted ||
    accepted.length === 0 ||
    accepted.some((type) => type.toLowerCase() === "image/jpeg")
  );
}

/** A type in words: "PDF", "Word file", "photo"; one this list does not know, as it is. */
function typeInWords(type: string): string {
  const media = type.toLowerCase();
  if (media === "application/pdf") return "PDF";
  if (media === WORD_FILE) return "Word file";
  if (media.startsWith("image/")) return "photo";
  return type;
}

/** The accepted types in words, each once, in the field's order: "PDF, Word file or photo". */
export function typesInWords(accepted?: readonly string[]): string {
  if (!accepted || accepted.length === 0) return "PDF, JPEG or PNG";
  const names = [...new Set(accepted.map(typeInWords))];
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/** A file of a type the field does not take, said before anything is sent. */
export function notAcceptedLine(accepted?: readonly string[]): string {
  if (!accepted || accepted.length === 0) return NOT_A_RUN_FILE;
  return `Choose a ${typesInWords(accepted)}.`;
}

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
 *
 * Given the field's `accepted` types, only those are taken: a JPEG or a PNG
 * is drawn again while a JPEG is taken, and any other accepted type — a Word
 * file — is sent as it is.
 */
export function planRunFile(
  type: string,
  source: RunFileSource,
  accepted?: readonly string[],
): "send" | "re-encode" | "refuse" {
  const media = type.toLowerCase();
  if (accepted && accepted.length > 0) {
    const takes = (candidate: string) =>
      accepted.some((entry) => entry.toLowerCase() === candidate);
    const photos = takesPhotos(accepted);
    if (source === "camera" && media.startsWith("image/"))
      return photos ? "re-encode" : "refuse";
    if (!takes(media)) return "refuse";
    if ((media === "image/jpeg" || media === "image/png") && photos)
      return "re-encode";
    return "send";
  }
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
