-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Update fetch-ncaab-scores cron to every minute
--
-- pg_cron minimum granularity is 1 minute (standard cron syntax).
-- Previous schedule was */5 — updated to */1 for near-live score updates.
-- fetch-ncaab-scores makes zero BDL requests (ESPN only) so no rate limit concern.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('fetch-ncaab-scores');

SELECT cron.schedule(
  'fetch-ncaab-scores',
  '*/1 * * * *',
  $$ SELECT invoke_edge_fn('fetch-ncaab-scores'); $$
);
