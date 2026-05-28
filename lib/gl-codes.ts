import type { Prisma } from "@prisma/client";
import { CLAROS_PROJECT_IDS } from "@/lib/claros";
import { GENERAL_GL_CODES_TEMPLATE } from "@/lib/gl-codes-general-template";

// Seeds the 28-row general chart of accounts into gl_account_map for a project.
//
// - No-op (returns 0) if projectId is a Claros team project. Defensive: even if
//   accidentally invoked with Claros's UUID, we won't append rows to their 80-row
//   chart of accounts.
// - Idempotent: gl_account_map has a primary key on (project_id, code), so
//   ON CONFLICT DO NOTHING means re-running the seed for the same project
//   is safe — duplicate-attempted inserts are silently skipped.
// - Designed to run inside a Prisma $transaction. Accept the tx client so the
//   seed is atomic with the surrounding work (project + membership creation).
//   If the seed throws, the project insert rolls back.
// - gl_account_map is not modeled in prisma/schema.prisma (Supabase-managed
//   table), so we use $executeRaw rather than a typed model method.

export async function seedGeneralGlCodesForProject(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<number> {
  if (CLAROS_PROJECT_IDS.has(projectId)) return 0;

  // Build aligned arrays for a single multi-row INSERT. Postgres accepts
  // unnest() on parallel arrays, which lets us insert N rows with one round-trip
  // and proper parameter binding (no string concatenation).
  const codes = GENERAL_GL_CODES_TEMPLATE.map((r) => r.code);
  const fullNames = GENERAL_GL_CODES_TEMPLATE.map((r) => r.full_name);
  const parentCodes = GENERAL_GL_CODES_TEMPLATE.map((r) => r.parent_code);
  const levels = GENERAL_GL_CODES_TEMPLATE.map((r) => r.level);
  const isSelectables = GENERAL_GL_CODES_TEMPLATE.map((r) => r.is_selectable);
  const allocationColumns = GENERAL_GL_CODES_TEMPLATE.map(
    (r) => r.allocation_column,
  );

  const inserted = await tx.$executeRaw`
    INSERT INTO gl_account_map (project_id, code, full_name, parent_code, level, is_selectable, allocation_column)
    SELECT ${projectId}::text, code, full_name, parent_code, level::int, is_selectable::boolean, allocation_column
    FROM UNNEST(
      ${codes}::text[],
      ${fullNames}::text[],
      ${parentCodes}::text[],
      ${levels}::int[],
      ${isSelectables}::boolean[],
      ${allocationColumns}::text[]
    ) AS t(code, full_name, parent_code, level, is_selectable, allocation_column)
    ON CONFLICT (project_id, code) DO NOTHING
  `;

  return inserted;
}
