import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

/**
 * No document names a file that does not exist (backend Gate 22). The audit is
 * run for real, on this repository and on planted ones, so what it finds is
 * observed rather than read from its source. It never reads a real sibling
 * repository here: another repository's files are that repository's facts, and
 * the audit reports them as not checked. A planted sibling is how the opt-in
 * sibling read is tested.
 */

const root = resolve(import.meta.dirname, "..");
const script = join(root, "scripts/audit-doc-references.mjs");

// The run's environment is the test's own: a sibling read the shell opted into,
// or a platform checkout it points at, never reaches a planted audit.
function audit(repository, flags = [], environment = {}) {
  const env = { ...process.env };
  delete env.AUDIT_DOC_SIBLINGS;
  delete env.SNOOPY_BACKEND_ROOT;
  const run = spawnSync(process.execPath, [script, ...flags, repository], {
    encoding: "utf8",
    env: { ...env, ...environment },
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

// A commit here is a fixture's: no author from the machine, and never signed
// with its key, which a clean checkout does not have.
const FIXTURE = [
  "-c",
  "user.name=audit",
  "-c",
  "user.email=audit@example.invalid",
  "-c",
  "commit.gpgsign=false",
];
const git = (directory, ...args) =>
  execFileSync("git", [...FIXTURE, ...args], { cwd: directory });

/** A repository of `files`, committed once `history` has added and removed its paths. */
function plant(directory, files, history = {}) {
  const write = (path, content) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  mkdirSync(directory, { recursive: true });
  git(directory, "init", "-q");
  if (Object.keys(history).length > 0) {
    for (const [path, content] of Object.entries(history)) write(path, content);
    git(directory, "add", ".");
    git(directory, "commit", "-q", "-m", "files that are later removed");
    git(directory, "rm", "-q", "-r", ...Object.keys(history));
  }
  for (const [path, content] of Object.entries(files)) write(path, content);
  git(directory, "add", ".");
}

/** `body` given a folder of its own, removed after. */
function planted(body) {
  const folder = mkdtempSync(join(tmpdir(), "doc-references-"));
  try {
    body(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

const lines = (output, status) =>
  output.split("\n").filter((line) => line.startsWith(`${status}\t`));
const code = "export {};\n";

test("no document in this repository names a file that does not exist", () => {
  const { status, output } = audit(root);
  assert.equal(status, 0, output);
  assert.match(output, /missing 0$/mu);
});

test("a missing file is listed with its document and line; a struck one is a record of its removal; a build output is not checked", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(
      repository,
      {
        "lib/present.ts": code,
        ".gitignore": ".next/\n",
        // On disk, as after a build, and ignored: CI's clean checkout has no such
        // file, so finding it here would pass a document that fails there.
        ".next/trace.json": "{}\n",
        "docs/guide.md": [
          "Reads `lib/present.ts:12` and links [it](../lib/present.ts).",
          "Names `lib/gone.ts`, which is not there.",
          "Removed: ~~`lib/removed.ts`~~.",
          "The phone app's `snoopy-mobile/app/index.tsx` is not checked here.",
          "The platform's `snoopy-backend/docs/openapi.yaml` and `../snoopy-backend/docs/absent.yaml`.",
          "A build writes `.next/trace.json`, and would write `.next/absent.json`.",
          "",
        ].join("\n"),
      },
      { "lib/removed.ts": code },
    );
    // The platform's checkout beside this one, as on the owner's machine: it is
    // still another repository's, so it is not read.
    plant(join(folder, "snoopy-backend"), {
      "docs/openapi.yaml": "openapi: 3.1.0\n",
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:2\tlib/gone.ts",
    ]);
    assert.deepEqual(
      output.split("\n").filter((line) => line.includes("\t.next/")),
      [
        "not checked\tdocs/guide.md:6\t.next/trace.json",
        "not checked\tdocs/guide.md:6\t.next/absent.json",
      ],
      "a path git ignores is a build output, whether or not this checkout has built it",
    );
    assert.match(
      output,
      /found 2, struck 1, not checked 5, missing 1$/mu,
      "the present file (twice), the struck file, the phone app's, the platform's two and the two build outputs",
    );
  });
});

test("a strike is believed only for a file a commit once added: one never added is missing, one still here is found", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(
      repository,
      {
        "lib/present.ts": code,
        "docs/guide.md": [
          // Line 1: once added, since removed — a record of its removal.
          "Removed: ~~`lib/removed.ts`~~.",
          // Line 2: no commit ever added it, so the strike hides a name, not a removal.
          "Planned, and struck as if withdrawn: ~~`lib/planned.ts`~~.",
          // Line 3: still here, so it is found, whatever the strike says.
          "Struck but present: ~~`lib/present.ts`~~.",
          "",
        ].join("\n"),
      },
      { "lib/removed.ts": code },
    );

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:2\tlib/planned.ts",
    ]);
    assert.deepEqual(lines(output, "struck"), [
      "struck\tdocs/guide.md:1\tlib/removed.ts",
    ]);
    assert.deepEqual(lines(output, "found"), [
      "found\tdocs/guide.md:3\tlib/present.ts",
    ]);
  });
});

