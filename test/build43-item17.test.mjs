import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import {
  CHOOSE_FILE_LABEL,
  DEFAULT_MAX_FILES,
  TAKE_PHOTO_LABEL,
  addFileFirst,
  missingFile,
  removeFileLabel,
  tooManyFiles,
  withoutFile,
} from "../lib/several-files.ts";
import { SPACING } from "../lib/spacing.ts";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * The owner's TestFlight build 43, item 17, on the website (the same words
 * and behaviour as the app; the owner's words of 2026-11-13): "for the
 * compact card i want two buttons … upload start … start should be more
 * bolded and colored so easy to click. start throws an error rather than
 * starting if nothing was uploaded when required … the document should
 * dynamically show up in a horizontal pill with the document name and an x
 * on the right side of the pill". Home's card: Upload (Take photo or Choose
 * file in its menu on a phone) and a filled Start; every start form: a pill
 * per file with its x, and "Add {title} first." for a required file missing.
 * The job upload card keeps its "Ready:" line. The presses themselves run in
 * the fixture suite (`e2e/public-edge-fixture.spec.ts`, "build 43, item 17").
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const RUN_START = "app/account/flows/RunStart.tsx";
const FILE_FIELD = "app/account/flows/RunFileField.tsx";
const STUBS = {
  "./actions":
    "export const setSubscriptionStatus = async () => ({ ok: true }); export const startRun = async () => ({ ok: true });",
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' });",
};
const NO_ROUTER = (source) =>
  source.replace(
    /import \{ useRouter \} from "next\/navigation";/u,
    "const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
  );
/** On a phone: the field can take a photo. */
const PHONE = (source) =>
  source.replace(
    "useSyncExternalStore(watchPointer, onPhoneOrTablet, unknownOnServer)",
    "true",
  );
/** The field's state at first: `kind` and the rest. */
const HOLDING = (state) => (source) =>
  source.replace('>({ kind: "empty" });', `>(${JSON.stringify(state)});`);
const OPEN_MENU = (source) =>
  source.replace(
    "const [menuOpen, setMenuOpen] = useState(false);",
    "const [menuOpen, setMenuOpen] = useState(true);",
  );

let react;
let server;
const loaded = [];
before(async () => {
  react = await import("react");
  server = await import("react-dom/server");
});
after(() => {
  for (const cleanup of loaded) cleanup();
});

async function runStart({ field = (s) => s, start = (s) => s } = {}) {
  const { modules, cleanup } = await loadModules([RUN_START], {
    stubs: STUBS,
    mutate: (file, source) =>
      file === RUN_START
        ? start(NO_ROUTER(source))
        : file === FILE_FIELD
          ? field(source)
          : source,
  });
  loaded.push(cleanup);
  return modules[RUN_START].RunStart;
}

