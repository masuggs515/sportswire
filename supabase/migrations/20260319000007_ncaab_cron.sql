-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Add fetch-ncaab-scores cron job
--
-- Schedule: every 5 minutes, same as fetch-scores.
-- Seasonal gate is inside the Edge Function itself (Nov–Apr).
-- No BallDontLie requests — fetches from ESPN public scoreboard API.
--
-- Run in Supabase SQL Editor for sportswire-dev:
--   1. Open sportswire-dev → SQL Editor
--   2. Paste and run this entire file
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'fetch-ncaab-scores',
  '*/5 * * * *',
  $$ SELECT invoke_edge_fn('fetch-ncaab-scores'); $$
);
