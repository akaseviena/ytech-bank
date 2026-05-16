-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: transactions RLS policies
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Root cause: the transactions table only had a SELECT policy.
-- Client-side INSERTs (e.g. subscription fee deductions) were silently
-- rejected by RLS because no INSERT policy existed.
-- The transfer_funds() function was not affected because it uses
-- SECURITY DEFINER which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop old SELECT-only policy
DROP POLICY IF EXISTS "own transactions" ON transactions;

-- 2. SELECT: user can see transactions they sent OR received,
--    including withdrawals where receiver_id is NULL.
CREATE POLICY "own transactions" ON transactions
  FOR SELECT USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id OR
    (auth.uid() = sender_id AND receiver_id IS NULL)
  );

-- 3. INSERT: user can only insert transactions where they are the sender.
--    This covers subscription fees, future self-initiated withdrawals, etc.
DROP POLICY IF EXISTS "insert own transactions" ON transactions;
CREATE POLICY "insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 4. Verify: check recent business-category transactions
--    (uncomment and run separately to confirm)
-- SELECT id, sender_id, receiver_id, amount, description, category, type, status, created_at
-- FROM transactions
-- WHERE category = 'business'
-- ORDER BY created_at DESC
-- LIMIT 10;
