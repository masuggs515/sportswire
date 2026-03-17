# Master Development Plan
**Project:** SportsWire  
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

SportsWire is a personal sports news app for NBA, NFL, and NCAAB, built in Flutter with Supabase as the backend. It aggregates news from ESPN RSS, scores and stats from BallDontLie, and uses Gemini Flash to generate AI summaries of articles. Users follow their teams, get a personalised feed, and tap into a full story view with scores, standings, and related stories.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | Flutter (latest stable) |
| State management | flutter_riverpod |
| Navigation + deep links | go_router |
| Backend | Supabase (Postgres + Edge Functions + Cron) |
| Scores / stats / standings | BallDontLie API (All-Star tier — $9.99/sport/mo) |
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

### Phase 2 — Flutter Feed
**Goal:** Working feed screen and story screen on device.

Definition of Done:
- [ ] Flutter project created with correct package structure
- [ ] Supabase Flutter SDK initialised with dev credentials
- [ ] Feed screen showing real stories from Supabase
- [ ] Stories sorted: followed teams first, hot stories next, then chronological
- [ ] League tabs (All / NBA / NFL) filtering correctly
- [ ] Game ticker showing today's scores and upcoming games
- [ ] Story card tapping opens story screen
- [ ] Story screen showing: headline, AI analysis, recent scores, upcoming games, standings, related stories
- [ ] "Read Full Story" opens ESPN article URL in browser
- [ ] Loading skeletons shown while data fetches
- [ ] Settings sheet: team picker, saves preferences locally
- [ ] Share link generates correct deep link URL
- [ ] App runs on Android without crashes
- [ ] App runs on iOS without crashes

---

### Phase 3 — Auth & Preferences
**Goal:** Optional login, preferences sync across devices.

Definition of Done:
- [ ] App works fully without login (device-only preferences)
- [ ] Optional login via magic link (Supabase Auth)
- [ ] On login: local preferences pushed to Supabase if no account exists
- [ ] On login: account preferences pulled to device if account already exists
- [ ] user_preferences table populated on login
- [ ] Followed teams persist across app restarts (local)
- [ ] Followed teams sync to new device after login
- [ ] Deep links open correct story on cold start

---

### Phase 4 — Notifications & Polish
**Goal:** Push notifications for followed teams, visual polish.

Definition of Done:
- [ ] BallDontLie webhook wired to Supabase Edge Function
- [ ] Push notification sent when followed team's game goes live
- [ ] Push notification sent on game final score
- [ ] Notification opens app to correct story or score
- [ ] Mixpanel events firing: story_viewed, team_followed, share_link_generated, tab_changed
- [ ] Mixpanel dashboard showing real data
- [ ] Hot story algorithm working (10+ views in 3 hours)
- [ ] App icon and splash screen final
- [ ] Performance: feed loads under 1 second on good connection

---

### Phase 5 — More Sports (future)
**Goal:** Add MLB, NHL, and NCAAB scores/standings with zero Flutter changes to the feed itself.

Definition of Done:
- [ ] BallDontLie All-Star added for MLB and NHL
- [ ] ESPN RSS feeds added for MLB and NHL
- [ ] New Edge Functions or updated existing ones to handle additional leagues
- [ ] Flutter league tabs updated to show MLB / NHL
- [ ] Teams table seeded with MLB and NHL data
- [ ] All existing tests passing with expanded league data
- [ ] NCAAB scores UI decision: how to handle 350+ teams in game ticker and story screen (design decision required before implementation)

---

## File Structure

```
sportswire/
  specs/
    master-development-plan.md      ← this file
    project-state.md
    manager-agent-spec.md
    supabase-agent-spec.md
    flutter-agent-spec.md
    analytics-agent-spec.md
    review-agent-spec.md
    testing-agent-spec.md

  supabase/
    migrations/
      20260315000001_create_tables.sql
      20260315000002_rls_policies.sql
      20260315000003_indexes.sql
      20260315000004_seed_teams.sql
    functions/
      _shared/
        bdl_client.ts               ← rate-aware BallDontLie HTTP client
      fetch-news/
        index.ts                    ← ESPN RSS → Claude → stories table
      fetch-scores/
        index.ts                    ← BallDontLie → games table
      fetch-standings/
        index.ts                    ← BallDontLie → standings table
      get-story-detail/
        index.ts                    ← assembles full story payload for Flutter
    tests/
      rls_test.ts
      fetch_scores_test.ts
      get_story_detail_test.ts

  lib/
    main.dart
    app.dart
    core/
      supabase.dart
      router.dart
      team_config.dart
    features/
      feed/
      story/
      settings/
      auth/
    shared/
      models/
      widgets/

  test/
    feed/
    story/
    settings/
```

---

## External API Keys Required

| Service | Where to get it | Where it lives |
|---|---|---|
| BallDontLie | app.balldontlie.io → Account Settings → API Keys | Supabase Vault: `BALLDONTLIE_API_KEY` |
| Google Gemini | aistudio.google.com → Get API key | Supabase Vault: `GOOGLE_AI_KEY` |
| Mixpanel | mixpanel.com → Project Settings → Project Token | Flutter `.env.dev` as `MIXPANEL_TOKEN` |
| Supabase anon key | Supabase dashboard → Project Settings → API | Flutter `.env.dev` as `SUPABASE_PUBLISHABLE_KEY` |
| Supabase service role key | Supabase dashboard → Project Settings → API | `.env.dev` only — NEVER in Flutter app |
