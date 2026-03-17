# Project State
Last updated: 2026-03-16 (session 6)
Current phase: 1 — Data Foundation (complete pending Gemini backfill)
Current task branch: task/phase1-data-foundation (PR #1 open → dev)

---

## Phase Completion

- [ ] Phase 1 — Data Foundation (complete pending Gemini ai_analysis backfill — see TODO MAS below)
- [ ] Phase 2 — Flutter Feed (in progress — feed screen complete, story screen stub only)
- [ ] Phase 3 — Auth & Preferences (not started)
- [ ] Phase 4 — Notifications & Polish (not started)
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

---

## Open PRs

- PR #1: `task/phase1-data-foundation` → `dev` — https://github.com/masuggs515/sportswire/pull/1

---

## Open TODO MAS Items

- [ ] Review and merge PR #1 (task/phase1-data-foundation → dev) — https://github.com/masuggs515/sportswire/pull/1 — raised 2026-03-16
- [ ] Story screen Phase 3 — full layout (score strip, standings table, related stories) per flutter-agent-spec.md §Story Screen — raised 2026-03-16
- [ ] Phase 3 — add widget tests for feed, settings, and providers per testing-agent-spec.md — raised 2026-03-16
- [ ] Upgrade BallDontLie to All-Star tier ($9.99/sport x2 = $19.98/mo) before Phase 2 — required to enable standings in story view. After upgrading: re-enable fetch-standings cron in migration 006, redeploy fetch-standings Edge Function, restore standings query in get-story-detail — raised 2026-03-16
- [ ] Gemini ai_analysis backfill — quota exhausted on 2026-03-16 (was using deprecated gemini-2.0-flash). Migrated to gemini-2.5-flash-lite-preview-06-17 (1,000 RPD free tier). After quota resets at midnight Pacific Time: (1) run `DELETE FROM stories;` in Supabase SQL Editor, (2) invoke fetch-news manually to re-ingest all articles with ai_analysis populating correctly — raised 2026-03-16

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
- [x] Create Mixpanel account and get SportsWire project token — account created, token saved in password manager — completed pre-session

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

---

## Run Commands

| Command | What it does |
|---|---|
| `bash scripts/run_dev.sh` | Run Flutter app against sportswire-dev. Loads `.env.dev` automatically. |
| `bash scripts/run_dev.sh -d <device-id>` | Target a specific device. |
| `bash scripts/run_dev.sh --release` | Release mode build against dev backend. |

`.env.dev` lives at the repo root and is gitignored via `.env.*`. It must contain `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `MIXPANEL_TOKEN`.

---

## Environment Notes

- sportswire-dev: ✅ created, all 6 migrations applied, 3 Edge Functions live (fetch-news, fetch-scores, get-story-detail), 5 cron jobs running
- sportswire-prod: not yet created
- Local Supabase: not yet started
- BallDontLie: current tier does not include standings endpoint — fetch-standings disabled until upgraded
- Google AI (Gemini): model gemini-2.5-flash-lite-preview-06-17 ✅ (gemini-2.0-flash deprecated 2026-03-03), key set ✅, deployed ✅ — backfill required after quota resets at midnight Pacific Time
- GitHub: repo connected ✅, dev branch pushed ✅, PR #1 open ✅
- Mixpanel: ✅ account created, SportsWire project created, token in password manager
- Cron note: `cleanup` and `recalc-hot` are SQL-only cron jobs — they do NOT appear in the Edge Functions list in the Supabase dashboard. This is correct and expected.
- Key lesson: Edge Function secrets must use `supabase secrets set` (CLI), NOT Supabase Vault UI. Runtime auto-injects `SUPABASE_SERVICE_ROLE_KEY` (old name), not `SUPABASE_SECRET_KEY`.
