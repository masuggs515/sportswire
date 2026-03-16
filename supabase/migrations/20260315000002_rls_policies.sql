-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Migration 002: Row Level Security Policies
-- ─────────────────────────────────────────────────────────────────────────────
-- Edge Functions write to content tables via service_role key (bypasses RLS).
-- Flutter reads all content tables anonymously. Users manage only their own prefs.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE stories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views      ENABLE ROW LEVEL SECURITY;

-- ── Public read on all content tables ────────────────────────────────────────
-- The app is a news reader — all content is public. No auth needed to browse.
CREATE POLICY "Public read" ON stories   FOR SELECT USING (true);
CREATE POLICY "Public read" ON games     FOR SELECT USING (true);
CREATE POLICY "Public read" ON standings FOR SELECT USING (true);
CREATE POLICY "Public read" ON teams     FOR SELECT USING (true);

-- ── User preferences: own row only ───────────────────────────────────────────
-- Logged-in users see their row by user_id.
-- Anonymous users (pre-login) see their row by device_id session variable.
CREATE POLICY "Own prefs" ON user_preferences
  FOR ALL USING (
    auth.uid() = user_id
    OR device_id = current_setting('app.device_id', true)
  );

-- ── Story views: insert-only, no client reads ────────────────────────────────
-- Any device can log a view. No one can read the raw view log from the client.
-- Hot recalculation is handled server-side by the pg_cron job.
CREATE POLICY "Insert views" ON story_views
  FOR INSERT WITH CHECK (true);
