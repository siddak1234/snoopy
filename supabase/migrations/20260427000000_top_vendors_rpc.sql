-- 20260427000000_top_vendors_rpc.sql
-- ---------------------------------------------------------------------------
-- top_vendors_for_period
-- ---------------------------------------------------------------------------
-- Returns the top N vendors (merchants) for a (lounge_code, period) window
-- from the claros-gl-code line-item table.
--
-- Two-stage aggregation:
--   1. GROUP BY filename + "Merchant" collapses line items into one row per
--      invoice, summing "Amount" → invoice_total.
--   2. GROUP BY "Merchant" aggregates across invoices: COUNT(*) is the number
--      of distinct invoices, SUM(invoice_total) is the merchant's spend.
--
-- Period is treated as a half-open interval [p_period_start, p_period_end + 1)
-- in America/Chicago local time, then converted to UTC via AT TIME ZONE so
-- DST is handled correctly. p_period_end is INCLUSIVE on the calling side
-- (matches the dashboard's date-only period semantics).
--
-- SECURITY INVOKER preserves the existing RLS policy on the underlying table
-- — only @autom8x.ai (admin) and @clarossolutions.com users can read it.
--
-- Apply manually via Supabase SQL Editor; the supabase/migrations folder is
-- reference-only in this repo (the existing *.sql files are commented out).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION top_vendors_for_period(
  p_lounge_code text,
  p_period_start date,
  p_period_end date,
  p_limit integer DEFAULT 5
) RETURNS TABLE (merchant text, invoice_count bigint, total_spend numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH invoices AS (
    SELECT filename, "Merchant", SUM("Amount") AS invoice_total
    FROM "claros-gl-code"
    WHERE lounge_code = p_lounge_code
      AND "createdAt" >= (p_period_start::timestamp AT TIME ZONE 'America/Chicago')
      AND "createdAt" <  ((p_period_end + 1)::timestamp AT TIME ZONE 'America/Chicago')
    GROUP BY filename, "Merchant"
  )
  SELECT "Merchant", COUNT(*), SUM(invoice_total)
  FROM invoices
  GROUP BY "Merchant"
  ORDER BY SUM(invoice_total) DESC
  LIMIT p_limit;
$$;
