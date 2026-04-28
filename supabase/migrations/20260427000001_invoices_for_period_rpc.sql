-- 20260427000001_invoices_for_period_rpc.sql
-- ---------------------------------------------------------------------------
-- invoices_for_period
-- ---------------------------------------------------------------------------
-- Returns one row per invoice (collapsed from line items by `filename`) for a
-- (lounge_code, period) window from the claros-gl-code line-item table.
--
-- Two-stage aggregation:
--   1. Inner CTE — GROUP BY filename collapses line items into invoice-level
--      rows. Per-invoice columns use MIN() because all line items of one
--      invoice should agree on these values; MIN() is just a deterministic
--      pick. SUM("Amount"::numeric) cast handles the text storage of Amount.
--   2. Outer SELECT — filters by lounge_code and the createdAt window
--      converted to UTC via AT TIME ZONE 'America/Chicago' (DST-safe), and
--      orders newest-first by ingestion time.
--
-- Period is treated as a half-open interval [p_period_start, p_period_end + 1)
-- in America/Chicago local time (same convention as top_vendors_for_period).
-- p_period_end is INCLUSIVE on the calling side.
--
-- SECURITY INVOKER preserves the existing RLS policy on claros-gl-code —
-- only @autom8x.ai (admin) and @clarossolutions.com users can read it.
--
-- Apply manually via Supabase SQL Editor.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION invoices_for_period(
  p_lounge_code text,
  p_period_start date,
  p_period_end date
) RETURNS TABLE (
  filename text,
  merchant text,
  invoice_number text,
  invoice_date date,
  amount numeric,
  status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH per_invoice AS (
    SELECT
      filename,
      MIN("Merchant")        AS merchant,
      MIN("Invoice_Number")  AS invoice_number,
      MIN("Invoice_Date")    AS invoice_date,
      SUM("Amount"::numeric) AS amount,
      MIN("Status")          AS status,
      MIN("createdAt")       AS created_at,
      MIN(lounge_code)       AS lounge_code
    FROM "claros-gl-code"
    GROUP BY filename
  )
  SELECT filename, merchant, invoice_number, invoice_date, amount, status, created_at
  FROM per_invoice
  WHERE lounge_code = p_lounge_code
    AND created_at >= (p_period_start::timestamp AT TIME ZONE 'America/Chicago')
    AND created_at <  ((p_period_end + 1)::timestamp AT TIME ZONE 'America/Chicago')
  ORDER BY created_at DESC, filename;
$$;
