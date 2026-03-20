# Project State
Last updated: 2026-03-19 (session 16)
Current phase: 2 — Next.js Web Feed (in progress)
Current task branch: task/standings-boxscore (PR open → dev)

**Platform pivot (2026-03-18):** Flutter replaced with Next.js 15. Supabase backend unchanged.

---

## Phase Completion

- [ ] Phase 1 — Data Foundation (complete pending Gemini ai_analysis backfill — see TODO MAS below)
- [ ] Phase 2 — Next.js Web Feed (in progress — core pages built, pending Vercel deploy + Mixpanel)
- [ ] Phase 3 — Auth & Preferences (not started)
- [ ] Phase 4 — Analytics & Polish (not started)
- [ ] Phase 5 — More Sports (future)

---

## Migration Status

| Migration | local db | sportswire-dev | sportswire-prod |
|---|---|---|---|
| 20260315000001_create_tables | not yet | ✅ applied | not yet |
| 20260315000002_rls_policies | not yet | ✅ applied | not yet |
| 20260315000003_indexes | not yet | ✅ applied | not yet |
| 20260315000004_stored_procedures | not yet | ✅ applied | not yet |
| 20260315000005_seed_teams | not yet | ✅ applied | not yet |
| 20260315000006_cron_schedule | not yet | ✅ applied | not yet |
| 20260319000007_ncaab_cron | not yet | ✅ applied | not yet |
| 20260319000008_ncaab_cron_1min | not yet | ✅ applied | not yet |
| 20260319000009_espn_scores_columns | not yet | ✅ applied | not yet |
| 20260319000010_espn_scores_cron | not yet | ✅ applied | not yet |
| 20260319000011_add_favorite_teams | not yet | ✅ applied | not yet |

---

## Open PRs

- PR #1: `task/phase1-data-foundation` → `dev` — https://github.com/masuggs515/sportswire/pull/1
- PR #2: `task/phase2-flutter-feed` → `dev` — https://github.com/masuggs515/sportswire/pull/2 (superseded by pivot — close without merging)
- PR #3: `task/phase2-nextjs-web` → `dev` — MERGED 2026-03-19
- PR #4: `task/ncaab-scores-espn` → `dev` — (URL pending push)
- PR #5: `task/espn-scores-overhaul` → `dev` — (URL pending push)
- PR #6: `task/auth-favorites` → `dev` — https://github.com/masuggs515/sportswire/pull/8
- PR #7: `task/standings-boxscore` → `dev` — (URL pending push)

---

## Open TODO MAS Items

- [ ] Close PR #2 (task/phase2-flutter-feed) without merging — superseded by Next.js pivot — raised 2026-03-18
- [ ] Review and merge PR #1 (task/phase1-data-foundation → dev) — https://github.com/masuggs515/sportswire/pull/1 — raised 2026-03-16
- [ ] Vercel deployment — create Vercel project, import GitHub repo, set rootDirectory=web in Vercel dashboard settings, add env vars from web/.env.local — raised 2026-03-18
- [ ] Review and merge PR #4 (task/ncaab-scores-espn → dev) — (URL pending push) — raised 2026-03-19
- [ ] Review and merge PR #5 (task/espn-scores-overhaul → dev) — (URL pending push) — raised 2026-03-19
- [ ] Review and merge PR #6 (task/auth-favorites → dev) — https://github.com/masuggs515/sportswire/pull/8 — raised 2026-03-19
- [ ] Disable "Enable email confirmations" in Supabase Auth settings (Dashboard → Authentication → Providers → Email) — required for email+password login to work without confirmation flow — raised 2026-03-19
- [x] Run SQL for migrations 009 + 010 — applied via supabase db push --linked — completed 2026-03-19
- [ ] Add Mixpanel to web app — install mixpanel-browser, create lib/analytics.ts, fire events per analytics-agent-spec.md — raised 2026-03-18
- [ ] Gemini ai_analysis backfill — quota exhausted on 2026-03-16 (was using deprecated gemini-2.0-flash). Migrated to gemini-2.5-flash-lite-preview-06-17 (1,000 RPD free tier). After quota resets at midnight Pacific Time: (1) run `DELETE FROM stories;` in Supabase SQL Editor, (2) invoke fetch-news manually to re-ingest all articles with ai_analysis populating correctly — raised 2026-03-16
- [ ] Upgrade BallDontLie to All-Star tier ($9.99/sport x2 = $19.98/mo) before story detail standings work — required to enable standings in story view. After upgrading: re-enable fetch-standings cron in migration 006, redeploy fetch-standings Edge Function, restore standings query in get-story-detail — raised 2026-03-16

