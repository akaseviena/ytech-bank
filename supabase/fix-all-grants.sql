-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: missing table-level GRANTs for the authenticated role, project-wide
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- None of the SQL files in this project ever issued an explicit GRANT — RLS
-- policies were added assuming the table-level privilege already existed.
-- Postgres checks table-level GRANT *before* evaluating RLS, so a missing
-- grant fails with "permission denied for table X", not an RLS-style
-- rejection ("new row violates row-level security policy for table X").
-- profiles hit this first (see fix-profiles-grants.sql); this file closes
-- the same gap on every other table so it can't resurface elsewhere.
--
-- Safe to re-run: GRANT is idempotent, and RLS policies remain the real
-- per-row gate — this only restores the table-level privilege they assume.
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles                    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON savings_goals                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_conversations             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON neurooffice_conversations    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_usage                  TO authenticated;
