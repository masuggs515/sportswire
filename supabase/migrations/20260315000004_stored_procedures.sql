-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Migration 004: Stored Procedures
-- ─────────────────────────────────────────────────────────────────────────────

-- ── increment_story_views ─────────────────────────────────────────────────────
-- Called by get-story-detail Edge Function on every story open.
-- Atomically increments view_count on stories and inserts a story_views row.
-- Device ID is optional — anonymous calls still increment the counter.
CREATE OR REPLACE FUNCTION increment_story_views(story_id UUID, viewer_device_id TEXT DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE stories
    SET view_count = view_count + 1
    WHERE id = story_id;

  INSERT INTO story_views(story_id, device_id)
    VALUES (story_id, viewer_device_id);
$$;

-- SECURITY DEFINER: this function runs as the DB owner so it can INSERT into
-- story_views even when called without a service_role key. The caller (Flutter
-- via get-story-detail) provides the storyId — no data mutation beyond this row.
