-- Run this in the Supabase SQL Editor.
--
-- Daily usage tracking table — one row per (user, date).
-- The UNIQUE constraint enables atomic upsert-increment from the API routes.
--
CREATE TABLE IF NOT EXISTS daily_usage (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- Table-level grant — RLS below is the per-row gate, but Postgres checks this
-- first; without it, writes fail "permission denied for table daily_usage"
-- before any policy runs. See fix-profiles-grants.sql for the full story.
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_usage TO authenticated;

DROP POLICY IF EXISTS "own usage" ON daily_usage;
CREATE POLICY "own usage" ON daily_usage FOR ALL USING (auth.uid() = user_id);
