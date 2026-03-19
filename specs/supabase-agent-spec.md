# Supabase Agent Spec
**Project:** SportsWire  
**Agent Role:** Supabase specialist — owns all database schema, RLS policies, Edge Functions, cron jobs, and migration management.  
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Agent Convention — TODO MAS

Any time you need human input, a decision, a credential, a review, or anything uncertain — leave a comment formatted exactly as:

```
-- TODO MAS: [clear description of what is needed and why]
```

Use `--` in SQL, `//` in TypeScript. Never stall silently — leave a TODO MAS and keep working on everything else. At the end of your session, print a consolidated list of every TODO MAS you left so Adam can action them in one pass.

---

## Agent Context

You are a Supabase expert building the backend for SportsWire, a personal sports news app. The app is built in Flutter and uses Supabase as its sole backend. Your responsibilities:

- All PostgreSQL schema, DDL, and migrations
- Row Level Security (RLS) policies on every table
- Edge Functions (Deno/TypeScript) for all data fetching and assembly
- Supabase Cron jobs for scheduled data refresh
- The shared BallDontLie rate-limiting client used by all fetching Edge Functions

You do not touch Flutter code. You do not touch Mixpanel directly. You consume the architecture decisions in this spec as your source of truth. When in doubt, raise a TODO MAS.

---

## External Data Sources

### BallDontLie (Scores, Standings, Stats) — DEPRECATED for Scores
- Base URL NBA: `https://api.balldontlie.io/v1`
- Base URL NFL: `https://api.balldontlie.io/nfl/v1`
- Auth header: `Authorization: Bearer {BALLDONTLIE_API_KEY}`
- Free tier: 5 req/min. All-Star tier: 60 req/min.
- Key stored in Supabase Vault as `BALLDONTLIE_API_KEY`
- **NOTE (2026-03-19):** BallDontLie is no longer called for NBA or NFL scores. Replaced by ESPN hidden API.
  The `BALLDONTLIE_API_KEY` secret is retained for potential future use (standings, advanced stats).
  `fetch-scores` Edge Function is deprecated — cron job unscheduled. `_shared/bdl_client.ts` retained.

### ESPN RSS (News)
- NBA:     `https://www.espn.com/espn/rss/nba/news`
- NFL:     `https://www.espn.com/espn/rss/nfl/news`
- NCAAB:   `https://www.espn.com/espn/rss/ncb/news` — added 2026-03-16 (March Madness)
- Yankees: `https://www.espn.com/mlb/rss/news?id=10` — added 2026-03-19; league = 'Yankees', team_tags = ['NYY']
- No auth required. Official ESPN feeds. Free.
- Display headlines and summaries. Always link to full article_url. Required by ESPN ToS.

### Google Gemini Flash Lite (AI Summaries)
- Model: `gemini-2.5-flash-lite-preview-06-17` — 1,000 RPD on free tier
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent`
- Auth: `?key={GOOGLE_AI_KEY}` as query param
- Key stored in Supabase Vault as `GOOGLE_AI_KEY`
- Called once per article at ingest. Result cached permanently. Never called at read time.
- Free tier. Response is JSON extracted via `indexOf("{")` / `lastIndexOf("}")` — do not use regex anchor stripping.
- **Do not use `gemini-2.0-flash`** — deprecated 2026-03-03, retires September 2026.

### ESPN Scoreboard API (NBA, NFL, MLB, NCAAB — Unofficial)

All four sports use ESPN's public scoreboard API. No auth required. Unofficial — no published docs or ToS.
On any fetch/parse error: return `{ ok: true, skipped: true, reason: 'espn-fetch-error' }` — never HTTP 500.

| League | URL | Seasonal gate | external_id prefix | Cron |
|--------|-----|---------------|-------------------|------|
| NBA    | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` | Oct–Jun | `nba_` | `* * * * *` |
| NFL    | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` | Sep–Feb | `nfl_` | `* * * * *` |
| MLB    | `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard` | Mar–Nov | `mlb_` | `* * * * *` |
| NCAAB  | `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard` | Nov–Apr | `ncaab_` | `* * * * *` |

#### ESPN Response Schema (common to all sports):
- `events[].id` → `external_id` as `'{prefix}' + id`
- `events[].date` → `game_time` (ISO UTC)
- `events[].season.type` → 1=preseason/Spring Training, 2=regular, 3=postseason
- `events[].season.slug` → `"preseason"` | `"regular-season"` | `"postseason"`
- `events[].status.type.state` → `'pre'` | `'in'` | `'post'`
- `events[].status.type.detail` → human readable clock → stored in `clock` column
- `events[].status.type.completed` → boolean (use with state for final detection)
- `events[].status.period` → current period/quarter/inning number → stored in `period` column
- `events[].competitions[0].competitors[]` — always use `.homeAway` field (`'home'`/`'away'`), NOT array order
- `team.color` → hex without `#` prefix (add `#` when using in UI)
- `team.logo` → full ESPN CDN URL

