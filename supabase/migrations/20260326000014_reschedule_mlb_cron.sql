-- Migration 014 — Reschedule fetch-mlb-scores cron (second reschedule)
SELECT cron.unschedule('fetch-mlb-scores');

SELECT cron.schedule(
  'fetch-mlb-scores',
  '* * * * *',
  $$ SELECT invoke_edge_fn('fetch-mlb-scores'); $$
);
