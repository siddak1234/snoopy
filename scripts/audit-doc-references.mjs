// Every file path this repository's documents name, and whether it exists
// (backend Gate 22: no document names a file that does not exist). Lists each
// reference it could not find and exits 1 if there is one.
//
// A reference is a backticked path with a directory and an extension
// (`lib/tenancy.ts`, `lib/tenancy.ts:42`) or a relative Markdown link. It is
// looked for from the repository root and from the document's own folder. A
// path in the platform repository is looked for in its checkout beside this
// one, as the contract tests read it; with no checkout it is reported as not
// checked, never as found. A file that was removed stays namable in a record of
// its removal, struck through: ~~`lib/auth.ts`~~ says it is gone.
//
// A path here is found in what git sees — tracked files, and untracked ones it
// does not ignore, the facts file's basis — never in whatever is on disk. A path
// git ignores is a build output (`.next/`, `node_modules/`, `.autom8x/`): it is
// there only once this checkout is built, so it is reported as not checked.
// Found on disk, CI's clean checkout failed three that a built one passed.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

// `node scripts/audit-doc-references.mjs [repository] [--all]`, in either order.
const [target] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const root = resolve(target ?? resolve(import.meta.dirname, ".."));
const backendRoot = resolve(
  root,
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
);
const backendPresent = existsSync(join(backendRoot, "docs/openapi.yaml"));
// Repositories this one names but does not sit beside in CI or here.
const OTHER_REPOSITORIES = [
  "snoopy-mobile/",
  "snoopy-n8n/",
  "snoopy-automations/",
];
const files = new Set(
  execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean),
);
const ignored = (path) =>
  spawnSync("git", ["check-ignore", "-q", path], { cwd: root }).status === 0;

const EXTENSION =
  /\.(?:ts|tsx|mts|mjs|cjs|js|jsx|json|ya?ml|md|sql|css|sh|toml|txt|html|png|svg)$/u;
const CODE = /`([^`\s]+)`/gu;
const LINK = /\]\((?![a-z]+:|#)([^)\s#]+)(?:#[^)]*)?\)/gu;
const STRUCK = /~~[^~]*~~/gu;

function candidates(ref) {
  const path = ref.replace(/:\d+(?:[-–]\d+)?$/u, "");
  if (path.includes("://") || /[*<>{}$]/u.test(path)) return null;
  if (!path.includes("/") || !EXTENSION.test(path)) return null;
  return path;
}

function locate(doc, path) {
  if (OTHER_REPOSITORIES.some((prefix) => path.startsWith(prefix))) {
    return "not checked";
  }
  const sibling = path.match(/^(?:\.\.\/)?snoopy-backend\/(.+)$/u);
  if (sibling) {
    if (!backendPresent) return "not checked";
    return existsSync(join(backendRoot, sibling[1])) ? "found" : "missing";
  }
  // Anything else is this repository's, so it is found here or it is missing —
  // with or without the platform's checkout, so CI holds the rule too.
  const here = [normalize(path), normalize(join(dirname(doc), path))];
  if (here.some((candidate) => files.has(candidate))) return "found";
  return here.some(ignored) ? "not checked" : "missing";
}

export function auditDocReferences() {
  const docs = execFileSync("git", ["ls-files", "*.md"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const references = [];
  for (const doc of docs) {
    const lines = readFileSync(join(root, doc), "utf8").split("\n");
    lines.forEach((line, index) => {
      const struck = [...line.matchAll(STRUCK)].map((m) => [
        m.index,
        m.index + m[0].length,
      ]);
      for (const pattern of [CODE, LINK]) {
        for (const match of line.matchAll(pattern)) {
          const path = candidates(match[1]);
          if (!path) continue;
          const inside = struck.some(
            ([start, end]) => match.index >= start && match.index < end,
          );
          references.push({
            doc,
            line: index + 1,
            path,
            status: inside ? "struck" : locate(doc, path),
          });
        }
      }
    });
  }
  return references;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const references = auditDocReferences();
  const count = (status) =>
    references.filter((entry) => entry.status === status).length;
  for (const entry of references) {
    if (entry.status === "missing" || process.argv.includes("--all")) {
      console.log(`${entry.status}\t${entry.doc}:${entry.line}\t${entry.path}`);
    }
  }
  console.log(
    `doc references: ${references.length} — found ${count("found")}, struck ${count("struck")}, not checked ${count("not checked")}, missing ${count("missing")}`,
  );
  process.exit(count("missing") > 0 ? 1 : 0);
}