#### `details` JSONB column:
Stores the full competitors array + situation + featuredAthletes + broadcast + seasonType/Slug.
Schema defined in `web/src/lib/types.ts` as `GameDetails`.

Key sub-fields:
- `competitors[].linescores[]` — period scores for linescore table
- `competitors[].statistics[]` — MLB: hits, errors; etc.
- `competitors[].leaders[]` — top performers (points, passYards, HR, etc.)
- `competitors[].probables[]` — MLB only: starting pitcher name/headshot/record
- `situation` — live games: MLB count/bases/batter/pitcher; NFL down & distance
- `featuredAthletes[]` — MLB final: winning/losing/saving pitcher lines
- `broadcast` — TV network string e.g. "ESPN", "TNT"

#### NCAAB specifics (unchanged from before):
- College basketball uses **2 halves**, not 4 quarters
- `period` stored as display string `'6:36 - 1st Half'` / `'6:36 - 2nd Half'` (legacy — no `clock` column)
- `details` column not yet populated by `fetch-ncaab-scores` (NCAAB function predates this schema)

---

### TheSportsDB (Team Metadata)
- Base URL: `https://www.thesportsdb.com/api/v1/json/1`
- Free test key = `1` in URL path
- Used only for seeding the `teams` table. Not called at runtime.

---

## Environment Setup

| Environment | Supabase Project | Git Branch | Migrations |
|---|---|---|---|
| Task | Local via Docker | `task/*` | Manager applies freely |
| Dev | `sportswire-dev` | `dev` | Adam approves first |
| Prod | `sportswire-prod` | `main` | Adam approves first |

### Supabase CLI commands

```bash
supabase start                          # start local (Docker must be running)
supabase stop
supabase db push                        # apply migrations to local
supabase link --project-ref [ref]       # link to cloud project
supabase db push --linked               # apply to linked cloud project
supabase functions deploy [name]        # deploy Edge Function
supabase functions deploy [name] --no-verify-jwt  # for cron-triggered functions
supabase migration new [name]           # create new migration file
supabase migration list                 # check status
```

---

## Database Schema

### Conventions
- All primary keys: `UUID DEFAULT gen_random_uuid()`
- All timestamps: `TIMESTAMPTZ`
- RLS enabled on every table immediately after creation
- All schema changes via migration files — never manual dashboard edits

---

### Table: `stories`

```sql
CREATE TABLE stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT UNIQUE,           -- ESPN article GUID from RSS
  league          TEXT NOT NULL,         -- 'NBA' | 'NFL'
  team_tags       TEXT[] DEFAULT '{}',   -- ['LAL', 'DEN'] from Gemini extraction
  headline        TEXT NOT NULL,
  rss_summary     TEXT,                  -- raw from RSS <description>
  ai_summary      TEXT,                  -- Gemini: 1-2 sentence card copy (≤160 chars)
  ai_analysis     TEXT,                  -- Gemini: 3-sentence deep analysis
  article_url     TEXT,                  -- ESPN article link (required by ToS)
  image_url       TEXT,
  published_at    TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  is_hot          BOOLEAN DEFAULT FALSE,
  view_count      INT DEFAULT 0
);

CREATE INDEX idx_stories_league    ON stories(league);
CREATE INDEX idx_stories_tags      ON stories USING GIN(team_tags);
CREATE INDEX idx_stories_published ON stories(published_at DESC);
```

---

### Table: `games`

