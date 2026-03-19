# Master Development Plan
**Project:** Mint Street Sports
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

Mint Street Sports is a personal sports news web app for NBA, NFL, and NCAAB, built with Next.js and Supabase as the backend. It aggregates news from ESPN RSS, scores and stats from BallDontLie, and uses Gemini Flash to generate AI summaries of articles. Users follow their teams, get a personalised feed, and tap into a full story view with scores, standings, and related stories.

**Platform pivot (2026-03-18):** Replaced Flutter mobile app with a Next.js 15 web app. Supabase backend unchanged.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Hosting | Vercel (rootDirectory: web/) |
| Backend | Supabase (Postgres + Edge Functions + Cron) |
| Scores (NBA/NFL/MLB/NCAAB) | ESPN hidden scoreboard API (unofficial, no auth, free) |
| Standings / stats | BallDontLie API (currently disabled — All-Star tier needed) |
| News | ESPN RSS (official feeds — free) |
| AI summaries | Google Gemini Flash (free tier via Google AI Studio) |
| Team metadata | TheSportsDB (free tier) |
| Analytics | Mixpanel |
| Edge Function runtime | Deno (TypeScript) |

---

## Phase Structure

### Phase 1 — Data Foundation
**Goal:** All external data flowing into Supabase. No Flutter yet. Verify everything in the Supabase dashboard.

Definition of Done:
- [ ] Supabase project created (`sportswire-dev`)
- [ ] All migrations applied: tables, indexes, RLS policies
- [ ] All Edge Functions deployed: `fetch-news`, `fetch-scores`, `fetch-standings`, `get-story-detail`
- [ ] Shared BDL client (`_shared/bdl_client.ts`) deployed with rate limiter
- [ ] All Supabase Vault secrets set: `BALLDONTLIE_API_KEY`, `GOOGLE_AI_KEY`
- [ ] Cron jobs scheduled: scores every 5 min, news every 30 min, standings every hour
- [ ] Stories table populating with real ESPN news (NBA, NFL, NCAAB)
- [ ] Games table populating with real BallDontLie scores
- [ ] Standings table populating with real BallDontLie standings
- [ ] AI summaries (ai_summary, ai_analysis) present on story rows
- [ ] `get-story-detail` returns correct assembled payload for a real story ID
- [ ] All RLS policies verified: public read on content tables, own-only on user_preferences
- [ ] Teams table seeded with NBA and NFL team data (colors, abbreviations)
- Note: NCAAB news ingested via ESPN RSS (league = 'NCAAB'). NCAAB scores deferred to Phase 5 — BallDontLie covers 350+ college teams and the UI for surfacing them requires a separate design decision.

---

### Phase 2 — Next.js Web Feed
**Goal:** Working feed page and story page deployed to Vercel.

**Platform pivot (2026-03-18):** Flutter replaced with Next.js 15 web app. See `specs/web-agent-spec.md`.

Definition of Done:
- [x] Next.js 15 project created (TypeScript, Tailwind, App Router, src/)
- [x] Supabase SSR client initialised with dev credentials
- [x] Feed page showing real stories from Supabase
- [x] Stories sorted: followed teams first, hot stories next, then chronological
- [x] League tabs (All / NBA / NFL / NCAAB) filtering correctly
- [x] Game ticker showing today's scores with realtime updates
- [x] Story card tapping opens story detail page
- [x] Story page showing: headline, AI analysis, recent scores, upcoming games, standings, related stories
- [x] "Read Full Story" opens ESPN article URL in new tab
- [x] Settings sheet: team picker, saves preferences to localStorage
- [x] Share button copies deep link URL to clipboard
- [x] ESLint clean, TypeScript clean
- [x] NCAAB scores via ESPN public scoreboard API (fetch-ncaab-scores Edge Function)
- [x] NCAAB live/today/upcoming/final sections on /scores page
- [x] NFL seasonal gate in fetch-scores (Sep–Feb only)
- [x] NFL offseason message on /scores page
- [x] ESPN-based NBA scores (fetch-nba-scores) — replaces BallDontLie
- [x] ESPN-based NFL scores (fetch-nfl-scores) — replaces BallDontLie
- [x] MLB scores via ESPN API (fetch-mlb-scores, Mar–Nov gate)
- [x] MLB tab on /scores page
- [x] Yankees RSS news feed (league='Yankees') + Yankees tab on feed page
- [x] Score cards: ESPN team logos, linescores, leaders, MLB situation, MLB pitching lines
- [ ] vercel.json configured — deploy to Vercel (TODO MAS)
- [ ] Mixpanel events (TODO MAS — add mixpanel-browser)

---

### Phase 3 — Auth & Preferences
**Goal:** Optional login, preferences sync across browsers/devices.

