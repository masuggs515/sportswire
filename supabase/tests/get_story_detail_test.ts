/**
 * supabase/tests/get_story_detail_test.ts
 *
 * Integration tests for the get-story-detail Edge Function.
 * Requires a running Supabase instance with seeded data.
 *
 * Run with:
 *   SUPABASE_URL=http://localhost:54321 \
 *   SUPABASE_PUBLISHABLE_KEY=<anon-key> \
 *   SUPABASE_SECRET_KEY=<service-role-key> \
 *   deno test supabase/tests/get_story_detail_test.ts --allow-env --allow-net
 *
 * Note: These tests insert a story via service_role, call the function,
 * then clean up. They require a live Supabase instance.
 */

import {
  assertEquals,
  assertNotEquals,
  assert,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")            ?? "http://localhost:54321";
const SUPABASE_PUBLISHABLE_KEY       = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")       ?? "";
const SUPABASE_SECRET_KEY = Deno.env.get("SUPABASE_SECRET_KEY") ?? "";

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
}

// ── Helper: seed a test story ─────────────────────────────────────────────────

async function seedTestStory(): Promise<string> {
  const { data, error } = await serviceClient()
    .from("stories")
    .insert({
      external_id:  `test-${Date.now()}`,
      league:       "NBA",
      team_tags:    ["LAL", "BOS"],
      headline:     "Test Story: Lakers vs Celtics Rivalry Continues",
      rss_summary:  "Test description.",
      ai_summary:   "Lakers and Celtics meet again in a historic rivalry game.",
      ai_analysis:  "LeBron James showed dominant form. The Celtics responded with three-point shooting. Watch for a potential playoff rematch.",
      article_url:  "https://www.espn.com/nba/story/_/id/test",
      published_at: new Date().toISOString(),
      is_hot:       false,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to seed test story: ${error?.message}`);
  return data.id;
}

async function cleanupTestStory(id: string): Promise<void> {
  await serviceClient().from("story_views").delete().eq("story_id", id);
  await serviceClient().from("stories").delete().eq("id", id);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

Deno.test("get-story-detail: returns 404 for unknown storyId", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-story-detail`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ storyId: "00000000-0000-0000-0000-000000000000" }),
  });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertNotEquals(body.error, undefined);
});

Deno.test("get-story-detail: returns 400 for missing storyId", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-story-detail`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 400);
});

Deno.test("get-story-detail: returns correct payload shape for seeded story", async () => {
  const storyId = await seedTestStory();

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-story-detail`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ storyId }),
    });

    assertEquals(res.status, 200);
    const body = await res.json();

    // Required top-level keys
    assert("story"         in body, "Response missing 'story'");
    assert("recentGames"   in body, "Response missing 'recentGames'");
    assert("upcomingGames" in body, "Response missing 'upcomingGames'");
    assert("standings"     in body, "Response missing 'standings'");
    assert("related"       in body, "Response missing 'related'");
    assert("teams"         in body, "Response missing 'teams'");

    // Story fields
    assertEquals(body.story.id, storyId);
    assertEquals(body.story.league, "NBA");
    assertEquals(body.story.headline, "Test Story: Lakers vs Celtics Rivalry Continues");

    // Arrays (may be empty if no seed data for games/standings)
    assert(Array.isArray(body.recentGames),   "recentGames should be an array");
    assert(Array.isArray(body.upcomingGames), "upcomingGames should be an array");
    assert(Array.isArray(body.standings),     "standings should be an array");
    assert(Array.isArray(body.related),       "related should be an array");
    assert(Array.isArray(body.teams),         "teams should be an array");

  } finally {
    await cleanupTestStory(storyId);
  }
});

Deno.test("get-story-detail: increments view_count on story after call", async () => {
  const storyId = await seedTestStory();

  try {
    // Get initial view count
    const { data: before } = await serviceClient()
      .from("stories")
      .select("view_count")
      .eq("id", storyId)
      .single();

    const initialCount = before?.view_count ?? 0;

    // Call the function
    await fetch(`${SUPABASE_URL}/functions/v1/get-story-detail`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ storyId }),
    });

    // Wait briefly for async increment
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check updated count
    const { data: after } = await serviceClient()
      .from("stories")
      .select("view_count")
      .eq("id", storyId)
      .single();

    assertEquals(after?.view_count, initialCount + 1);

  } finally {
    await cleanupTestStory(storyId);
  }
});
