# SportsWire — Full Technical Architecture
### Flutter + Supabase + BallDontLie + ESPN RSS · v2

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Data Sources](#2-data-sources)
3. [Database Schema](#3-database-schema)
4. [Edge Functions](#4-edge-functions)
5. [Cron Jobs & Scheduling](#5-cron-jobs--scheduling)
6. [Flutter App Architecture](#6-flutter-app-architecture)
7. [Authentication & User Preferences](#7-authentication--user-preferences)
8. [Caching Strategy](#8-caching-strategy)
9. [Share Links](#9-share-links)
10. [Mixpanel Events](#10-mixpanel-events)
11. [Cost Breakdown](#11-cost-breakdown)
12. [Upgrade Path](#12-upgrade-path)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FLUTTER APP                          │
│   Feed Screen  │  Story Screen  │  Settings Screen      │
└────────────────────────┬────────────────────────────────┘
                         │ supabase_flutter SDK v2
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     SUPABASE                            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Postgres   │  │    Auth      │  │ Edge Funcs   │  │
│  │  (cache +    │  │  (optional   │  │  (Deno/TS)   │  │
│  │   user data) │  │   login)     │  │              │  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘  │
│                                             │           │
│  ┌──────────────────────────────────────────┘           │
│  │  Supabase Cron — scheduled refresh jobs              │
│  └──────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────┘
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ BallDontLie │  │  ESPN RSS    │  │  Claude API  │
│  (official) │  │  (official)  │  │  (Anthropic) │
│             │  │              │  │              │
│ • Scores    │  │ • NBA news   │  │ • Summarize  │
│ • Standings │  │ • NFL news   │  │ • Analyze    │
│ • Box scores│  │              │  │ • Tag teams  │
│ • Stats     │  │ Stable, doc- │  │              │
│ • Injuries  │  │ umented URLs │  │              │
│ • Odds      │  │ officially   │  │              │
└─────────────┘  │ published    │  └──────────────┘
                 └──────────────┘
```

**Core principle:** Flutter only ever talks to Supabase. All three external sources are called exclusively from Edge Functions, with results cached in Postgres. Swapping any data source means editing one Edge Function — never the app.

---

## 2. Data Sources

### BallDontLie (Official API — Scores, Stats, Standings)
Documented, stable, officially supported REST API. All-Star tier at $9.99/mo per sport.

Base URL: `https://api.balldontlie.io/v1` (NBA) · `https://api.balldontlie.io/nfl/v1` (NFL)

| Endpoint | Data | Cache TTL |
|---|---|---|
| `GET /games` | Scores, schedule, status | 5 min |
| `GET /games/:id/stats` | Box scores, player stats | 10 min live · 24 hr final |
| `GET /standings` | Full standings with ranks | 1 hour |
| `GET /players` | Roster data | 7 days |
| `GET /injuries` | Injury report | 30 min |
| `GET /odds` | Live betting lines | 15 min |

**Cost: $9.99 × 2 sports = $19.98/mo.**

---

### ESPN RSS (Official Feeds — News Only)
ESPN officially publishes these feeds for use in news aggregators. Documented, stable, and have been running for years. You display the headline and summary from the feed, and link through to the full ESPN article — which is exactly what the ToS requires.

| Feed | URL |
|---|---|
| NBA News | `https://www.espn.com/espn/rss/nba/news` |
| NFL News | `https://www.espn.com/espn/rss/nfl/news` |

Each RSS item contains: headline, description summary, publish date, article URL, and category tags (team names). That's all you need to populate feed cards.

**Cost: $0. Official. No ToS ambiguity.**

---

### TheSportsDB (Team Metadata — Enrichment)
Used once per team for logos, colors, and descriptions. Cached indefinitely.

Base URL: `https://www.thesportsdb.com/api/v1/json/1` (free test key)

| Endpoint | Data | Cache TTL |
|---|---|---|
| `/searchteams.php?t={name}` | Logo, colors, stadium, description | 7 days |

**Cost: $0.**

---

### Claude API (AI Summaries — On Ingest Only)
Called **once per article** when it's first ingested from RSS. The result is stored in Postgres forever. Every user who reads that story gets the cached analysis — Claude is never called at read time.

Model: `claude-haiku-4-5-20251001` (fast, cheap for summarization tasks).

**Cost: ~$0.001/article · ~500 new articles/month = ~$0.50/mo.**

---

## 3. Database Schema

```sql
-- ─────────────────────────────────────────────────────
-- STORIES (from ESPN RSS, enriched by Claude)
-- ─────────────────────────────────────────────────────
CREATE TABLE stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT UNIQUE,           -- ESPN article GUID from RSS
  league          TEXT NOT NULL,         -- 'NBA' | 'NFL'
  team_tags       TEXT[] DEFAULT '{}',   -- ['LAL', 'DEN'] from RSS categories + Claude
  headline        TEXT NOT NULL,         -- from RSS <title>
  rss_summary     TEXT,                  -- from RSS <description>, unmodified
  ai_summary      TEXT,                  -- Claude: 1-2 sentence card copy (≤160 chars)
  ai_analysis     TEXT,                  -- Claude: 3-sentence deep analysis
  article_url     TEXT,                  -- links to espn.com full article
  image_url       TEXT,
  published_at    TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  is_hot          BOOLEAN DEFAULT FALSE,
  view_count      INT DEFAULT 0
);

CREATE INDEX idx_stories_league    ON stories(league);
CREATE INDEX idx_stories_tags      ON stories USING GIN(team_tags);
CREATE INDEX idx_stories_published ON stories(published_at DESC);

-- ─────────────────────────────────────────────────────
-- GAMES (from BallDontLie)
-- ─────────────────────────────────────────────────────
CREATE TABLE games (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT UNIQUE,           -- BallDontLie game ID
  league          TEXT NOT NULL,
  home_team       TEXT NOT NULL,         -- abbreviation: 'LAL'
  away_team       TEXT NOT NULL,
  home_score      INT,
  away_score      INT,
  status          TEXT,                  -- 'scheduled' | 'in_progress' | 'final'
  game_time       TIMESTAMPTZ,
  period          TEXT,                  -- 'Q2 4:32', 'Halftime', 'Final'
  home_win_prob   FLOAT,                 -- 0.0–1.0 from odds endpoint
  box_score       JSONB,                 -- full box score when final
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_games_league ON games(league);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_time   ON games(game_time DESC);

-- ─────────────────────────────────────────────────────
-- STANDINGS (from BallDontLie)
-- ─────────────────────────────────────────────────────
CREATE TABLE standings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league          TEXT NOT NULL,
  conference      TEXT,
  team_abbr       TEXT NOT NULL,
  team_name       TEXT NOT NULL,
  wins            INT,
  losses          INT,
  win_pct         FLOAT,
  conference_rank INT,
  fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_standings_team ON standings(league, team_abbr);

-- ─────────────────────────────────────────────────────
-- TEAMS (seeded manually, enriched from TheSportsDB)
-- ─────────────────────────────────────────────────────
CREATE TABLE teams (
  abbr          TEXT PRIMARY KEY,        -- 'LAL', 'KC'
  league        TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  city          TEXT,
  conference    TEXT,
  division      TEXT,
  primary_color TEXT,                    -- '#552583'
  accent_color  TEXT,
  logo_url      TEXT,                    -- from TheSportsDB
  stadium       TEXT,
  description   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- USER PREFERENCES
-- ─────────────────────────────────────────────────────
CREATE TABLE user_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id        TEXT,                 -- anonymous / pre-login users
  followed_teams   TEXT[] DEFAULT '{}',
  followed_leagues TEXT[] DEFAULT '{"NBA","NFL"}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_prefs_user   ON user_preferences(user_id)   WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_prefs_device ON user_preferences(device_id) WHERE device_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- STORY VIEWS (powers hot/trending)
-- ─────────────────────────────────────────────────────
CREATE TABLE story_views (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id  UUID REFERENCES stories(id) ON DELETE CASCADE,
  device_id TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_views_story ON story_views(story_id);
CREATE INDEX idx_views_time  ON story_views(viewed_at DESC);

CREATE OR REPLACE FUNCTION increment_story_views(story_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE stories SET view_count = view_count + 1 WHERE id = story_id;
$$;

-- ─────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────
ALTER TABLE stories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON stories   FOR SELECT USING (true);
CREATE POLICY "Public read" ON games     FOR SELECT USING (true);
CREATE POLICY "Public read" ON standings FOR SELECT USING (true);
CREATE POLICY "Public read" ON teams     FOR SELECT USING (true);

-- Edge functions write via service_role key (bypasses RLS)
CREATE POLICY "Own prefs" ON user_preferences
  USING (auth.uid() = user_id OR device_id = current_setting('app.device_id', true));
```

---

## 4. Edge Functions

All functions live in `supabase/functions/`. Deploy with `supabase functions deploy <name>`.

**Secrets (stored in Supabase Vault — never hardcoded):**
- `BALLDONTLIE_API_KEY`
- `ANTHROPIC_API_KEY`
- `SUPABASE_SECRET_KEY`

---

### 4a. `fetch-news` — Parse ESPN RSS, enrich with Claude

```typescript
// supabase/functions/fetch-news/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ESPN_RSS: Record<string, string> = {
  NBA: "https://www.espn.com/espn/rss/nba/news",
  NFL: "https://www.espn.com/espn/rss/nfl/news",
};

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SECRET_KEY")!
  );

  for (const [league, feedUrl] of Object.entries(ESPN_RSS)) {
    const res = await fetch(feedUrl);
    const xml = await res.text();

    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

    for (const item of items) {
      const get = (tag: string) =>
        item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] ??
        item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? "";

      const guid        = get("guid");
      const headline    = get("title");
      const description = get("description");
      const link        = get("link");
      const pubDate     = get("pubDate");
      const category    = get("category");

      // Skip articles already in DB
      const { data: exists } = await supabase
        .from("stories").select("id").eq("external_id", guid).maybeSingle();
      if (exists) continue;

      // Call Claude — once per article, result stored permanently
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `You are a sports analyst. Return ONLY valid JSON, no other text:
{
  "summary": "1-2 sentence summary for a news card (max 160 chars)",
  "analysis": "3 sentences: (1) immediate team impact, (2) relevant league context with a specific stat, (3) what to watch next",
  "is_hot": true or false based on significance,
  "team_tags": ["ABR1", "ABR2"]
}

League: ${league}
Headline: ${headline}
Description: ${description}`,
          }],
        }),
      });

      const claudeData = await claudeRes.json();
      let parsed: any = {};
      try { parsed = JSON.parse(claudeData.content?.[0]?.text ?? "{}"); } catch {}

      await supabase.from("stories").insert({
        external_id:  guid,
        league,
        team_tags:    parsed.team_tags ?? [],
        headline,
        rss_summary:  description,
        ai_summary:   parsed.summary ?? description?.slice(0, 160),
        ai_analysis:  parsed.analysis,
        article_url:  link,
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        is_hot:       parsed.is_hot ?? false,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

---

### 4b. `fetch-scores` — Pull live + scheduled scores from BallDontLie

```typescript
// supabase/functions/fetch-scores/index.ts

serve(async () => {
  const supabase = createClient(/* ... */);
  const bdlHeaders = {
    "Authorization": `Bearer ${Deno.env.get("BALLDONTLIE_API_KEY")}`,
  };

  // NBA
  const nbaRes  = await fetch("https://api.balldontlie.io/v1/games?per_page=25", { headers: bdlHeaders });
  const nbaData = await nbaRes.json();

  for (const game of nbaData.data ?? []) {
    await supabase.from("games").upsert({
      external_id:  String(game.id),
      league:       "NBA",
      home_team:    game.home_team.abbreviation,
      away_team:    game.visitor_team.abbreviation,
      home_score:   game.home_team_score,
      away_score:   game.visitor_team_score,
      status:       normalizeStatus(game.status),
      game_time:    game.date,
      period:       game.period ? `Period ${game.period}` : game.status,
      fetched_at:   new Date().toISOString(),
    }, { onConflict: "external_id" });
  }

  // NFL
  const nflRes  = await fetch("https://api.balldontlie.io/nfl/v1/games?per_page=25", { headers: bdlHeaders });
  const nflData = await nflRes.json();

  for (const game of nflData.data ?? []) {
    await supabase.from("games").upsert({
      external_id:  `nfl_${game.id}`,
      league:       "NFL",
      home_team:    game.home_team?.abbreviation,
      away_team:    game.away_team?.abbreviation,
      home_score:   game.home_team_score,
      away_score:   game.away_team_score,
      status:       normalizeStatus(game.status),
      game_time:    game.date,
      period:       game.quarter ? `Q${game.quarter}` : game.status,
      fetched_at:   new Date().toISOString(),
    }, { onConflict: "external_id" });
  }

  return new Response(JSON.stringify({ ok: true }));
});

function normalizeStatus(s: string): string {
  const lower = s?.toLowerCase() ?? "";
  if (lower.includes("final")) return "final";
  if (lower.includes("progress") || lower.includes("quarter") || lower.includes("half")) return "in_progress";
  return "scheduled";
}
```

---

### 4c. `fetch-standings` — Pull standings from BallDontLie

```typescript
// supabase/functions/fetch-standings/index.ts

serve(async () => {
  const supabase   = createClient(/* ... */);
  const bdlHeaders = { "Authorization": `Bearer ${Deno.env.get("BALLDONTLIE_API_KEY")}` };

  const res  = await fetch("https://api.balldontlie.io/v1/standings", { headers: bdlHeaders });
  const data = await res.json();

  for (const entry of data.data ?? []) {
    await supabase.from("standings").upsert({
      league:          "NBA",
      conference:      entry.conference,
      team_abbr:       entry.team.abbreviation,
      team_name:       entry.team.full_name,
      wins:            entry.wins,
      losses:          entry.losses,
      win_pct:         entry.wins / (entry.wins + entry.losses) || 0,
      conference_rank: entry.conference_rank,
      fetched_at:      new Date().toISOString(),
    }, { onConflict: "league, team_abbr" });
  }

  // NFL standings use the same pattern — different endpoint
  // https://api.balldontlie.io/nfl/v1/standings

  return new Response(JSON.stringify({ ok: true }));
});
```

---

### 4d. `get-story-detail` — Single call from Flutter when a story is tapped

Assembles everything the story view needs in one round trip: story, recent games, upcoming games, standings, related stories, and team metadata.

```typescript
// supabase/functions/get-story-detail/index.ts

serve(async (req) => {
  const { storyId } = await req.json();
  const supabase    = createClient(/* ... */);

  // 1. Story itself
  const { data: story } = await supabase
    .from("stories").select("*").eq("id", storyId).single();
  if (!story) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

  const tags = story.team_tags as string[];

  // 2. Recent final games for tagged teams
  const { data: recentGames } = await supabase
    .from("games")
    .select("*")
    .eq("league", story.league)
    .eq("status", "final")
    .or(tags.map(t => `home_team.eq.${t},away_team.eq.${t}`).join(","))
    .order("game_time", { ascending: false })
    .limit(4);

  // 3. Upcoming games for tagged teams
  const { data: upcomingGames } = await supabase
    .from("games")
    .select("*")
    .eq("league", story.league)
    .eq("status", "scheduled")
    .or(tags.map(t => `home_team.eq.${t},away_team.eq.${t}`).join(","))
    .order("game_time", { ascending: true })
    .limit(3);

  // 4. Top 10 standings for this league
  const { data: standings } = await supabase
    .from("standings")
    .select("*")
    .eq("league", story.league)
    .order("conference_rank", { ascending: true })
    .limit(10);

  // 5. Related stories — same league, overlapping team tags
  const { data: related } = await supabase
    .from("stories")
    .select("id, headline, ai_summary, league, team_tags, published_at, is_hot")
    .eq("league", story.league)
    .neq("id", storyId)
    .overlaps("team_tags", tags)
    .order("published_at", { ascending: false })
    .limit(4);

  // 6. Team metadata for display (colors, logos)
  const { data: teams } = await supabase
    .from("teams")
    .select("abbr, full_name, primary_color, accent_color, logo_url")
    .in("abbr", tags);

  // 7. Log view
  await supabase.rpc("increment_story_views", { story_id: storyId });

  return new Response(JSON.stringify({
    story, recentGames, upcomingGames, standings, related, teams,
  }), { headers: { "Content-Type": "application/json" } });
});
```

---

## 5. Cron Jobs & Scheduling

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Scores: every 5 minutes
SELECT cron.schedule('fetch-scores', '*/5 * * * *', $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/fetch-scores',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
$$);

-- News: every 30 minutes
SELECT cron.schedule('fetch-news', '*/30 * * * *', $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/fetch-news',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
$$);

-- Standings: every hour
SELECT cron.schedule('fetch-standings', '0 * * * *', $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/fetch-standings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
$$);

-- Cleanup: daily at 4 AM
SELECT cron.schedule('cleanup', '0 4 * * *', $$
  DELETE FROM stories     WHERE published_at < NOW() - INTERVAL '7 days';
  DELETE FROM games       WHERE status = 'final' AND game_time < NOW() - INTERVAL '3 days';
  DELETE FROM story_views WHERE viewed_at < NOW() - INTERVAL '30 days';
$$);

-- Hot recalculation: every hour at :15
SELECT cron.schedule('recalc-hot', '15 * * * *', $$
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
$$);
```

---

## 6. Flutter App Architecture

### Package Structure

```
lib/
├── main.dart
├── app.dart                       # MaterialApp, theme, router init
│
├── core/
│   ├── supabase.dart              # Supabase.initialize() singleton
│   ├── router.dart                # go_router — handles /story/:id deep links
│   └── team_config.dart           # Team colors, abbr → full name lookup
│
├── features/
│   ├── feed/
│   │   ├── feed_screen.dart       # Main scrollable feed
│   │   ├── game_ticker.dart       # Horizontal scroll of today's games
│   │   ├── story_card.dart        # Tweet-like card (headline + ai_summary)
│   │   └── feed_provider.dart     # Riverpod: queries stories, client-side sort
│   │
│   ├── story/
│   │   ├── story_screen.dart      # Full story view
│   │   ├── ai_analysis_card.dart  # Displays ai_analysis from Postgres (instant)
│   │   ├── score_strip.dart       # Recent + upcoming game cards
│   │   ├── standings_table.dart   # Mini standings widget
│   │   ├── related_stories.dart   # Related story cards
│   │   └── story_provider.dart    # Riverpod: calls get-story-detail edge fn
│   │
│   ├── settings/
│   │   ├── settings_sheet.dart    # Bottom sheet: pick teams
│   │   └── prefs_provider.dart    # Riverpod: local + Supabase sync
│   │
│   └── auth/
│       ├── auth_gate.dart         # Decides: show feed or login
│       └── login_screen.dart      # Magic link / Google OAuth
│
└── shared/
    ├── models/
    │   ├── story.dart             # Dart model + fromJson
    │   ├── game.dart
    │   ├── standing.dart
    │   └── team.dart
    └── widgets/
        ├── team_badge.dart        # Color dot + abbr chip
        └── shimmer_card.dart      # Loading skeleton
```

### Recommended Packages

```yaml
dependencies:
  supabase_flutter: ^2.0.0
  flutter_riverpod: ^2.0.0       # State management
  go_router: ^13.0.0             # Deep links for share URLs
  cached_network_image: ^3.0.0   # Team logos
  mixpanel_flutter: ^2.0.0       # Analytics
  shared_preferences: ^2.0.0     # Local pref fallback
  intl: ^0.19.0                  # Date formatting
  shimmer: ^3.0.0                # Loading skeletons
  url_launcher: ^6.0.0           # Open ESPN article links in browser
  share_plus: ^7.0.0             # Native share sheet
```

### Feed Query (Flutter Side)

```dart
// features/feed/feed_provider.dart
final feedProvider = FutureProvider.family<List<Story>, String?>((ref, league) async {
  final followed = ref.read(prefsProvider).followedTeams.toSet();

  var query = Supabase.instance.client
    .from('stories')
    .select('id, headline, ai_summary, league, team_tags, '
            'published_at, is_hot, image_url, article_url')
    .order('published_at', ascending: false)
    .limit(50);

  if (league != null) query = query.eq('league', league);

  final stories = (await query).map(Story.fromJson).toList();

  // Sort: my teams first → hot → newest
  stories.sort((a, b) {
    final aF = a.teamTags.any(followed.contains);
    final bF = b.teamTags.any(followed.contains);
    if (aF != bF) return aF ? -1 : 1;
    if (a.isHot != b.isHot) return a.isHot ? -1 : 1;
    return b.publishedAt.compareTo(a.publishedAt);
  });

  return stories;
});
```

### Realtime Score Updates (Flutter)

```dart
// Supabase Realtime — live score ticker updates without polling
final liveGamesStream = Supabase.instance.client
  .from('games')
  .stream(primaryKey: ['id'])
  .eq('status', 'in_progress')
  .order('game_time');
```

---

## 7. Authentication & User Preferences

```dart
// core/prefs_service.dart

class PrefsService {
  // Saves locally always. Syncs to Supabase if logged in.
  Future<void> saveFollowedTeams(List<String> teams) async {
    final p = await SharedPreferences.getInstance();
    await p.setStringList('followed_teams', teams);

    final user = Supabase.instance.client.auth.currentUser;
    if (user != null) {
      await Supabase.instance.client.from('user_preferences').upsert({
        'user_id':        user.id,
        'followed_teams': teams,
        'updated_at':     DateTime.now().toIso8601String(),
      }, onConflict: 'user_id');
    }
  }

  // On login: merge device prefs with account
  Future<void> syncOnLogin() async {
    final user  = Supabase.instance.client.auth.currentUser!;
    final local = (await SharedPreferences.getInstance())
      .getStringList('followed_teams') ?? [];

    final remote = await Supabase.instance.client
      .from('user_preferences')
      .select('followed_teams')
      .eq('user_id', user.id)
      .maybeSingle();

    if (remote == null) {
      await saveFollowedTeams(local);        // First login: push local → remote
    } else {
      final p = await SharedPreferences.getInstance();
      await p.setStringList('followed_teams',   // Existing account: pull remote → local
        List<String>.from(remote['followed_teams'] ?? []));
    }
  }
}
```

---

## 8. Caching Strategy

| Data | Source | Cached In | TTL | Refresh |
|---|---|---|---|---|
| News articles | ESPN RSS | `stories` | 7 days | pg_cron 30 min |
| AI summary + analysis | Claude (once per article) | `stories.ai_*` | Never expire | On article insert |
| Live scores | BallDontLie | `games` | — | pg_cron 5 min |
| Final scores | BallDontLie | `games` | 3 days | After status=final |
| Standings | BallDontLie | `standings` | — | pg_cron 1 hr |
| Team metadata | TheSportsDB | `teams` | 7 days | On first request |
| Story detail | Assembled from Postgres | Flutter memory | Session | On screen open |
| User prefs | — | SharedPrefs + Supabase | Forever | On change |

**Key insight:** Claude runs once per article on ingest, result cached forever. The 500th person to open a story sees the same AI analysis instantly, with zero incremental API cost.

---

## 9. Share Links

```dart
// core/router.dart
final router = GoRouter(routes: [
  GoRoute(path: '/', builder: (_, __) => const FeedScreen()),
  GoRoute(
    path: '/story/:id',
    builder: (_, state) => StoryScreen(
      storyId: state.pathParameters['id']!,
    ),
  ),
]);

// features/story/story_screen.dart
void _share(Story story) {
  final url = 'https://yourdomain.com/story/${story.id}';
  Share.share('${story.headline}\n\n$url');
  Analytics.shareLink(story.id);
}
```

**Deep link setup required in:**
- iOS: `ios/Runner/Info.plist` — `CFBundleURLSchemes` + Associated Domains entitlement
- Android: `android/app/src/main/AndroidManifest.xml` — `intent-filter` with `autoVerify="true"`

---

## 10. Mixpanel Events

```dart
// shared/analytics.dart
class Analytics {
  static late Mixpanel _mp;
  static Future<void> init() async =>
    _mp = await Mixpanel.init('YOUR_TOKEN', trackAutomaticEvents: true);

  static void storyViewed(Story s, {required String source}) =>
    _mp.track('story_viewed', properties: {
      'story_id': s.id,
      'league':   s.league,
      'teams':    s.teamTags,
      'is_hot':   s.isHot,
      'source':   source,   // 'feed' | 'share_link' | 'related'
    });

  static void teamFollowed(String team, List<String> all) {
    _mp.track('team_followed', properties: {'team': team});
    _mp.getPeople().set('followed_teams', all);
  }

  static void shareLink(String storyId) =>
    _mp.track('share_link_generated', properties: {'story_id': storyId});

  static void tabChanged(String tab) =>
    _mp.track('tab_changed', properties: {'tab': tab});
}
```

**Key signals to watch:**
- `story_viewed` where `source=share_link` — virality
- `team_followed` frequency — which teams to weight in the feed algorithm
- `story_viewed` by `teams` — which teams' content drives engagement

---

## 11. Cost Breakdown

### Monthly at Personal Scale (~5 users)

| Service | Plan | Cost/mo |
|---|---|---|
| Supabase | Free tier | $0 |
| BallDontLie | All-Star × 2 sports (NBA + NFL) | $19.98 |
| ESPN RSS | Official, documented, free | $0 |
| TheSportsDB | Free tier (metadata only) | $0 |
| Claude Haiku | ~500 new articles × ~$0.001 | ~$0.50 |
| **Total** | | **~$20.48/mo** |

### Why $20/mo beats $0 hidden ESPN API

The hidden API would have required a Supabase caching layer specifically to protect against its instability — meaning you were paying the architectural complexity cost either way, without the reliability. With BallDontLie:

- Documented endpoints that don't change without notice
- Official support channel if something breaks
- The Edge Functions you write today are the ones you keep forever
- No surprise breakage during playoffs

### Supabase Free Tier Headroom

- Database: 500 MB limit — you'll use ~50 MB
- Edge Function invocations: 500,000/mo — you'll use ~5,000
- Realtime connections: 200 concurrent

---

## 12. Upgrade Path

```
Phase 1 — Now (~$20.48/mo)
  BallDontLie All-Star NBA + NFL
  ESPN RSS for news
  Claude Haiku for AI summaries
  Supabase free tier
  ✓ Fully production-ready from day one. No migrations needed, ever.

Phase 2 — More sports (add any time, ~$10/sport)
  Add BallDontLie All-Star for MLB, NHL, etc.
  Add ESPN RSS: /espn/rss/mlb/news, /espn/rss/nhl/news
  One new Edge Function per league. Flutter feed requires zero changes.

Phase 3 — Push notifications ($0 additional cost)
  BallDontLie All-Star already includes webhooks.
  Wire: BallDontLie score event → Supabase Edge Function → FCM → Flutter
  "Lakers up 10 with 2 min left in Q4"

Phase 4 — More users, ~$45/mo
  Supabase Pro ($25/mo) for better DB performance + guaranteed uptime
  Total: ~$45/mo for a polished multi-sport app with push notifications

Phase 5 — Public launch (if ever)
  Add proper user account management (already scaffolded)
  Supabase Storage for cached team logos (removes TheSportsDB dependency)
  Upgrade to Sportradar or Stats Perform if enterprise SLA needed
```

---

*Architecture designed for: Flutter 3.x · Supabase v2 · Deno Edge Functions · BallDontLie v1 API · March 2026*
