-- Migration: 20260319000011_add_favorite_teams
--
-- Adds favorite_teams JSONB column to the existing user_preferences table.
-- The table was created in migration 001 with followed_teams TEXT[].
-- This adds the richer per-league structure used by the auth + onboarding flow.
--
-- favorite_teams JSON shape:
-- [
--   { "league": "MLB", "espnId": 10, "name": "New York Yankees", "abbr": "NYY" },
--   { "league": "NFL", "espnId": 3,  "name": "Chicago Bears",    "abbr": "CHI" }
-- ]
-- Max 2 per league — enforced on the frontend.
--
-- Existing RLS "Own prefs" policy (FOR ALL, auth.uid() = user_id) already covers
-- SELECT / INSERT / UPDATE for logged-in users. No new policies needed.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS favorite_teams JSONB DEFAULT '[]'::jsonb;

-- TODO MAS: After applying this migration, go to:
--   Supabase Dashboard → Authentication → Settings → Email Auth
--   → Disable "Enable email confirmations"
-- This app is for friends/family — no email verification needed.
