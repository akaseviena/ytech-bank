-- ─────────────────────────────────────────────────────────────────────────────
-- Add: recent_recipients() — default recipient list for the profiles/
-- transfer_funds rail (web transfer flow), shown before the user types
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Same shape and same security posture as search_transfer_recipients (see
-- add-search-transfer-recipients-fn.sql) — SECURITY DEFINER, pinned
-- search_path, no PUBLIC execute, only id/first_name/last_name/
-- account_number/avatar_url/plan ever returned. This one takes no query and
-- always returns up to 50 rows: people the caller has already sent money to
-- (most recent first), then the rest of profiles alphabetically. Self
-- excluded.
--
-- receiver_id IS NOT NULL filters out withdrawal-type transactions (e.g.
-- subscription charges), which record sender_id only.
--
-- Applied to the live database by the project owner directly. Verified in
-- this session via two throwaway test accounts: after A transferred to B,
-- recent_recipients() called as A returned B first, A itself excluded from
-- its own list. Also confirmed in the actual transfer UI (empty field shows
-- "All recipients" with B first; 1-2 chars shows the hint, not the list;
-- 3+ chars runs search_transfer_recipients instead). Folded into schema.sql
-- for fresh installs in the same commit as this file.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recent_recipients()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  account_number TEXT,
  avatar_url TEXT,
  plan TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  WITH recent AS (
    SELECT t.receiver_id AS id, MAX(t.created_at) AS last_sent
    FROM transactions t
    WHERE t.sender_id = auth.uid()
      AND t.receiver_id IS NOT NULL
      AND t.receiver_id <> auth.uid()
    GROUP BY t.receiver_id
  )
  SELECT p.id, p.first_name, p.last_name, p.account_number, p.avatar_url, p.plan
  FROM profiles p
  LEFT JOIN recent r ON r.id = p.id
  WHERE p.id <> auth.uid()
  ORDER BY
    (r.last_sent IS NULL) ASC,  -- already-transferred-to rows first
    r.last_sent DESC,           -- most recent first, within that group
    p.first_name ASC, p.last_name ASC  -- everyone else, alphabetically
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION recent_recipients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recent_recipients() TO authenticated;
