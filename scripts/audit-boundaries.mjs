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

const legacyDatabaseAllowlist = new Set([
  "app/account/organization/actions.ts",
  "app/account/organization/page.tsx",
  "app/account/projects/[id]/invoices/flagged/actions.ts",
  "app/account/projects/actions.ts",
  "app/account/projects/page.tsx",
  "app/onboarding/actions.ts",
  "app/onboarding/join-org/page.tsx",
  "lib/auth.ts",
  "lib/domain-utils.ts",
  "lib/project-rbac.ts",
  "lib/projects.ts",
  "lib/tenant.ts",
  "lib/workflows.ts",
  "lib/workspace-invites.ts",
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
  if (
    (content.includes('"@/lib/db"') || content.includes("'@/lib/db'")) &&
    !legacyDatabaseAllowlist.has(path)
  ) {
    failures.push(
      `${path}: new direct database access is outside the cutover allowlist`,
    );
  }
}

for (const path of removedRouteFiles) {
  if (existsSync(join(root, path))) {
    failures.push(
      `${path}: removed direct auth/upload/file route was reintroduced`,
    );
  }
}

const actualLegacyDatabaseFiles = new Set(
  files
    .filter((file) => {
      const content = readFileSync(file, "utf8");
      return content.includes('"@/lib/db"') || content.includes("'@/lib/db'");
    })
    .map((file) => relative(root, file)),
);
for (const path of legacyDatabaseAllowlist) {
  if (!actualLegacyDatabaseFiles.has(path)) {
    failures.push(
      `${path}: remove this resolved file from the legacy database allowlist`,
    );
  }
}

const authFiles = ["app/(auth)/login/page.tsx", "app/(auth)/signup/page.tsx"];
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
    `Boundary audit passed. Browser Supabase/storage/manual-login paths: 0. Transitional direct-database files: ${actualLegacyDatabaseFiles.size}.`,
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