async function fileField(field = (s) => s) {
  const { modules, cleanup } = await loadModules([FILE_FIELD], {
    stubs: STUBS,
    mutate: (file, source) => (file === FILE_FIELD ? field(source) : source),
  });
  loaded.push(cleanup);
  return modules[FILE_FIELD].RunFileField;
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const nodes = (markup) => elements(parse(markup));
const byTestId = (markup, id) =>
  nodes(markup).filter((node) => node.attrs["data-testid"] === id);
const classes = (node) => (node.attrs.class ?? "").split(/\s+/u);
const textOf = (node) =>
  node.text ?? (node.children ?? []).map(textOf).join("");
const buttons = (markup) => nodes(markup).filter((n) => n.tag === "button");
const submitOf = (markup) =>
  buttons(markup).find((node) => node.attrs.type === "submit");
const visibleOf = (node) =>
  visibleWords(server.renderToStaticMarkup(rebuild(node))).join(" ");
/** A parsed node as React elements again, for its visible words. */
function rebuild(node) {
  if (node.text !== undefined) return node.text;
  const props = { ...node.attrs };
  if (props.class !== undefined) {
    props.className = props.class;
    delete props.class;
  }
  return react.createElement(node.tag, props, ...node.children.map(rebuild));
}

const RESUME = {
  key: "resume",
  title: "Resume",
  control: "artifact",
  required: true,
};
const props = (extra) => ({
  workspaceId: "w",
  subscriptionId: "s",
  runInput: [RESUME],
  live: true,
  available: true,
  canGoLive: true,
  initialKey: "k",
  ...extra,
});
const fieldProps = (extra) => ({
  workspaceId: "w",
  subscriptionId: "s",
  onBusyChange: () => {},
  field: RESUME,
  ...extra,
});

test("17 (D8): the words — Take photo, Choose file, Add {title} first., Remove {name}; Add up to {max} as today", () => {
  assert.equal(TAKE_PHOTO_LABEL, "Take photo");
  assert.equal(CHOOSE_FILE_LABEL, "Choose file");
  assert.equal(addFileFirst("Resume"), "Add Resume first.");
  assert.equal(removeFileLabel("cv.pdf"), "Remove cv.pdf");
  assert.equal(
    tooManyFiles(DEFAULT_MAX_FILES),
    "Add up to 50 files at a time.",
  );
});

test("17 T1/T5 (D4): missingFile — the first required file field holding no file, in run-input order; an optional one, or another control, never", () => {
  const note = { key: "note", title: "Note", control: "text", required: true };
  const cover = {
    key: "cover",
    title: "Cover letter",
    control: "artifact",
    required: true,
  };
  const optional = { ...RESUME, key: "scan", title: "Scan", required: false };
  const none = () => false;
  assert.equal(missingFile([RESUME], none), RESUME);
  assert.equal(missingFile([note, cover, RESUME], none), cover);
  assert.equal(
    missingFile([cover, RESUME], (key) => key === "cover"),
    RESUME,
  );
  assert.equal(
    missingFile([RESUME], () => true),
    undefined,
  );
  // T5: an optional file field left empty starts; a required text is not this check's.
  assert.equal(missingFile([optional, note], none), undefined);
  assert.equal(missingFile([], none), undefined);
});

test("17 T3/T4 (D6): the x takes that one file out, the rest kept in their order", () => {
  const files = ["a.pdf", "b.pdf", "c.pdf"];
  assert.deepEqual(withoutFile(files, 1), ["a.pdf", "c.pdf"]);
  assert.deepEqual(withoutFile(files, 0), ["b.pdf", "c.pdf"]);
  assert.deepEqual(withoutFile(["a.pdf"], 0), []);
  assert.deepEqual(
    files,
    ["a.pdf", "b.pdf", "c.pdf"],
    "never changed in place",
  );
});

test("17 T1 (D4): Start checks for a required file first — said in the form's one error line, nothing sent, Start never disabled for it", async () => {
  const start = read(RUN_START);
  const submit = /const submit = [\s\S]*?\n {2}\};/u.exec(start)?.[0] ?? "";
  assert.ok(submit, "submit is found");
  const check = submit.indexOf("missingFile(runInput");
  assert.ok(check > submit.indexOf("if (!canRun || uploading) return;"));
  assert.ok(
    check < submit.indexOf("startTransition("),
    "before anything is sent",
  );
  assert.match(
    submit,
    /setMissing\(absent \? addFileFirst\(absent\.title\) : null\);\s*if \(absent\) return;/u,
  );
  // Only the field's uploaded ids count: its hidden `input:<key>` values.
  assert.match(
    submit,
    /data\.getAll\(`input:\$\{key\}`\)\.some\(\(value\) => value !== ""\)/u,
  );
  // The line goes once an upload starts.
  assert.match(start, /if \(busy\) setMissing\(null\);/u);
  // Drawn in the error line's place.
  const RunStart = await runStart({
    start: (source) =>
      source.replace(
        "const [missing, setMissing] = useState<string | null>(null);",
        'const [missing, setMissing] = useState<string | null>("Add Resume first.");',
      ),
  });
  const markup = draw(RunStart, props({ compact: true }));
  const alerts = nodes(markup).filter((node) => node.attrs.role === "alert");
  assert.deepEqual(alerts.map(textOf), ["Add Resume first."]);
  assert.ok(!("disabled" in submitOf(markup).attrs), "Start stays pressable");
});

