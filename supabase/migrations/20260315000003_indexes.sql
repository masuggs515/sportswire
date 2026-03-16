-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Migration 003: Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Stories ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_stories_league    ON stories(league);
CREATE INDEX idx_stories_tags      ON stories USING GIN(team_tags);
CREATE INDEX idx_stories_published ON stories(published_at DESC);
CREATE INDEX idx_stories_hot       ON stories(is_hot) WHERE is_hot = TRUE;

-- ── Games ─────────────────────────────────────────────────────────────────────
CREATE INDEX idx_games_league ON games(league);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_time   ON games(game_time DESC);
-- Composite: feed ticker queries active games by league + status
CREATE INDEX idx_games_league_status ON games(league, status);

-- ── Standings ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_standings_team ON standings(league, team_abbr);

-- ── User Preferences ──────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_prefs_user   ON user_preferences(user_id)   WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_prefs_device ON user_preferences(device_id) WHERE device_id IS NOT NULL;

-- ── Story Views ───────────────────────────────────────────────────────────────
CREATE INDEX idx_views_story ON story_views(story_id);
CREATE INDEX idx_views_time  ON story_views(viewed_at DESC);
-- Composite: hot recalculation scans recent views by story
CREATE INDEX idx_views_story_time ON story_views(story_id, viewed_at DESC);