test("a shallow clone cannot show a file's history, so a strike there is not checked, never believed", () => {
  planted((folder) => {
    const origin = join(folder, "origin");
    plant(
      origin,
      {
        "docs/guide.md":
          "Removed: ~~`lib/removed.ts`~~. Never here: ~~`lib/planned.ts`~~.\n",
      },
      { "lib/removed.ts": code },
    );
    git(origin, "commit", "-q", "-m", "the guide");
    // One commit deep, as `actions/checkout` clones by default.
    const clone = join(folder, "web");
    git(
      folder,
      "clone",
      "-q",
      "--depth",
      "1",
      pathToFileURL(origin).href,
      clone,
    );

    const { status, output } = audit(clone, ["--all"]);
    assert.equal(status, 0, output);
    assert.match(output, /found 0, struck 0, not checked 2, missing 0$/mu);
  });
});

test("a strike reaches across the wrapped lines of one paragraph, never into the next list item or table cell", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(
      repository,
      {
        "docs/guide.md": [
          // Lines 1–2: one strike wrapped over two lines covers the removed file.
          "A clause struck across a line break ~~names the file",
          "`lib/old.ts` it removed~~ and goes on.",
          "",
          // Lines 4–5: one strike ends and the next begins on line 5, and the
          // path between them is live text.
          "This clause is ~~struck at its end,",
          "and ends~~ here — see `lib/missing.ts` ~~next struck clause~~.",
          "",
          // Lines 7–8: an unclosed `~~` in one list item never pairs with the next.
          "- the first item opens ~~ and never closes it",
          "- the second names `lib/absent.ts` ~~and closes~~",
          "",
          // Lines 10–12: a strike never crosses a table cell.
          "| Was | Now |",
          "| --- | --- |",
          "| ~~gone | `lib/lost.ts` | still~~ |",
          "",
        ].join("\n"),
      },
      // Every path above was once added, so a strike that wrongly reached one
      // would read `struck`, not `missing`: the lists tell the two apart.
      {
        "lib/old.ts": code,
        "lib/missing.ts": code,
        "lib/absent.ts": code,
        "lib/lost.ts": code,
      },
    );

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:5\tlib/missing.ts",
      "missing\tdocs/guide.md:8\tlib/absent.ts",
      "missing\tdocs/guide.md:12\tlib/lost.ts",
    ]);
    assert.deepEqual(lines(output, "struck"), [
      "struck\tdocs/guide.md:2\tlib/old.ts",
    ]);
  });
});

test("a relative link is found only where it lands: from its document's folder, or from the root after a `/`, as GitHub resolves it", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      "README.md": "# Root\n",
      "lib/present.ts": code,
      "docs/beside.md": "Beside the guide.\n",
      "docs/guide.md": [
        "Beside it: [found](beside.md) and [missing](absent.md#part).",
        "From the root, by mistake: [r](README.md) and [l](lib/present.ts); after a `/`, [s](/README.md).",
        "Up and over: [u](../lib/present.ts). A code span is read from either: `lib/present.ts`.",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:1\tabsent.md",
      "missing\tdocs/guide.md:2\tREADME.md",
      "missing\tdocs/guide.md:2\tlib/present.ts",
    ]);
    assert.match(output, /found 4, struck 0, not checked 0, missing 3$/mu);
  });
});

