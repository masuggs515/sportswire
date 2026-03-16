-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Supabase Cron Schedule
-- Run these in your Supabase SQL editor (or include in a migration).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Request budget analysis (free tier: 5 req/min)
--
-- fetch-scores:    fires */5 min  → 2 req/run (NBA + NFL) = 0.4 req/min avg
-- fetch-standings: fires 1x/hour → 2 req/run ÷ 60 min    = 0.03 req/min avg
-- fetch-news:      fires */30 min → 0 BDL requests (ESPN RSS only)
--
-- Peak usage: ~2.5 req/min, well within 5/min free tier.
-- The smart scheduling gate in bdl_client.ts reduces this further off-hours.
--
-- Stagger rationale:
--   :00, :05, :10... → fetch-scores
--   :30 past each hr → fetch-standings (never fires same minute as scores)
--   :15, :45         → fetch-news (ESPN RSS, no BDL calls)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper: invoke an Edge Function by name
CREATE OR REPLACE FUNCTION invoke_edge_fn(fn_name TEXT, payload JSONB DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql AS $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body := payload
  );
$$;

-- ── Scores: every 5 minutes ───────────────────────────────────────────────
-- bdl_client.ts gates this internally — skips API calls outside game hours.
-- 2 BDL requests per run when active.
SELECT cron.schedule(
  'fetch-scores',
  '*/5 * * * *',
  $$ SELECT invoke_edge_fn('fetch-scores'); $$
);

-- ── News: at :15 and :45 past every hour ──────────────────────────────────
-- Only hits ESPN RSS — zero BDL requests.
-- Staggered to :15/:45 to avoid firing simultaneously with scores at :00/:30.
SELECT cron.schedule(
  'fetch-news',
  '15,45 * * * *',
  $$ SELECT invoke_edge_fn('fetch-news'); $$
);

-- ── Standings: at :30 past every hour ────────────────────────────────────
-- 2 BDL requests per run. Fires at :30 — never same minute as fetch-scores.
-- bdl_client.ts also guards with shouldRefreshStandings() staleness check.
SELECT cron.schedule(
  'fetch-standings',
  '30 * * * *',
  $$ SELECT invoke_edge_fn('fetch-standings'); $$
);

-- ── Cleanup: daily at 4:00 AM UTC ────────────────────────────────────────
SELECT cron.schedule(
  'cleanup',
  '0 4 * * *',
  $$
    DELETE FROM stories
      WHERE published_at < NOW() - INTERVAL '7 days';
    DELETE FROM games
      WHERE status = 'final' AND game_time < NOW() - INTERVAL '3 days';
    DELETE FROM story_views
      WHERE viewed_at < NOW() - INTERVAL '30 days';
  $$
);

-- ── Hot story recalculation: at :00 past every hour ──────────────────────
SELECT cron.schedule(
  'recalc-hot',
  '0 * * * *',
  $$
    -- Mark hot: 10+ views in last 3 hours
    UPDATE stories SET is_hot = TRUE
    WHERE id IN (
      SELECT story_id FROM story_views
      WHERE viewed_at > NOW() - INTERVAL '3 hours'
      GROUP BY story_id HAVING COUNT(*) >= 10
    );
    -- Unmark cooled: dropped below threshold
    UPDATE stories SET is_hot = FALSE
    WHERE is_hot = TRUE
    AND id NOT IN (
      SELECT story_id FROM story_views
      WHERE viewed_at > NOW() - INTERVAL '6 hours'
      GROUP BY story_id HAVING COUNT(*) >= 10
    );
  $$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- View all scheduled jobs (run anytime to verify)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;

-- ─────────────────────────────────────────────────────────────────────────────
-- Check recent job run history + any errors
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT jobname, start_time, end_time, status, return_message
-- FROM cron.job_run_details
-- ORDER BY start_time DESC LIMIT 20;
