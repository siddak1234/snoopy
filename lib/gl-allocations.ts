import type { Prisma } from "@prisma/client";

// gl_code_allocations isn't in prisma/schema.prisma (Supabase-managed table),
// so we use $executeRaw / $queryRaw rather than typed model methods. The
// category columns and `allocation_column` values are mirrored in
// running-total/{claros,general}/*.code-node.js for the n8n side; if you add
// a new column there, add it to ALLOCATION_COLUMNS below too.

export const ALLOCATION_COLUMNS = [
  "liquor",
  "beer",
  "wine",
  "non_alcoholic_drinks",
  "food_costs",
  "bar_supplies",
  "office_supplies",
  "serviceware",
  "paper_bar_supplies",
  "cleaning_janitorial_supplies",
  "non_contracted_repairs_and_maintenance",
  "maintenance_agreement",
  "taxes",
  "travel_others",
  "parking",
  "employee_morale",
  "licenses_and_permits",
  "badging_and_training",
  "network_costs",
  "uniforms",
  "dues_and_subscriptions",
  "delivery_and_escort_fees",
  "staffing_expense",
  "merchant_deposit_credits",
  "reimbursements",
  "other",
] as const;

export type AllocationColumn = (typeof ALLOCATION_COLUMNS)[number];

// Recompute one allocation row from its responsible line items.
//
// Responsible = lines for the same (project_id, location) whose `createdAt`
// falls within the row's period date range. Matches the bucketing the n8n
// running-total workflow uses (execution date, not Invoice_Date).
//
// Touched columns get summed from line items grouped by `gl_account_map.allocation_column`.
// Total = sum of all line amounts in scope.
// invoice_count = distinct filenames in scope.
//
// Idempotent: running twice in succession gives the same row state.
// Designed to run inside a transaction — pass the Prisma `tx` client so the
// recompute is atomic with any wrapping write (e.g. deleting a duplicate copy).
export async function recomputeAllocationRow(
  tx: Prisma.TransactionClient,
  allocationRowId: number,
): Promise<{
  total: number;
  invoice_count: number;
  per_column: Record<string, number>;
}> {
  // Pull the row's identifying fields so we know which line items belong to it.
  const rows = await tx.$queryRaw<
    Array<{
      project_id: string;
      location: string;
      period_start: Date;
      period_end: Date;
    }>
  >`
    SELECT project_id, location, period_start, period_end
    FROM gl_code_allocations
    WHERE id = ${allocationRowId}
  `;

  if (rows.length === 0) {
    throw new Error(`recomputeAllocationRow: allocation row ${allocationRowId} not found`);
  }
  const { project_id, location, period_start, period_end } = rows[0];

  // Sum line items by allocation_column (joined via gl_account_map).
  const summed = await tx.$queryRaw<
    Array<{ allocation_column: string | null; column_sum: string }>
  >`
    SELECT m.allocation_column,
           SUM(CAST(li."Amount" AS NUMERIC))::text AS column_sum
    FROM gl_code_line_items li
    LEFT JOIN gl_account_map m
      ON m.project_id = li.project_id AND m.code = li."GL_Account"
    WHERE li.project_id = ${project_id}
      AND li.lounge_code = ${location}
      AND li."createdAt" >= ${period_start}::date::timestamptz
      AND li."createdAt" < (${period_end}::date + 1)::timestamptz
    GROUP BY m.allocation_column
  `;

  // Sum line items into category columns. Anything without a recognized
  // allocation_column — line items with a NULL GL_Account, or a code mapped to
  // a column outside ALLOCATION_COLUMNS — is bucketed into `other` so the
  // category columns always reconcile to `total` (uncategorized money stays
  // visible instead of silently inflating the total). Accumulate raw amounts
  // and round once at the end to avoid per-column cent drift.
  const perColumnRaw: Record<string, number> = {};
  for (const row of summed) {
    const amount = Number(row.column_sum);
    const col =
      row.allocation_column &&
      ALLOCATION_COLUMNS.includes(row.allocation_column as AllocationColumn)
        ? row.allocation_column
        : "other";
    perColumnRaw[col] = (perColumnRaw[col] ?? 0) + amount;
  }

  const perColumn: Record<string, number> = {};
  for (const [col, amount] of Object.entries(perColumnRaw)) {
    perColumn[col] = Math.round(amount * 100) / 100;
  }
  // Derive total from the rounded columns so total === sum(columns) exactly.
  const total =
    Math.round(
      Object.values(perColumn).reduce((sum, value) => sum + value, 0) * 100,
    ) / 100;

  // Distinct invoice count for this scope.
  const countRows = await tx.$queryRaw<Array<{ invoice_count: bigint }>>`
    SELECT COUNT(DISTINCT filename)::bigint AS invoice_count
    FROM gl_code_line_items
    WHERE project_id = ${project_id}
      AND lounge_code = ${location}
      AND "createdAt" >= ${period_start}::date::timestamptz
      AND "createdAt" < (${period_end}::date + 1)::timestamptz
  `;
  const invoice_count = Number(countRows[0]?.invoice_count ?? 0);

  // Build a single UPDATE that sets every category column. Columns not in
  // `perColumn` get NULL — matches the "no clutter for untouched categories"
  // convention from the n8n new-running-total node.
  const columnAssignments = ALLOCATION_COLUMNS.map((col) => {
    const value = perColumn[col];
    return value !== undefined ? `${col} = ${value}` : `${col} = NULL`;
  }).join(", ");

  await tx.$executeRawUnsafe(
    `UPDATE gl_code_allocations
     SET total = $1,
         invoice_count = $2,
         ${columnAssignments}
     WHERE id = $3`,
    total,
    invoice_count,
    allocationRowId,
  );

  return { total, invoice_count, per_column: perColumn };
}
