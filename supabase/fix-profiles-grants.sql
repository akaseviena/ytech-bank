-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: missing table-level GRANT on profiles for the authenticated role
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Symptom: "permission denied for table profiles" when updating card_frozen.
--
-- Root cause: this is Postgres' raw table-privilege error, distinct from an
-- RLS rejection (which reads "new row violates row-level security policy for
-- table ..."). It means the `authenticated` role never had UPDATE granted on
-- `profiles` at the SQL level — checked BEFORE any RLS policy is evaluated.
--
-- The existing RLS policies are already correct and do not need to change:
--   "own profile"    FOR ALL    USING (auth.uid() = id)   -- covers UPDATE
--   "search profiles" FOR SELECT USING (true)
-- Both already work for the rows they cover, once the grant below exists.
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
