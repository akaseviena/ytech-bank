-- ─────────────────────────────────────────────────────────────────────────────
-- Add: profiles.card_color — user-selectable virtual card color theme
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Part of the yellow/blue card rebrand. The virtual card now has two visual
-- styles (yellow gradient with graphite text, blue gradient with white text),
-- and this column stores which one a given user has selected. Defaults to
-- 'yellow' for everyone, including existing rows, so no backfill is needed.
--
-- Read/written directly by the client via the existing "own profile" RLS
-- policy (auth.uid() = id) — no new policy or RPC needed, same as
-- card_frozen.
--
-- STATUS: NOT applied to the live database yet, and not verified by this
-- session. Run this manually in the Supabase SQL Editor, then confirm the
-- card color toggle in the app actually persists (reload the page after
-- switching — it should stick). Folded into schema.sql for fresh installs
-- in the same commit as this file.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS card_color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (card_color IN ('yellow', 'blue'));