Definition of Done:
- [ ] App works fully without login (localStorage-only preferences)
- [ ] Optional login via magic link (Supabase Auth)
- [ ] On login: local preferences pushed to Supabase if no account exists
- [ ] On login: account preferences pulled to browser if account already exists
- [ ] user_preferences table populated on login
- [ ] Followed teams persist across browser sessions (localStorage)
- [ ] Followed teams sync to new browser after login
- [ ] Direct `/story/:id` URLs navigate correctly

---

### Phase 4 — Analytics & Polish
**Goal:** Mixpanel analytics, visual polish, performance.

Definition of Done:
- [ ] Mixpanel events firing: story_viewed, team_followed, share_link_generated, tab_changed, settings_opened
- [ ] Mixpanel dashboard showing real data
- [ ] Hot story algorithm working (10+ views in 3 hours)
- [ ] Loading skeletons shown during data fetches
- [ ] Performance: feed loads under 1 second on good connection (Next.js ISR)

---

### Phase 5 — More Sports (future)
**Goal:** Add MLB, NHL, and NCAAB scores/standings with zero web UI changes to the feed itself.

Definition of Done:
- [ ] BallDontLie All-Star added for MLB and NHL
- [ ] ESPN RSS feeds added for MLB and NHL
- [ ] New Edge Functions or updated existing ones to handle additional leagues
- [ ] League tabs updated in FeedClient.tsx to show MLB / NHL
- [ ] Teams table seeded with MLB and NHL data
- [ ] All existing tests passing with expanded league data
- [ ] NCAAB scores UI decision: how to handle 350+ teams in game ticker and story screen (design decision required before implementation)

---

## File Structure

```
mint-street-news/
  specs/
    master-development-plan.md      ← this file
    project-state.md
    manager-agent-spec.md
    supabase-agent-spec.md
    web-agent-spec.md               ← replaces flutter-agent-spec.md
    analytics-agent-spec.md
    review-agent-spec.md
    testing-agent-spec.md

  supabase/
    migrations/
      20260315000001_create_tables.sql
      20260315000002_rls_policies.sql
      20260315000003_indexes.sql
      20260315000004_stored_procedures.sql
      20260315000005_seed_teams.sql
      20260315000006_cron_schedule.sql
    functions/
      _shared/
        bdl_client.ts               ← rate-aware BallDontLie HTTP client (retained, BDL key unused for scores)
      fetch-news/
        index.ts                    ← ESPN RSS (NBA/NFL/NCAAB/Yankees) → Gemini → stories table
      fetch-scores/
        index.ts                    ← ⚠️ DEPRECATED — BallDontLie NBA+NFL (cron unscheduled 2026-03-19)
      fetch-nba-scores/
        index.ts                    ← ESPN NBA scoreboard → games table (Oct–Jun)
      fetch-nfl-scores/
        index.ts                    ← ESPN NFL scoreboard → games table (Sep–Feb)
      fetch-mlb-scores/
        index.ts                    ← ESPN MLB scoreboard → games table (Mar–Nov)
      fetch-standings/
        index.ts                    ← BallDontLie → standings table (disabled pending BDL upgrade)
      fetch-ncaab-scores/
        index.ts                    ← ESPN NCAAB scoreboard → games table (Nov–Apr)
      get-story-detail/
        index.ts                    ← assembles full story payload for web client
    tests/
      rls_test.ts
      fetch_scores_test.ts
      get_story_detail_test.ts

  web/                              ← Next.js 15 web app (new — added 2026-03-18)
    src/
      app/
        page.tsx                    ← Feed page (/)
        layout.tsx                  ← Root layout with NavBar
        story/[id]/page.tsx         ← Story detail page
      components/
        NavBar.tsx
        FeedClient.tsx
        StoryCard.tsx
        GameTicker.tsx
        StoryDetailClient.tsx
        TeamBadge.tsx
        SettingsSheet.tsx
      lib/
        types.ts
        teamConfig.ts
        supabase/client.ts
        supabase/server.ts
    .env.local                      ← gitignored
    package.json

  vercel.json                       ← deleted — rootDirectory set in Vercel dashboard instead
```

---

## External API Keys Required

| Service | Where to get it | Where it lives |
|---|---|---|
| BallDontLie | app.balldontlie.io → Account Settings → API Keys | Supabase Vault: `BALLDONTLIE_API_KEY` |
| Google Gemini | aistudio.google.com → Get API key | Supabase Vault: `GOOGLE_AI_KEY` |
| Mixpanel | mixpanel.com → Project Settings → Project Token | `web/.env.local` as `NEXT_PUBLIC_MIXPANEL_TOKEN` |
| Supabase anon key | Supabase dashboard → Project Settings → API | `web/.env.local` as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Supabase service role key | Supabase dashboard → Project Settings → API | Supabase Vault only — NEVER in web app |
