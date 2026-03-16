# Project State
Last updated: 2026-03-16 (session 5)
Current phase: 1 — Data Foundation (complete pending Gemini backfill)
Current task branch: none

---

## Phase Completion

- [ ] Phase 1 — Data Foundation (complete pending Gemini ai_analysis backfill — see TODO MAS below)
- [ ] Phase 2 — Flutter Feed (not started)
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
| 20260315000006_cron_schedule | not yet | not yet | not yet |

---

## Open PRs

None.

---

## Open TODO MAS Items

- [ ] Create Mixpanel account and get project token — raised 2026-03-15
- [ ] Apply migration 006 (cron schedule) to sportswire-dev — raised 2026-03-16
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

---

## Recent Sessions

| Date | Task | Branch | Outcome |
|---|---|---|---|
| 2026-03-15 | Spec files created | — | All spec files ready. Pre-development. |
| 2026-03-16 | Phase 1 infrastructure build | — | All migrations, Edge Functions, tests, and env templates written. Awaiting deployment. |
| 2026-03-16 | Key name corrections | — | Renamed SUPABASE_ANON_KEY→SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY→SUPABASE_SECRET_KEY across all files. Moved spec files to specs/. |
| 2026-03-16 | Deployment + debugging | — | Applied migrations 001–005. Deployed all 4 Edge Functions. Fixed runtime key name (SUPABASE_SERVICE_ROLE_KEY). Set CLI secrets. fetch-scores ✅ (16 NBA games). fetch-news ✅ (33 stories). fetch-standings ❌ BDL tier. Migration 006 not yet applied. |
| 2026-03-16 | Bug fixes + Phase 1 wrap | — | fetch-standings disabled (BDL tier). fetch-news Gemini parser fixed + redeployed. fetch-scores period field fixed + redeployed. get-story-detail confirmed working. Phase 1 complete pending Gemini ai_analysis backfill tomorrow. |

---

## Environment Notes

- sportswire-dev: ✅ created, migrations 001–005 applied, 3 Edge Functions live (fetch-news, fetch-scores, get-story-detail)
- sportswire-prod: not yet created
- Local Supabase: not yet started
- BallDontLie: current tier does not include standings endpoint — fetch-standings disabled until upgraded
- Google AI (Gemini): model gemini-2.5-flash-lite-preview-06-17 ✅ (gemini-2.0-flash deprecated 2026-03-03), key set ✅, deployed ✅ — backfill required after quota resets at midnight Pacific Time
- GitHub: repo created, branch protection enabled ✅
- Mixpanel: not yet set up
- Cron note: `cleanup` and `recalc-hot` are SQL-only cron jobs — they do NOT appear in the Edge Functions list in the Supabase dashboard. This is correct and expected.
- Key lesson: Edge Function secrets must use `supabase secrets set` (CLI), NOT Supabase Vault UI. Runtime auto-injects `SUPABASE_SERVICE_ROLE_KEY` (old name), not `SUPABASE_SECRET_KEY`.