test("17 T8 (D3): Start is filled on Home's card, the outline on a flow's page and an item's page; Turn on unchanged", async () => {
  const RunStart = await runStart();
  assert.ok(
    classes(submitOf(draw(RunStart, props({ compact: true })))).includes(
      "btn-filled",
    ),
  );
  // A Home card of two fields keeps its layout; its Start is filled too.
  const two = draw(
    RunStart,
    props({
      compact: true,
      runInput: [
        RESUME,
        { key: "n", title: "Note", control: "text", required: false },
      ],
    }),
  );
  assert.ok(classes(submitOf(two)).includes("btn-filled"));
  for (const page of [props(), props({ itemPage: true, itemId: "i" })]) {
    const start = classes(submitOf(draw(RunStart, page)));
    assert.ok(start.includes("btn-primary"));
    assert.ok(!start.includes("btn-filled"));
  }
  const off = buttons(draw(RunStart, props({ live: false })));
  assert.ok(
    off.some(
      (node) =>
        textOf(node) === "Turn on" && classes(node).includes("btn-primary"),
    ),
  );
});

test("17 (D3): .btn-filled — the primary's size, the accent fill, the page's colour semibold, accent-400 on hover and press, in the disabled and reduced-motion lists; its label readable on both themes", () => {
  const css = read("app/globals.css");
  assert.match(
    css,
    /\.btn-primary,\n\.btn-filled,\n\.btn-secondary \{\n {2}display: inline-flex;/u,
  );
  const rule = /\n\.btn-filled \{([^}]*)\}/u.exec(css)?.[1] ?? "";
  assert.match(rule, /border: 1px solid var\(--color-accent\);/u);
  assert.match(rule, /background: var\(--color-accent\);/u);
  assert.match(rule, /color: var\(--color-bg\);/u);
  assert.match(rule, /font-weight: 600;/u);
  assert.match(
    css,
    /\.btn-filled:hover,\n\.btn-filled:active \{\s*border-color: var\(--color-accent-400\);\s*background: var\(--color-accent-400\);/u,
  );
  assert.match(css, /\.btn-filled:disabled,/u);
  assert.match(
    css,
    /\.interactive-card,\n {2}\.btn-primary,\n {2}\.btn-filled,/u,
  );
  const values = (name) =>
    [...css.matchAll(new RegExp(`${name}: (#[0-9a-f]{6});`, "gu"))].map(
      (match) => match[1],
    );
  const [bgDark, bgLight] = values("--color-bg");
  const [accentDark, accentLight] = values("--color-accent");
  const [strongDark, strongLight] = values("--color-accent-400");
  for (const [label, on] of [
    [bgDark, accentDark],
    [bgDark, strongDark],
    [bgLight, accentLight],
    [bgLight, strongLight],
  ])
    assert.ok(
      contrast(label, on) >= 4.5,
      `${label} on ${on}: ${contrast(label, on)}`,
    );
  assert.equal(contrast(bgDark, accentDark).toFixed(2), "5.45");
  assert.equal(contrast(bgLight, accentLight).toFixed(2), "4.90");
  assert.match(read("components/ui/Button.tsx"), /filled: "btn-filled",/u);
});

function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((at) => {
      const c = parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("17 T7 (D1, D2): Home's card on a phone — exactly Upload then Start; Upload a closed disclosure; open, Take photo then Choose file, each named by its words alone", async () => {
  const RunStart = await runStart({ field: PHONE });
  const markup = draw(RunStart, props({ compact: true }));
  const row = nodes(markup).find((node) =>
    (node.children ?? []).some((child) => child.attrs?.type === "submit"),
  );
  const rowButtons = elements(row).filter((node) => node.tag === "button");
  assert.deepEqual(rowButtons.map(visibleOf), ["Upload", "Start"]);
  const upload = rowButtons[0];
  assert.equal(upload.attrs["aria-expanded"], "false");
  assert.equal(upload.attrs["aria-controls"], undefined);
  assert.equal(
    byTestId(markup, "run-file-resume-menu").length,
    0,
    "closed: not drawn",
  );
  // The camera's input is there, for Take photo to open.
  assert.ok(nodes(markup).some((node) => node.attrs.capture === "environment"));

  const opened = await runStart({ field: (s) => OPEN_MENU(PHONE(s)) });
  const open = draw(opened, props({ compact: true }));
  const [menu] = byTestId(open, "run-file-resume-menu");
  assert.ok(menu, "open: drawn");
  assert.ok(classes(menu).includes("bubble-soft"));
  const openUpload = buttons(open).find((node) => node.attrs["aria-expanded"]);
  assert.equal(openUpload.attrs["aria-expanded"], "true");
  assert.equal(openUpload.attrs["aria-controls"], menu.attrs.id);
  const rows = elements(menu).filter((node) => node.tag === "button");
  assert.deepEqual(rows.map(visibleOf), ["Take photo", "Choose file"]);
  // D2: each row's icon, Camera then FileArrowUp, as phosphor draws them.
  const icon = (row) =>
    elements(row)
      .filter((node) => node.tag === "path")
      .map((node) => node.attrs.d);
  const drawn = (Icon) =>
    elements(
      parse(
        server.renderToStaticMarkup(
          react.createElement(Icon, { size: 20, "aria-hidden": true }),
        ),
      ),
    )
      .filter((node) => node.tag === "path")
      .map((node) => node.attrs.d);
  const { CameraIcon } = await import("@phosphor-icons/react/dist/ssr/Camera");
  const { FileArrowUpIcon } =
    await import("@phosphor-icons/react/dist/ssr/FileArrowUp");
  assert.deepEqual(rows.map(icon), [drawn(CameraIcon), drawn(FileArrowUpIcon)]);
  // Named by their words alone, as the app's menu rows are (the parity
  // check, 2026-11-13): no hidden " for {title}" on a row.
  assert.deepEqual(rows.map(textOf), ["Take photo", "Choose file"]);
  const source = read(FILE_FIELD);
  assert.match(source, /onClick=\{\(\) => pick\(camera\)\}/u);
  assert.match(source, /onClick=\{\(\) => pick\(input\)\}/u);
});

test("17 T7/T9 (D2): off a phone Upload opens the picker at once, no menu; a flow's page on a phone keeps Take photo and Upload side by side", async () => {
  const computer = await runStart();
  const home = draw(computer, props({ compact: true }));
  const upload = buttons(home).find((node) => visibleOf(node) === "Upload");
  assert.equal(upload.attrs["aria-expanded"], undefined);
  const phone = await runStart({ field: PHONE });
  const page = draw(phone, props());
  const row = nodes(page).find(
    (node) =>
      (node.children ?? []).filter((child) => child.tag === "button").length ===
      2,
  );
  assert.deepEqual(
    row.children.filter((child) => child.tag === "button").map(visibleOf),
    ["Take photo", "Upload"],
  );
  assert.ok(
    buttons(page).every((node) => node.attrs["aria-expanded"] === undefined),
  );
  // The flow page's title line stays.
  assert.ok(visibleWords(page).includes("Resume"));
});

test("17 T7 (D2): on a phone, Home's field that takes no photo (PDF only) — Upload opens the picker at once, no menu, no camera; the row exactly Upload then Start", async () => {
  const RunStart = await runStart({ field: PHONE });
  const markup = draw(
    RunStart,
    props({
      compact: true,
      runInput: [{ ...RESUME, acceptedContentTypes: ["application/pdf"] }],
    }),
  );
  const row = nodes(markup).find((node) =>
    (node.children ?? []).some((child) => child.attrs?.type === "submit"),
  );
  const rowButtons = elements(row).filter((node) => node.tag === "button");
  assert.deepEqual(rowButtons.map(visibleOf), ["Upload", "Start"]);
  assert.equal(rowButtons[0].attrs["aria-expanded"], undefined);
  assert.ok(
    !nodes(markup).some((node) => node.attrs.capture === "environment"),
  );
});

test("17 (D5): on Home's card the lines sit under the buttons' row, not in it — Uploading {name}…, the pills, the field's error, then the form's error", async () => {
  const RunStart = await runStart({
    field: (source) =>
      HOLDING({
        kind: "ready",
        artifactId: "a",
        name: "cv.pdf",
        sizeBytes: 2048,
      })(source).replace(
        "const [error, setError] = useState<string | null>(null);",
        'const [error, setError] = useState<string | null>("Field error.");',
      ),
    start: (source) =>
      source.replace(
        "const [missing, setMissing] = useState<string | null>(null);",
        'const [missing, setMissing] = useState<string | null>("Form error.");',
      ),
  });
  const markup = draw(RunStart, props({ compact: true }));
  const all = nodes(markup);
  const row = all.find((node) =>
    (node.children ?? []).some((child) => child.attrs?.type === "submit"),
  );
  const [pills] = byTestId(markup, "run-file-resume-pills");
  assert.ok(pills, "the pills drawn");
  assert.ok(!elements(row).includes(pills), "the pills are not in the row");
  // The row's siblings after it, in order.
  const field = all.find((node) => (node.children ?? []).includes(row));
  const after = field.children
    .slice(field.children.indexOf(row) + 1)
    .filter((node) => node.tag);
  assert.deepEqual(
    after.map((node) => [
      node.tag,
      node.attrs["aria-live"] ?? node.attrs.role ?? node.attrs["data-testid"],
    ]),
    [
      ["p", "polite"],
      ["ul", "run-file-resume-pills"],
      ["p", "alert"],
    ],
  );
  assert.equal(textOf(after[2]), "Field error.");
  // The form's error line comes after the whole field.
  const alerts = all.filter((node) => node.attrs.role === "alert");
  assert.deepEqual(alerts.map(textOf), ["Field error.", "Form error."]);
  assert.ok(!elements(field).includes(alerts[1]));
});

test("17 T5/T10 (D5): a start form's file is a pill — its name cut at its end, an x named Remove {name} with a 44 target — and the hidden id follows; no Ready line", async () => {
  const RunStart = await runStart({
    field: HOLDING({
      kind: "ready",
      artifactId: "a",
      name: "cv.pdf",
      sizeBytes: 2048,
    }),
  });
  for (const markup of [
    draw(RunStart, props({ compact: true })),
    draw(RunStart, props()),
    draw(RunStart, props({ itemPage: true, itemId: "i" })),
  ]) {
    const [pills] = byTestId(markup, "run-file-resume-pills");
    assert.ok(pills, "the pills' row");
    assert.equal(pills.tag, "ul");
    // D5: the space between pills is the spacing table's inner gap.
    for (const name of ["flex", "overflow-x-auto", SPACING.inner.gap])
      assert.ok(classes(pills).includes(name), name);
    assert.ok(!classes(pills).includes("flex-wrap"), "one row, never wrapped");
    const items = elements(pills).filter((node) => node.tag === "li");
    assert.equal(items.length, 1);
    const [pill] = items;
    // D5: a 1-px outline (`border`) in the ring's colour.
    for (const name of [
      "rounded-full",
      "border",
      "border-[var(--ring)]",
      "min-h-11",
      "max-w-full",
      "pl-4",
    ])
      assert.ok(classes(pill).includes(name), name);
    const label = elements(pill).find((node) => node.tag === "span");
    assert.equal(textOf(label), "cv.pdf");
    // D5: the name in the text colour.
    for (const name of ["truncate", "min-w-0", "text-sm", "text-[var(--text)]"])
      assert.ok(classes(label).includes(name), name);
    const x = elements(pill).find((node) => node.tag === "button");
    assert.equal(x.attrs.type, "button");
    assert.equal(x.attrs["aria-label"], "Remove cv.pdf");
    // D5: the x's icon at 20 in the text colour.
    for (const name of [
      "min-h-11",
      "min-w-11",
      "text-[var(--text)]",
      "hover:bg-[var(--surface-hover)]",
    ])
      assert.ok(classes(x).includes(name), name);
    const [svg] = elements(x).filter((node) => node.tag === "svg");
    assert.equal(svg.attrs.width, "20");
    assert.equal(svg.attrs.height, "20");
    assert.ok(!/Ready:/u.test(markup), "no Ready line in a start form");
    assert.deepEqual(
      nodes(markup)
        .filter((node) => node.attrs.name === "input:resume")
        .map((node) => node.attrs.value),
      ["a"],
    );
  }
  // The x: the file out, the chooser emptied, the form told (a new key).
  const source = read(FILE_FIELD);
  assert.match(source, /onClick=\{\(\) => remove\(at\)\}/u);
  const remove = /const remove = [\s\S]*?\n {2}\};/u.exec(source)?.[0] ?? "";
  assert.match(remove, /withoutFile\(files, at\)/u);
  assert.match(remove, /input\.current\.value = ""/u);
  assert.match(remove, /onFilesChange\?\.\(field\.key\)/u);
  assert.match(read(RUN_START), /removable\s+onFilesChange=\{newRunKey\}/u);
});

test("17 T4 (D5): several files — one pill per file, in order, each its own x and hidden id", async () => {
  const files = ["a.pdf", "b.pdf", "c.pdf"].map((name, at) => ({
    artifactId: `id-${at}`,
    name,
    sizeBytes: 10,
  }));
  const RunStart = await runStart({
    field: HOLDING({ kind: "several", files }),
  });
  const markup = draw(
    RunStart,
    props({ compact: true, runInput: [{ ...RESUME, multiple: true }] }),
  );
  const [pills] = byTestId(markup, "run-file-resume-pills");
  const xs = elements(pills).filter((node) => node.tag === "button");
  assert.deepEqual(
    xs.map((node) => node.attrs["aria-label"]),
    ["Remove a.pdf", "Remove b.pdf", "Remove c.pdf"],
  );
  assert.ok(!/files selected/u.test(markup));
  assert.deepEqual(
    nodes(markup)
      .filter((node) => node.attrs.name === "input:resume")
      .map((node) => node.attrs.value),
    ["id-0", "id-1", "id-2"],
  );
});

test("17 T6 (D5): while a file uploads no pill shows and the line says Uploading {name}…, Start waits", async () => {
  const RunStart = await runStart({
    field: HOLDING({ kind: "uploading", name: "cv.pdf" }),
    start: (source) =>
      source.replace("() => new Set(),", '() => new Set(["resume"]),'),
  });
  const markup = draw(RunStart, props({ compact: true }));
  assert.equal(byTestId(markup, "run-file-resume-pills").length, 0);
  assert.ok(visibleWords(markup).includes("Uploading cv.pdf…"));
  assert.ok("disabled" in submitOf(markup).attrs);
});

test("17 T11 (D5): the job upload card's field (no removable) keeps its Ready line, no pill and no x", async () => {
  const RunFileField = await fileField(
    HOLDING({
      kind: "ready",
      artifactId: "a",
      name: "jd.pdf",
      sizeBytes: 2048,
    }),
  );
  const markup = draw(RunFileField, fieldProps());
  assert.ok(visibleWords(markup).includes("Ready: jd.pdf (2 KB)"));
  assert.equal(byTestId(markup, "run-file-resume-pills").length, 0);
  assert.ok(
    !buttons(markup).some((node) =>
      node.attrs["aria-label"]?.startsWith("Remove"),
    ),
  );
  // UploadItemCard passes no removable.
  const card = read("app/account/flows/UploadItemCard.tsx");
  assert.doesNotMatch(card, /removable/u);
});
