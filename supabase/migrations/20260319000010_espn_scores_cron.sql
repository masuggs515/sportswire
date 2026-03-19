-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010 — ESPN scores cron jobs
--
-- Unschedules the old BallDontLie fetch-scores job.
-- Schedules fetch-nba-scores, fetch-nfl-scores, fetch-mlb-scores every minute.
-- Seasonal gates are inside each Edge Function — crons run year-round.
-- All three make zero BDL requests (ESPN only).
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('fetch-scores');

SELECT cron.schedule(
  'fetch-nba-scores',
  '* * * * *',
  $$ SELECT invoke_edge_fn('fetch-nba-scores'); $$
);

SELECT cron.schedule(
  'fetch-nfl-scores',
  '* * * * *',
  $$ SELECT invoke_edge_fn('fetch-nfl-scores'); $$
);

SELECT cron.schedule(
  'fetch-mlb-scores',
  '* * * * *',
  $$ SELECT invoke_edge_fn('fetch-mlb-scores'); $$
);