test("another repository's file is not checked, even with its checkout beside this one, unless the run opts in: then it is read as git sees it there", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    const platform = join(folder, "snoopy-backend");
    plant(repository, {
      "docs/guide.md": [
        "Kept: `snoopy-backend/docs/openapi.yaml`. Absent: `../snoopy-backend/docs/absent.yaml`.",
        "Built: `snoopy-backend/out/page.js`. Deleted: `snoopy-backend/docs/deleted.yaml`.",
        "Removed: ~~`snoopy-backend/docs/removed.yaml`~~. Linked: [c](../../snoopy-backend/docs/openapi.yaml).",
        "The phone app's `snoopy-mobile/app/index.tsx` has no checkout here.",
        "",
      ].join("\n"),
    });
    plant(
      platform,
      {
        ".gitignore": "out/\n",
        "docs/openapi.yaml": "openapi: 3.1.0\n",
        "docs/deleted.yaml": "{}\n",
        // On disk after a build, as `.next/` is: a clean checkout has no such file.
        "out/page.js": "\n",
      },
      { "docs/removed.yaml": "{}\n" },
    );
    // Deleted on disk and not yet staged: a commit of that tree has no such file.
    rmSync(join(platform, "docs/deleted.yaml"));

    const unread = audit(repository, ["--all"]);
    assert.equal(unread.status, 0, unread.output);
    assert.match(
      unread.output,
      /found 0, struck 0, not checked 7, missing 0$/mu,
    );

    const read = audit(repository, ["--all"], { AUDIT_DOC_SIBLINGS: "1" });
    assert.equal(read.status, 1, read.output);
    assert.deepEqual(lines(read.output, "missing"), [
      "missing\tdocs/guide.md:1\t../snoopy-backend/docs/absent.yaml",
      "missing\tdocs/guide.md:2\tsnoopy-backend/docs/deleted.yaml",
    ]);
    assert.match(read.output, /found 2, struck 1, not checked 2, missing 2$/mu);

    // SNOOPY_BACKEND_ROOT names the platform's checkout for every reader here:
    // pointed at a folder that is none, nothing is read.
    const elsewhere = audit(repository, ["--all"], {
      AUDIT_DOC_SIBLINGS: "1",
      SNOOPY_BACKEND_ROOT: join(folder, "nowhere"),
    });
    assert.equal(elsewhere.status, 0, elsewhere.output);
    assert.match(
      elsewhere.output,
      /found 0, struck 0, not checked 7, missing 0$/mu,
    );
  });
});

test("link syntax inside a code span is text; an escaped backtick opens no code span", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      "docs/guide.md": [
        "Shown, not linked: `[x](../lib/nowhere.ts)` and ``[y](../lib/nor-here.ts) `with` ticks``.",
        // An escaped backtick opens no code span, so the link after it is read.
        "Escaped \\` tick, then [z](../lib/escaped-gone.ts), then `code`.",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:2\t../lib/escaped-gone.ts",
    ]);
    assert.match(output, /found 0, struck 0, not checked 0, missing 1$/mu);
  });
});

test("a titled link, an angled link and a reference-style definition are read", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      "lib/present.ts": code,
      "docs/guide.md": [
        "Titled: [q](../lib/gone-q.ts \"a title\"), [a](../lib/gone-a.ts 'one') and [b](../lib/gone-b.ts (two)).",
        "Angled: [t](<../lib/present.ts>) and [v](<../lib/gone angled.ts>).",
        "",
        "[gone]: ../lib/gone-defined.ts",
        "[here]: ../lib/present.ts",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:1\t../lib/gone-q.ts",
      "missing\tdocs/guide.md:1\t../lib/gone-a.ts",
      "missing\tdocs/guide.md:1\t../lib/gone-b.ts",
      "missing\tdocs/guide.md:2\t../lib/gone angled.ts",
      "missing\tdocs/guide.md:4\t../lib/gone-defined.ts",
    ]);
    assert.match(output, /found 2, struck 0, not checked 0, missing 5$/mu);
  });
});

test("a definition may put its path on the next line or sit in a quote; a footnote is no definition", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      "docs/guide.md": [
        "[plan]:",
        "  ../lib/gone-plan.ts",
        "",
        "> [quoted]: ../lib/quoted-gone.ts",
        "",
        "[^1]: ../lib/footnote.ts is a footnote, not a link.",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:2\t../lib/gone-plan.ts",
      "missing\tdocs/guide.md:4\t../lib/quoted-gone.ts",
    ]);
    assert.match(output, /found 0, struck 0, not checked 0, missing 2$/mu);
  });
});

test("a Markdown example in a fenced block is text: its links and definitions are not read, its backticked paths are", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      "docs/guide.md": [
        "```md",
        "[x](../lib/fenced-gone.ts)",
        "[d]: ../lib/fenced-def.ts",
        "A fenced path is still a path: `lib/fenced-missing.ts`.",
        "```",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:4\tlib/fenced-missing.ts",
    ]);
    assert.match(output, /found 0, struck 0, not checked 0, missing 1$/mu);
  });
});

test("a URL is no file, `//host` included, but a file's name before a colon is a file link written with a line, read and missing", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      Dockerfile: "FROM node:22\n",
      "lib/present.ts": code,
      "docs/guide.md": [
        "Protocol-relative: [cdn](//cdn.example.invalid/x/app.js). Mail: [m](mailto:a@example.invalid).",
        "A link carries no line: [l](../lib/present.ts:10), [c](../Dockerfile:L12), [d](Dockerfile:L3), [a](app.ts:10).",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:2\t../lib/present.ts:10",
      "missing\tdocs/guide.md:2\t../Dockerfile:L12",
      "missing\tdocs/guide.md:2\tDockerfile:L3",
      "missing\tdocs/guide.md:2\tapp.ts:10",
    ]);
    assert.match(output, /found 0, struck 0, not checked 0, missing 4$/mu);
  });
});