---

## Completed TODO MAS Items

- [x] Create Supabase project `sportswire-dev` — completed 2026-03-16
- [x] Add BALLDONTLIE_API_KEY to Supabase Vault in sportswire-dev — completed 2026-03-16
- [x] Add GOOGLE_AI_KEY to Supabase Vault in sportswire-dev — completed 2026-03-16
- [x] Create GitHub repo `sportswire` with main and dev branches — completed 2026-03-16
- [x] Enable branch protection on main and dev in GitHub — completed 2026-03-16
- [x] Apply migrations 001–005 to sportswire-dev — completed 2026-03-16
- [x] Deploy all 4 Edge Functions to sportswire-dev — completed 2026-03-16
- [x] Set BALLDONTLIE_API_KEY and GOOGLE_AI_KEY via `supabase secrets set` (CLI) — completed 2026-03-16
- [x] Fix `SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY` in all Edge Functions — completed 2026-03-16
- [x] Fix migration 005 composite PK for teams table (NBA/NFL share 13 abbreviations) — completed 2026-03-16
- [x] Fix fetch-news Gemini JSON parser — replaced `^` regex anchor strip with `indexOf("{")` / `lastIndexOf("}")` extraction; raised maxOutputTokens 400→800; reordered template JSON so analysis generates first — completed 2026-03-16
- [x] Fix fetch-scores period field — scheduled games now store null instead of ISO datetime string; in-progress NBA uses BDL display text; in-progress NFL uses Q{quarter}; final games store "Final" — completed 2026-03-16
- [x] Confirm get-story-detail deployed and responding — invoked with real story ID, returned correct payload — completed 2026-03-16
- [x] Apply migration 006 (cron schedule) to sportswire-dev — applied manually before agent sessions began; all 5 cron jobs live — completed pre-session
- [x] Create Mixpanel account and get Mint Street Sports project token — account created, token saved in password manager — completed pre-session

---

## Recent Sessions

