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
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, ".."));
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
  return existsSync(join(root, path)) ||
    existsSync(join(root, dirname(doc), path))
    ? "found"
    : "missing";
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