test("every other shape of reference the platform's copy reads is read here", () => {
  planted((folder) => {
    const repository = join(folder, "web");
    plant(repository, {
      "README.md": "# Root\n",
      "lib/present.ts": code,
      "docs/beside.md": "Beside the guide.\n",
      "docs/with space.md": "Under `Business Infra/`.\n",
      "app/(marketing)/page.tsx": code,
      "app/[...slug]/page.tsx": code,
      "docs/guide.md": [
        // Line 1: a list of lines is a line.
        "Lines `lib/present.ts:1,3` and `lib/gone.ts:4-5,9`.",
        // Line 2: a query is not part of the name; a link percent-encodes a space.
        "A query: [p](beside.md?plain=1). A space: [w](with%20space.md).",
        // Line 3: a route group's parentheses; a catch-all segment is a name, not an elision.
        "Groups: [g](../app/(marketing)/page.tsx) and [h](../app/(gone)/page.tsx); catch-all: `app/[...slug]/page.tsx`.",
        // Line 4: a container's or a home path, and an elided folder, name no file here.
        "A container's `/usr/src/app/server.js`, a home `~/.config/gcloud/credentials.json`, an elided `app/…/page.tsx` or `app/.../page.tsx`.",
        // Line 5: an installed package and a deploy's output are no repository's.
        "An installed `@supabase/ssr/dist/index.js` and a deploy's `.vercel/output/config.json`.",
        // Line 6: back in by the folder's name or the repository's own; out of every checkout.
        "Back in: [f](../../web/README.md) and [n](../../snoopy/README.md); out of all: [o](../../../outside.md).",
        "",
      ].join("\n"),
    });

    const { status, output } = audit(repository, ["--all"]);
    assert.equal(status, 1, output);
    assert.deepEqual(lines(output, "missing"), [
      "missing\tdocs/guide.md:1\tlib/gone.ts",
      "missing\tdocs/guide.md:3\t../app/(gone)/page.tsx",
      "missing\tdocs/guide.md:6\t../../../outside.md",
    ]);
    assert.deepEqual(lines(output, "not checked"), [
      "not checked\tdocs/guide.md:5\t@supabase/ssr/dist/index.js",
      "not checked\tdocs/guide.md:5\t.vercel/output/config.json",
    ]);
    assert.match(output, /found 7, struck 0, not checked 2, missing 3$/mu);
  });
});

test("the audit runs from a path with a space, and reads the documents and the files git sees", () => {
  const planted = mkdtempSync(join(tmpdir(), "doc-references-"));
  try {
    // The owner's checkouts live under `Business Infra/`: a URL of the script's
    // path percent-encodes the space, and the audit once never ran there.
    const copy = join(planted, "with space", "audit-doc-references.mjs");
    mkdirSync(dirname(copy), { recursive: true });
    copyFileSync(script, copy);
    const repository = join(planted, "web");
    const plant = (path, content) => {
      mkdirSync(dirname(join(repository, path)), { recursive: true });
      writeFileSync(join(repository, path), content);
    };
    plant("lib/present.ts", "export {};\n");
    plant("lib/deleted.ts", "export {};\n");
    plant("docs/guide.md", "Reads `lib/present.ts` and `lib/deleted.ts`.\n");
    execFileSync("git", ["init", "-q"], { cwd: repository });
    execFileSync("git", ["add", "."], { cwd: repository });
    // Deleted on disk and not yet staged: a commit of this tree has no such file.
    rmSync(join(repository, "lib/deleted.ts"));
    // Not yet added: a commit of this tree has it, so it is read.
    plant("docs/new.md", "Names `lib/nowhere.ts`.\n");

    const run = spawnSync(process.execPath, [copy, repository], {
      encoding: "utf8",
    });
    const output = `${run.stdout}${run.stderr}`;
    assert.equal(run.status, 1, output);
    assert.deepEqual(
      output.split("\n").filter((line) => line.startsWith("missing\t")),
      [
        "missing\tdocs/guide.md:1\tlib/deleted.ts",
        "missing\tdocs/new.md:1\tlib/nowhere.ts",
      ],
    );
    assert.match(output, /found 1, struck 0, not checked 0, missing 2$/mu);
  } finally {
    rmSync(planted, { recursive: true, force: true });
  }
});
