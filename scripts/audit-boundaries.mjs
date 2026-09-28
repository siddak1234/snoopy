import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoots = ["app", "components", "hooks", "lib"];
const sourceFiles = sourceRoots.flatMap((path) => walk(join(root, path)));
const topLevelFiles = ["proxy.ts", "instrumentation.ts", "next.config.ts"].map(
  (path) => join(root, path),
);
const files = [...sourceFiles, ...topLevelFiles].filter(existsSync);

const forbiddenRuntimePatterns = [
  {
    label: "Prisma/direct database access",
    pattern: /(?:@prisma\/|@\/lib\/db|\bprisma\b)/i,
  },
  { label: "Supabase SDK", pattern: /["']@supabase\// },
  {
    label: "browser-visible Supabase configuration",
    pattern: /NEXT_PUBLIC_SUPABASE_/,
  },
  { label: "Supabase server secret", pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  {
    label: "Google Cloud Storage SDK",
    pattern: /["']@google-cloud\/storage["']/,
  },
  {
    label: "legacy execution webhook configuration",
    pattern: /\bN8N_[A-Z0-9_]+\b/,
  },
];

const platformFetchFacades = new Set([
  "lib/platform-api.ts",
  "lib/platform-proxy.ts",
  "lib/platform-server.ts",
]);

const removedRouteFiles = [
  "app/api/auth/oauth/route.ts",
  "app/api/auth/signup/route.ts",
  "app/auth/callback/route.ts",
  "app/api/candidates/upload/route.ts",
  "app/api/invoices/upload/route.ts",
  "app/api/job-descriptions/upload/route.ts",
  "app/api/candidates/file/route.ts",
  "app/api/invoices/file/route.ts",
  "app/api/job-descriptions/file/route.ts",
];

// Colour lives in the design tokens (register F14): a hex literal anywhere but
// app/globals.css, where the tokens are defined, is a colour the theme cannot
// change. app/opengraph-image.tsx is the one exemption — image generation cannot
// read CSS custom properties. Code is read by TypeScript's own parser, so only
// strings, templates and JSX text are looked at: a comment ("§12.1 #160") is not
// code, and an `href`'s value ("#add") is a fragment, not a colour.
const hexColour =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9A-Za-z_-])/u;
const hexAllowed = new Set(["app/globals.css", "app/opengraph-image.tsx"]);

function rawHexColour(path, content) {
  if (path.endsWith(".css")) {
    return content.replace(/\/\*[\s\S]*?\*\//gu, "").match(hexColour)?.[0];
  }
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let found;
  const visit = (node) => {
    if (found) return;
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "href"
    ) {
      return;
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found = node.text.match(hexColour)?.[0];
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const failures = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  const path = relative(root, file);
  if (!hexAllowed.has(path)) {
    const colour = rawHexColour(path, content);
    if (colour) {
      failures.push(
        `${path}: raw hex colour ${colour} — use a design token from app/globals.css`,
      );
    }
  }
  for (const rule of forbiddenRuntimePatterns) {
    if (rule.pattern.test(content)) failures.push(`${path}: ${rule.label}`);
  }
  if (content.includes("fetch(") && !platformFetchFacades.has(path)) {
    failures.push(`${path}: direct fetch must use a platform API facade`);
  }
}

for (const path of removedRouteFiles) {
  if (existsSync(join(root, path))) {
    failures.push(
      `${path}: removed direct auth/upload/file route was reintroduced`,
    );
  }
}

const authFiles = ["app/(auth)/login/page.tsx"];
for (const path of authFiles) {
  const content = readFileSync(join(root, path), "utf8");
  if (/type=["']password["']|signInWithPassword|signUp\s*\(/.test(content)) {
    failures.push(`${path}: manual credential login is prohibited`);
  }
}

if (failures.length > 0) {
  console.error(
    "Boundary audit failed:\n" + failures.map((item) => `- ${item}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    "Boundary audit passed. Browser secrets, direct database, storage, manual-login paths and raw hex colours: 0.",
  );
}

function walk(path) {
  if (!existsSync(path)) return [];
  const output = [];
  for (const entry of readdirSync(path)) {
    const candidate = join(path, entry);
    const stats = statSync(candidate);
    if (stats.isDirectory()) output.push(...walk(candidate));
    else if ([".ts", ".tsx", ".css"].includes(extname(candidate)))
      output.push(candidate);
  }
  return output;
}
