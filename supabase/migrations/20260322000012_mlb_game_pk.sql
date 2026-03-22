-- Add mlb_game_pk column to games table
-- Used to cross-reference MLB Stats API for play-level highlight videos
ALTER TABLE games ADD COLUMN IF NOT EXISTS mlb_game_pk TEXT;

-- TODO MAS: Apply this migration to sportswire-dev:
--   supabase db push --linked
-- SQL for manual apply if needed:
--   ALTER TABLE games ADD COLUMN IF NOT EXISTS mlb_game_pk TEXT;
