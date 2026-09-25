-- ─────────────────────────────────────────────────────────────────────────────
-- Add: search_transfer_recipients() — narrow recipient search for the
-- profiles/transfer_funds rail (web transfer flow)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- KL-001. Closes the direct-read hole left by the old "search profiles"
-- RLS policy (FOR SELECT USING (true)) — that policy let any authenticated
-- caller read every column of every row in profiles directly via the REST
-- API, not just the narrow set the transfer recipient search UI requested.
-- See recon.md / findings.md for the original write-up.
--
-- Deliberately a SEPARATE function from search_recipients: that one belongs
-- to the accounts/transfers rail (mobile), returns
-- account_id/display_name/account_ref, and must not be touched or
-- overwritten — confirmed live via pg_proc before this migration was
-- written. This function serves the profiles/transfer_funds rail (web)
-- only, and returns the columns that rail's recipient picker actually
-- needs (avatar_url, plan included, so nothing else has to change).
--
-- email is deliberately excluded from the search fields: matching on it
-- would let a caller confirm whether a given address has a Y-tech account
-- (enumeration), and the UI never displays it, so it isn't needed here.
--
-- Minimum length (3 chars) and result count (8) are enforced here, not just
-- in the client — a caller who skips the UI and calls this RPC directly
-- still gets the same bounds.
--
-- Already applied to the live database and verified (manual search by
-- name/surname/account number, confirmed via direct RPC calls from a
-- second test account: email search returns nothing, sub-3-char queries
-- return nothing, self-search returns nothing). Folded into schema.sql for
-- fresh installs in the same commit as this file.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_transfer_recipients(q TEXT)
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
  SELECT id, first_name, last_name, account_number, avatar_url, plan
  FROM profiles
  WHERE length(btrim(q)) >= 3
    AND id <> auth.uid()
    AND (
      first_name ILIKE '%' || q || '%'
      OR last_name ILIKE '%' || q || '%'
      OR account_number ILIKE '%' || q || '%'
    )
  ORDER BY first_name, last_name
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION search_transfer_recipients(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transfer_recipients(TEXT) TO authenticated;