```sql
CREATE TABLE games (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT UNIQUE,           -- ESPN game ID prefixed: 'nba_' | 'nfl_' | 'mlb_' | 'ncaab_'
  league          TEXT NOT NULL,         -- 'NBA' | 'NFL' | 'MLB' | 'NCAAB'
  home_team       TEXT NOT NULL,         -- full display name from ESPN e.g. 'Los Angeles Lakers'
  away_team       TEXT NOT NULL,         --   (NCAAB uses abbreviation — predates ESPN migration)
  home_score      INT DEFAULT 0,
  away_score      INT DEFAULT 0,
  status          TEXT DEFAULT 'scheduled', -- 'scheduled' | 'in_progress' | 'final'
  game_time       TIMESTAMPTZ,
  period          TEXT,                  -- quarter/inning number (ESPN), or display string (NCAAB legacy)
  clock           TEXT,                  -- human-readable status e.g. "4th Qtr 2:14", "Bot 4th" (ESPN only)
  broadcast       TEXT,                  -- TV network e.g. "ESPN", "TNT" (ESPN only)
  home_win_prob   FLOAT,                 -- 0.0–1.0
  box_score       JSONB,                 -- legacy BDL field (unused for ESPN sports)
  details         JSONB,                 -- full competitors: logos, linescores, leaders, situation, etc.
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_games_league ON games(league);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_time   ON games(game_time DESC);
```

---

### Table: `standings`

```sql
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

CREATE UNIQUE INDEX idx_standings_team ON standings(league, team_abbr);
```

---

### Table: `teams`

```sql
CREATE TABLE teams (
  abbr            TEXT PRIMARY KEY,      -- 'LAL', 'KC'
  league          TEXT NOT NULL,         -- 'NBA' | 'NFL'
  full_name       TEXT NOT NULL,
  city            TEXT,
  conference      TEXT,
  division        TEXT,
  primary_color   TEXT,                  -- '#552583'
  accent_color    TEXT,
  logo_url        TEXT,
  stadium         TEXT,
  description     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

Teams table is seeded via migration. Not updated at runtime.

---

### Table: `user_preferences`

```sql
CREATE TABLE user_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id        TEXT,
  followed_teams   TEXT[] DEFAULT '{}',
  followed_leagues TEXT[] DEFAULT ARRAY['NBA','NFL'],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_prefs_user   ON user_preferences(user_id)   WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_prefs_device ON user_preferences(device_id) WHERE device_id IS NOT NULL;
