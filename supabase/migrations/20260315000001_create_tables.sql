-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Migration 001: Create Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STORIES (from ESPN RSS, enriched by Gemini Flash) ────────────────────────
CREATE TABLE stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT UNIQUE,           -- ESPN article GUID from RSS
  league       TEXT NOT NULL,         -- 'NBA' | 'NFL'
  team_tags    TEXT[] DEFAULT '{}',   -- ['LAL', 'DEN'] extracted by Gemini
  headline     TEXT NOT NULL,
  rss_summary  TEXT,                  -- raw from RSS <description>
  ai_summary   TEXT,                  -- Gemini: 1-2 sentence card copy (≤160 chars)
  ai_analysis  TEXT,                  -- Gemini: 3-sentence deep analysis
  article_url  TEXT,                  -- ESPN article link (required by ESPN ToS)
  image_url    TEXT,
  published_at TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  is_hot       BOOLEAN DEFAULT FALSE,
  view_count   INT DEFAULT 0
);

-- ── GAMES (from BallDontLie) ──────────────────────────────────────────────────
CREATE TABLE games (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT UNIQUE,              -- BDL game ID (prefixed 'nfl_' for NFL)
  league       TEXT NOT NULL,            -- 'NBA' | 'NFL'
  home_team    TEXT NOT NULL,            -- abbreviation e.g. 'LAL'
  away_team    TEXT NOT NULL,
  home_score   INT DEFAULT 0,
  away_score   INT DEFAULT 0,
  status       TEXT DEFAULT 'scheduled', -- 'scheduled' | 'in_progress' | 'final'
  game_time    TIMESTAMPTZ,
  period       TEXT,                     -- 'Q2 4:32', 'Halftime', 'Final', 'Week 18'
  home_win_prob FLOAT,                   -- 0.0–1.0
  box_score    JSONB,
  fetched_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── STANDINGS (from BallDontLie) ──────────────────────────────────────────────
CREATE TABLE standings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league          TEXT NOT NULL,
  conference      TEXT,
  team_abbr       TEXT NOT NULL,
  team_name       TEXT NOT NULL,
  wins            INT DEFAULT 0,
  losses          INT DEFAULT 0,
  win_pct         FLOAT DEFAULT 0,
  conference_rank INT,
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── TEAMS (seeded manually, enriched from TheSportsDB) ───────────────────────
CREATE TABLE teams (
  abbr          TEXT PRIMARY KEY,        -- 'LAL', 'KC'
  league        TEXT NOT NULL,           -- 'NBA' | 'NFL'
  full_name     TEXT NOT NULL,
  city          TEXT,
  conference    TEXT,
  division      TEXT,
  primary_color TEXT,                    -- '#552583'
  accent_color  TEXT,
  logo_url      TEXT,                    -- from TheSportsDB (populated post-seed)
  stadium       TEXT,
  description   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── USER PREFERENCES ─────────────────────────────────────────────────────────
CREATE TABLE user_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id        TEXT,
  followed_teams   TEXT[] DEFAULT '{}',
  followed_leagues TEXT[] DEFAULT ARRAY['NBA','NFL'],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── STORY VIEWS (powers hot/trending algorithm) ───────────────────────────────
CREATE TABLE story_views (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id  UUID REFERENCES stories(id) ON DELETE CASCADE,
  device_id TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);
