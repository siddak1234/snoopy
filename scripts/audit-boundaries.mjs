import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

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

const failures = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  const path = relative(root, file);
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
    "Boundary audit passed. Browser secrets, direct database, storage, and manual-login paths: 0.",
  );
}

function walk(path) {
  if (!existsSync(path)) return [];
  const output = [];
  for (const entry of readdirSync(path)) {
    const candidate = join(path, entry);
    const stats = statSync(candidate);
    if (stats.isDirectory()) output.push(...walk(candidate));
    else if ([".ts", ".tsx"].includes(extname(candidate)))
      output.push(candidate);
  }
  return output;
}