```

---

### Table: `story_views`

```sql
CREATE TABLE story_views (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id  UUID REFERENCES stories(id) ON DELETE CASCADE,
  device_id TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_views_story ON story_views(story_id);
CREATE INDEX idx_views_time  ON story_views(viewed_at DESC);
```

---

### Stored Procedure: `increment_story_views`

```sql
CREATE OR REPLACE FUNCTION increment_story_views(story_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE stories SET view_count = view_count + 1 WHERE id = story_id;
  INSERT INTO story_views(story_id) VALUES (story_id);
$$;
```

---

## RLS Policies

```sql
-- Enable on all tables
ALTER TABLE stories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views      ENABLE ROW LEVEL SECURITY;

-- Public read on all content tables (news app — content is public)
CREATE POLICY "Public read" ON stories   FOR SELECT USING (true);
CREATE POLICY "Public read" ON games     FOR SELECT USING (true);
CREATE POLICY "Public read" ON standings FOR SELECT USING (true);
CREATE POLICY "Public read" ON teams     FOR SELECT USING (true);

-- Edge Functions write to content tables via service_role key (bypasses RLS)
-- No INSERT/UPDATE policies needed on content tables

-- Users manage only their own preferences
CREATE POLICY "Own prefs" ON user_preferences
  FOR ALL USING (
    auth.uid() = user_id
    OR device_id = current_setting('app.device_id', true)
  );

-- story_views: insert-only from any device, no reads
CREATE POLICY "Insert views" ON story_views FOR INSERT WITH CHECK (true);
```

---

## Edge Functions

All functions live in `supabase/functions/`. The shared rate-limiting client is in `supabase/functions/_shared/bdl_client.ts`.

### Secrets

**Do not use the Supabase Vault UI for Edge Function secrets.** The Vault (database-level `vault.secrets` table) is a separate system and its values are NOT injected into `Deno.env` at runtime. Edge Function secrets must be set via the CLI:

```bash
supabase secrets set BALLDONTLIE_API_KEY=<value>
supabase secrets set GOOGLE_AI_KEY=<value>
supabase secrets list   # verify
```

Secrets required:
- `BALLDONTLIE_API_KEY` — set via CLI (see above)
- `GOOGLE_AI_KEY` — set via CLI (see above)
- `SUPABASE_URL` — auto-injected by Supabase Edge Function runtime
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by Supabase Edge Function runtime

> **Runtime key name:** The Supabase runtime injects `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_SECRET_KEY`). All Edge Functions must read `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` to get the service key. The dashboard may label this key "Secret key" but the injected env var name is the old-style name.

Never hardcode any secret value in source code.

---

### `_shared/bdl_client.ts`

Shared by all Edge Functions that call BallDontLie. Handles:
- Rate limit tracking from `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers
- Pre-emptive delay when remaining budget is ≤ 1
- 300ms courtesy gap between sequential calls within one run
- 429 handling: reads `Retry-After` header, waits, retries once
- If retry also 429s: throws cleanly so cron logs failure and next run recovers naturally
- `shouldPollScores()`: returns false outside game hours (5 PM–2 AM ET) and full offseason — saves request budget
- `shouldRefreshStandings(lastFetchedAt)`: returns false if standings are < 55 min old

---

### `fetch-news`

**Triggered by:** Supabase Cron every 30 minutes (at :15 and :45 past each hour)
**Purpose:** Parse ESPN RSS feeds, generate AI summaries with Gemini, upsert to `stories` table
**BDL requests:** 0 (ESPN RSS only)

#### team_tags: two-layer extraction

**Layer 1 — RSS categories (zero Gemini quota):** Each ESPN item carries one or more `<category>` tags (e.g. "Los Angeles Lakers", "Kansas City Chiefs"). These are matched substring-wise against hardcoded league-scoped lookups (`NBA_TEAM_LOOKUP`, `NFL_TEAM_LOOKUP`, `NCAAB_TEAM_LOOKUP`) to produce team abbreviations. If any matches are found, those abbreviations are used as-is and Gemini's `team_tags` output is ignored.

**Layer 2 — Gemini fallback:** When Layer 1 returns zero tags (article is a league-wide story, trade rumour, or about a team not yet in the lookup), Gemini's `team_tags` array is used instead.

`ai_summary`, `ai_analysis`, and `is_hot` always come from Gemini — they cannot be derived from RSS. Gemini is always called regardless of whether Layer 1 succeeded.

The response now includes `rssTagHits` in addition to `inserted`/`skipped` so you can monitor how often Layer 1 is firing.

#### Logic:
1. Fetch NBA, NFL, and NCAAB ESPN RSS feeds (see ESPN RSS section above)
2. Parse XML items: extract guid, title, description, link, pubDate, all `<category>` tags
3. For each item: skip if `external_id` already exists in `stories`
4. Layer 1: run `tagsFromCategories()` against `LEAGUE_LOOKUP[league]`
5. Call Gemini Flash with headline + description, always requesting summary, analysis, is_hot, and team_tags
6. Merge: if Layer 1 found tags → use them; else use Gemini's team_tags
7. Upsert to `stories`: external_id, league, team_tags, headline, rss_summary, ai_summary, ai_analysis, article_url, published_at, is_hot

#### Lookup tables (in `fetch-news/index.ts`):
- `NBA_TEAM_LOOKUP` — all 30 NBA teams, keyed by abbreviation, values are lowercase name fragments
- `NFL_TEAM_LOOKUP` — all 32 NFL teams
- `NCAAB_TEAM_LOOKUP` — top ~35 programs by ESPN coverage volume; Gemini handles the long tail
- Tables are league-scoped to avoid abbreviation collisions (ATL = Hawks in NBA, Falcons in NFL)

---

### `fetch-scores` ⚠️ DEPRECATED

**Status:** Deprecated 2026-03-19. Cron job unscheduled. File retained, not deleted.
**Replaced by:** `fetch-nba-scores` and `fetch-nfl-scores` (ESPN API).
**BALLDONTLIE_API_KEY:** Secret retained — not deleted. Available for future use.

---

### `fetch-nba-scores`

**Triggered by:** Supabase Cron every 1 minute
**Purpose:** Fetch today's NBA games from ESPN scoreboard API, upsert to `games` table
**BDL requests:** 0 — ESPN only
**Seasonal gate:** October–June (months 10–12, 1–6)

Logic:
1. Check month — if offseason, return `{ ok: true, skipped: true, reason: 'nba-offseason' }`
2. GET ESPN NBA scoreboard URL
3. On non-200 or fetch throw: return `{ ok: true, skipped: true, reason: 'espn-fetch-error' }`
4. For each event: find home/away by `.homeAway` field
5. Map state (`pre`/`in`/`post`) to `scheduled`/`in_progress`/`final`
6. Store `status.period` in `period`, `status.type.detail` in `clock`
7. Build `details` JSONB: competitors with logos/linescores/leaders, situation, broadcast, seasonType
8. Upsert on `external_id` conflict (`'nba_' + event.id`)

---

### `fetch-nfl-scores`

**Triggered by:** Supabase Cron every 1 minute
**Purpose:** Fetch today's NFL games from ESPN scoreboard API, upsert to `games` table
**BDL requests:** 0 — ESPN only
**Seasonal gate:** September–February (months 9–12, 1–2)

Logic: identical to `fetch-nba-scores`, external_id prefix `'nfl_'`, league `'NFL'`.

---

### `fetch-mlb-scores`

**Triggered by:** Supabase Cron every 1 minute
**Purpose:** Fetch today's MLB games from ESPN scoreboard API, upsert to `games` table
**BDL requests:** 0 — ESPN only
**Seasonal gate:** March–November (months 3–11)

Logic: identical pattern. MLB extras in `details`:
- `competitors[].probables[]` — starting pitcher names, headshots, records
- `situation` — balls, strikes, outs, onFirst/onSecond/onThird, batter, pitcher
- `featuredAthletes[]` — winningPitcher, losingPitcher, savePitcher on final games

---

### `fetch-standings`

**Triggered by:** Supabase Cron every hour at :30 past  
**Purpose:** Fetch current standings from BallDontLie, upsert to `standings` table  
**BDL requests per run:** 2 (NBA + NFL) — only when `shouldRefreshStandings()` returns true

Logic:
1. Check `shouldRefreshStandings(lastFetchedAt)` from most recent standings row — if false, skip
2. Fetch NBA: `GET /nba/v1/standings`
3. Fetch NFL: `GET /nfl/v1/standings`
4. Upsert each entry on `(league, team_abbr)` conflict

---

### `fetch-ncaab-scores`

**Triggered by:** Supabase Cron every 5 minutes
**Purpose:** Fetch today's NCAAB games from ESPN public scoreboard API, upsert to `games` table
**BDL requests:** 0 — ESPN only
**Seasonal gate:** Nov–Apr (inside function) — returns `{ ok: true, skipped: true, reason: 'ncaab-offseason' }` outside window

Logic:
1. Check month: if not Nov–Apr, return offseason skip
2. GET `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`
3. On non-200 or fetch throw: return `{ ok: true, skipped: true, reason: 'espn-fetch-error' }`
4. For each `event`: find home/away competitor by `.homeAway` field
5. Map state (`pre`/`in`/`post`) to `scheduled`/`in_progress`/`final`
6. Build period string: `'6:36 - 1st Half'` for half=1, `'6:36 - 2nd Half'` for half=2, `'Final'` when done
7. Upsert on `external_id` conflict (`'ncaab_' + event.id`)

---

### `get-story-detail`

**Triggered by:** Flutter app when user taps a story card  
**Purpose:** Assemble full story view payload in one round trip  
**BDL requests:** 0 (reads from Postgres cache only)

Input: `{ storyId: string }`

Logic:
1. Fetch story by id from `stories`
2. Fetch recent final games for story's team_tags (last 4, same league)
3. Fetch upcoming scheduled games for story's team_tags (next 3, same league)
4. Fetch top 10 standings for story's league, ordered by conference_rank
5. Fetch up to 4 related stories: same league, overlapping team_tags, most recent
6. Fetch team metadata for team_tags from `teams`
7. Call `increment_story_views(storyId)`
8. Return assembled JSON: `{ story, recentGames, upcomingGames, standings, related, teams }`

---

## Cron Schedule

```sql
-- fetch-scores (BDL NBA+NFL): UNSCHEDULED 2026-03-19 — replaced by ESPN functions
SELECT cron.unschedule('fetch-scores');

-- NBA scores: every 1 minute (seasonal gate Oct–Jun inside function)
SELECT cron.schedule('fetch-nba-scores', '* * * * *', ...);

-- NFL scores: every 1 minute (seasonal gate Sep–Feb inside function)
SELECT cron.schedule('fetch-nfl-scores', '* * * * *', ...);

-- MLB scores: every 1 minute (seasonal gate Mar–Nov inside function)
SELECT cron.schedule('fetch-mlb-scores', '* * * * *', ...);

-- NCAAB scores: every 1 minute (seasonal gate Nov–Apr inside function)
SELECT cron.schedule('fetch-ncaab-scores', '*/1 * * * *', ...);

-- News: at :15 and :45 past every hour
SELECT cron.schedule('fetch-news', '15,45 * * * *', ...);

-- Standings: at :30 past every hour
SELECT cron.schedule('fetch-standings', '30 * * * *', ...);

-- Cleanup: daily at 4 AM UTC
SELECT cron.schedule('cleanup', '0 4 * * *', ...);

-- Hot recalculation: at :00 past every hour
SELECT cron.schedule('recalc-hot', '0 * * * *', ...);
```

**Request budget:** All ESPN scoreboard calls are zero-cost (no API key, no rate limit). BDL key retained but fetch-scores cron is unscheduled. BDL requests: only fetch-standings (2 req/hour) when re-enabled.

---

## Migration File Structure

```
supabase/
  migrations/
    20260315000001_create_tables.sql        -- stories, games, standings, teams, user_preferences, story_views
    20260315000002_rls_policies.sql         -- all RLS policies
    20260315000003_indexes.sql              -- all indexes
    20260315000004_stored_procedures.sql    -- increment_story_views
    20260315000005_seed_teams.sql           -- NBA and NFL team data
    20260315000006_cron_schedule.sql        -- pg_cron job definitions
    20260319000007_ncaab_cron.sql           -- adds fetch-ncaab-scores cron job
    20260319000008_ncaab_cron_1min.sql      -- updates NCAAB cron to 1-minute interval
    20260319000009_espn_scores_columns.sql  -- adds clock, broadcast, details columns to games
  functions/
    _shared/
      bdl_client.ts
    fetch-news/
      index.ts                             -- ESPN RSS (NBA/NFL/NCAAB/Yankees) → stories table
    fetch-scores/
      index.ts                             -- ⚠️ DEPRECATED 2026-03-19 — BDL NBA+NFL (cron unscheduled)
    fetch-nba-scores/
      index.ts                             -- ESPN NBA scoreboard → games table (Oct–Jun)
    fetch-nfl-scores/
      index.ts                             -- ESPN NFL scoreboard → games table (Sep–Feb)
    fetch-mlb-scores/
      index.ts                             -- ESPN MLB scoreboard → games table (Mar–Nov)
    fetch-standings/
      index.ts
    fetch-ncaab-scores/
      index.ts                             -- ESPN NCAAB scoreboard → games table (Nov–Apr)
    get-story-detail/
      index.ts
  tests/
    rls_test.ts
    fetch_scores_test.ts
    get_story_detail_test.ts
```

---

## Security Checklist

Before any deployment to sportswire-dev:

- [ ] RLS enabled on every table
- [ ] No service role key in any Flutter-accessible file
- [ ] `BALLDONTLIE_API_KEY` and `GOOGLE_AI_KEY` set via `supabase secrets set` (not Vault UI)
- [ ] All Edge Functions validate input before writing
- [ ] `article_url` always populated — required by ESPN ToS
- [ ] `get-story-detail` never calls BallDontLie — reads cache only
- [ ] Cron jobs return HTTP 200 even on rate limit errors (prevents alert spam)
- [ ] All migrations tested on local database before promotion

---

*This spec is the single source of truth for the Supabase agent. Do not deviate from the schema, RLS policies, or Edge Function logic defined here without raising a TODO MAS first.*
