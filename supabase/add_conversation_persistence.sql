-- Run this in the Supabase SQL Editor.
--
-- Part 1: Enable RLS on ai_conversations so the web client can access it.
--         The mobile admin client uses the service role key and bypasses RLS,
--         so this does not affect the mobile app.
--
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Table-level grant — RLS below is the per-row gate, but Postgres checks this
-- first; without it, writes fail "permission denied for table ai_conversations"
-- before any policy runs. See fix-profiles-grants.sql for the full story.
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_conversations TO authenticated;

DROP POLICY IF EXISTS "own ai conversations" ON ai_conversations;
CREATE POLICY "own ai conversations" ON ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Part 2: New table — one row per (user, agent_type).
--
CREATE TABLE IF NOT EXISTS neurooffice_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_type  TEXT NOT NULL CHECK (agent_type IN (
                'marketer','copywriter','hr-manager','client-manager',
                'consultant','designer','lawyer','accountant')),
  messages    JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, agent_type)
);

ALTER TABLE neurooffice_conversations ENABLE ROW LEVEL SECURITY;

-- Table-level grant — RLS below is the per-row gate, but Postgres checks this
-- first; without it, writes fail "permission denied for table
-- neurooffice_conversations" before any policy runs. See
-- fix-profiles-grants.sql for the full story.
GRANT SELECT, INSERT, UPDATE, DELETE ON neurooffice_conversations TO authenticated;

DROP POLICY IF EXISTS "own neurooffice conversations" ON neurooffice_conversations;
CREATE POLICY "own neurooffice conversations" ON neurooffice_conversations
  FOR ALL USING (auth.uid() = user_id);
