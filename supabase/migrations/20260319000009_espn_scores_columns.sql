-- Migration: 20260319000009_espn_scores_columns
-- Adds columns required for ESPN scoreboard data (NBA, NFL, MLB).
--
-- clock    — human-readable status string e.g. "4th Qtr 2:14", "Bot 4th", "Final"
--            Complements the existing period (quarter/inning number) column.
-- broadcast — TV/streaming network e.g. "ESPN", "TNT", "MLB.TV"
-- details  — full competitors JSONB: logos, linescores, leaders, probables,
--            situation (live at-bat/down & distance), featuredAthletes (pitching lines)

ALTER TABLE games ADD COLUMN IF NOT EXISTS clock     TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS broadcast TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS details   JSONB;