| Date | Task | Branch | Outcome |
|---|---|---|---|
| 2026-03-15 | Spec files created | — | All spec files ready. Pre-development. |
| 2026-03-16 | Phase 1 infrastructure build | — | All migrations, Edge Functions, tests, and env templates written. Awaiting deployment. |
| 2026-03-16 | Key name corrections | — | Renamed SUPABASE_ANON_KEY→SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY→SUPABASE_SECRET_KEY across all files. Moved spec files to specs/. |
| 2026-03-16 | Deployment + debugging | — | Applied migrations 001–005. Deployed all 4 Edge Functions. Fixed runtime key name (SUPABASE_SERVICE_ROLE_KEY). Set CLI secrets. fetch-scores ✅ (16 NBA games). fetch-news ✅ (33 stories). fetch-standings ❌ BDL tier. Migration 006 not yet applied. |
| 2026-03-16 | Bug fixes + Phase 1 wrap | — | fetch-standings disabled (BDL tier). fetch-news Gemini parser fixed + redeployed. fetch-scores period field fixed + redeployed. get-story-detail confirmed working. Phase 1 complete pending Gemini ai_analysis backfill tomorrow. |
| 2026-03-16 | Phase 2 Flutter Feed | task/phase2-flutter-feed | Flutter project created. Feed screen, game ticker, story card, settings sheet, all Mixpanel events, Riverpod providers, shimmer skeletons, go_router. flutter analyze clean. Story screen is stub only (Phase 3). |
| 2026-03-16 | NCAAB news + badge fix | task/phase2-flutter-feed | Added NCAAB ESPN RSS to fetch-news. Redeployed. Fixed team badge visibility for dark-primary teams (computeLuminance fallback to accent). Updated specs. |
| 2026-03-16 | Two-layer team_tags extraction | task/phase2-flutter-feed | fetch-news: Layer 1 parses ESPN <category> tags against league-scoped lookups (NBA 30, NFL 32, NCAAB ~35 programs). Gemini fills the gap only when RSS returns zero tags. Gemini still always called for summary/analysis/is_hot. Redeployed. |
| 2026-03-18 | Platform pivot: Flutter → Next.js | task/phase2-nextjs-web | Deleted sportswire/ Flutter project. Created Next.js 15 web app (TypeScript, Tailwind, App Router). Feed page, story detail page, StoryCard, GameTicker, TeamBadge, SettingsSheet, NavBar. Supabase SSR client. localStorage prefs. vercel.json. ESLint + TypeScript clean. Updated all specs. |
| 2026-03-19 | Add scores page | task/phase2-nextjs-web | New: /scores page with LIVE→TODAY→UPCOMING→RECENT sections, league tabs, team colors, realtime, win probability. Updated GameTicker to prioritise live→upcoming. NavBar now has Feed + Scores nav links with active state. ESLint + TypeScript clean. |
| 2026-03-19 | App branding rename | task/phase2-nextjs-web | Renamed app from SportsWire to Mint Street Sports in NavBar, layout.tsx metadata, web/README.md, and spec files. Internal repo/Supabase names unchanged. |
| 2026-03-19 | NCAAB scores + NFL gate | task/ncaab-scores-espn | New fetch-ncaab-scores Edge Function (ESPN public API, Nov–Apr gate). NFL seasonal gate (Sep–Feb) in fetch-scores. ScoresClient NCAAB tab shows real scores. NFL offseason message. Migration 007 for cron. Specs updated. |
| 2026-03-19 | ESPN scores overhaul + MLB + Yankees | task/espn-scores-overhaul | Replaced BallDontLie NBA+NFL with ESPN hidden API. New fetch-nba-scores, fetch-nfl-scores, fetch-mlb-scores Edge Functions. Yankees RSS feed in fetch-news. Migration 009 adds clock/broadcast/details columns. ScoresClient upgraded: team logos, linescore tables, live situation (MLB/NFL), leaders/pitching lines. Yankees tab added to feed. MLB tab added to scores. |
| 2026-03-19 | Auth + Favorites | task/auth-favorites | Optional email+password auth (AuthModal, AuthButton). First-login onboarding overlay (OnboardingOverlay) — pick up to 2 favorite teams per league. Favorite teams stored in user_preferences JSONB (migration 011). Dynamic feed tabs based on favorites. GameTicker upgraded: compact logo+score cards, favorite-team priority ordering. Settings sheet: Favorite Teams section for logged-in users. Middleware for session refresh. lib/teams.json (92 teams with ESPN logos). |
| 2026-03-19 | Standings + Box Score | task/standings-boxscore | New /standings page (StandingsClient): NBA/NFL/MLB/NCAAB tabs, Division/Conference/League toggle, ESPN hidden API just-in-time fetch, team logos, per-league stat columns, session-level cache. Inline box score expansion on all game cards (ScoresClient): chevron opens BoxScorePanel, ESPN summary endpoint just-in-time fetch, per-sport stat tables (NBA/NCAAB starters+bench+totals, NFL passing+rushing+receiving+team stats, MLB pitching+batting). NavBar: Standings link added. No Edge Functions, no migrations. |

---

## Run Commands

| Command | What it does |
|---|---|
| `cd web && npm run dev` | Start Next.js dev server at localhost:3000. Fill in `web/.env.local` first. |
| `cd web && npm run build` | Production build. |
| `cd web && npm run lint` | ESLint check. |
| `cd web && npx tsc --noEmit` | TypeScript check. |

`web/.env.local` lives in the web/ directory and is gitignored. It must contain `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_MIXPANEL_TOKEN`.

---

## Environment Notes

- sportswire-dev: ✅ created, migrations 001–011 applied, 8 Edge Functions live (fetch-news, fetch-scores[deprecated], fetch-nba-scores, fetch-nfl-scores, fetch-mlb-scores, get-story-detail, fetch-standings, fetch-ncaab-scores), cron: fetch-scores unscheduled, fetch-nba/nfl/mlb-scores + ncaab-scores running every minute
- sportswire-prod: not yet created
- Local Supabase: not yet started
- BallDontLie: current tier does not include standings endpoint — fetch-standings disabled until upgraded
- Google AI (Gemini): model gemini-2.5-flash-lite-preview-06-17 ✅ (gemini-2.0-flash deprecated 2026-03-03), key set ✅, deployed ✅ — backfill required after quota resets at midnight Pacific Time
- GitHub: repo connected ✅, dev branch pushed ✅, PR #1 open ✅, PR #2 open (close without merging — superseded)
- Mixpanel: ✅ account created, SportsWire project created, token in password manager
- Vercel: not yet connected — TODO MAS
- Key lesson: Edge Function secrets must use `supabase secrets set` (CLI), NOT Supabase Vault UI. Runtime auto-injects `SUPABASE_SERVICE_ROLE_KEY` (old name), not `SUPABASE_SECRET_KEY`.
- Next.js key: `web/.env.local` uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not ANON_KEY) to match existing Edge Function naming convention.
