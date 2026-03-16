-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Migration 006: Cron Schedule
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- TODO MAS: before applying this migration, replace SUPABASE_SECRET_KEY_PLACEHOLDER
-- below with the actual service role key from .env.dev (SUPABASE_SECRET_KEY).
-- The key is not committed to git for security reasons.
CREATE OR REPLACE FUNCTION invoke_edge_fn(fn_name TEXT, payload JSONB DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql AS $$
  SELECT net.http_post(
    url     := 'https://fshywvmufcumkjcolocd.supabase.co/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer SUPABASE_SECRET_KEY_PLACEHOLDER',
      'Content-Type',  'application/json'
    ),
    body := payload
  );
$$;

-- ── Scores: every 5 minutes ───────────────────────────────────────────────────
-- bdl_client.ts gates API calls internally — skips outside game hours + offseason.
-- 2 BDL requests per active run (NBA + NFL).
SELECT cron.schedule(
  'fetch-scores',
  '*/5 * * * *',
  $$ SELECT invoke_edge_fn('fetch-scores'); $$
);

-- ── News: at :15 and :45 past every hour ──────────────────────────────────────
-- ESPN RSS only — zero BDL requests.
-- Staggered to avoid firing at the same minute as scores (:00/:30) or standings (:30).
SELECT cron.schedule(
  'fetch-news',
  '15,45 * * * *',
  $$ SELECT invoke_edge_fn('fetch-news'); $$
);

-- ── Standings: DISABLED ───────────────────────────────────────────────────────
-- fetch-standings disabled: requires BDL All-Star tier ($9.99/sport x2 = $19.98/mo).
-- Re-enable when upgraded: cron '30 * * * *'
-- SELECT cron.schedule(
--   'fetch-standings',
--   '30 * * * *',
--   $$ SELECT invoke_edge_fn('fetch-standings'); $$
-- );

-- ── Cleanup: daily at 4:00 AM UTC ─────────────────────────────────────────────
-- Keeps database lean. Old articles are re-fetched if they re-appear in RSS.
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

-- ── Hot story recalculation: at :00 past every hour ───────────────────────────
-- Mark hot if 10+ views in last 3 hours.
-- Unmark if dropped below threshold in last 6 hours.
SELECT cron.schedule(
  'recalc-hot',
  '0 * * * *',
  $$
    UPDATE stories SET is_hot = TRUE
    WHERE id IN (
      SELECT story_id FROM story_views
      WHERE viewed_at > NOW() - INTERVAL '3 hours'
      GROUP BY story_id HAVING COUNT(*) >= 10
    );

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
-- Verification queries (run after applying this migration):
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
-- SELECT jobname, start_time, end_time, status, return_message
--   FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
