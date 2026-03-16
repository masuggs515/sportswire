/**
 * supabase/tests/rls_test.ts
 *
 * Verifies Row Level Security policies on every table.
 * Requires a running Supabase instance (local or cloud).
 *
 * Run with:
 *   SUPABASE_URL=http://localhost:54321 \
 *   SUPABASE_PUBLISHABLE_KEY=<anon-key> \
 *   deno test supabase/tests/rls_test.ts --allow-env --allow-net
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")     ?? "http://localhost:54321";
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

// ── Public read: content tables ────────────────────────────────────────────────

Deno.test("RLS: anonymous user can SELECT from stories", async () => {
  const { error } = await anonClient().from("stories").select("id").limit(1);
  assertEquals(error, null, `Expected no error, got: ${error?.message}`);
});

Deno.test("RLS: anonymous user can SELECT from games", async () => {
  const { error } = await anonClient().from("games").select("id").limit(1);
  assertEquals(error, null, `Expected no error, got: ${error?.message}`);
});

Deno.test("RLS: anonymous user can SELECT from standings", async () => {
  const { error } = await anonClient().from("standings").select("id").limit(1);
  assertEquals(error, null, `Expected no error, got: ${error?.message}`);
});

Deno.test("RLS: anonymous user can SELECT from teams", async () => {
  const { error } = await anonClient().from("teams").select("abbr").limit(1);
  assertEquals(error, null, `Expected no error, got: ${error?.message}`);
});

// ── No client writes on content tables ────────────────────────────────────────
// Flutter must never write to stories, games, or standings. Service role only.

Deno.test("RLS: anonymous user cannot INSERT into stories", async () => {
  const client = anonClient();
  const { error } = await client.from("stories").insert({
    external_id: "rls-test-exploit",
    league:      "NBA",
    headline:    "RLS test — should fail",
    article_url: "https://example.com",
  });
  assertNotEquals(error, null, "Expected INSERT to be rejected by RLS but it succeeded");
});

Deno.test("RLS: anonymous user cannot INSERT into games", async () => {
  const client = anonClient();
  const { error } = await client.from("games").insert({
    external_id: "rls-test-game",
    league:      "NBA",
    home_team:   "LAL",
    away_team:   "BOS",
  });
  assertNotEquals(error, null, "Expected INSERT to be rejected by RLS but it succeeded");
});

Deno.test("RLS: anonymous user cannot INSERT into standings", async () => {
  const client = anonClient();
  const { error } = await client.from("standings").insert({
    league:    "NBA",
    team_abbr: "LAL",
    team_name: "Los Angeles Lakers",
  });
  assertNotEquals(error, null, "Expected INSERT to be rejected by RLS but it succeeded");
});

Deno.test("RLS: anonymous user cannot UPDATE stories", async () => {
  const client = anonClient();
  const { error } = await client
    .from("stories")
    .update({ is_hot: true })
    .eq("league", "NBA");
  assertNotEquals(error, null, "Expected UPDATE to be rejected by RLS but it succeeded");
});

// ── story_views: insert allowed, select not ────────────────────────────────────

Deno.test("RLS: anonymous user cannot SELECT from story_views", async () => {
  const client = anonClient();
  const { error } = await client.from("story_views").select("id").limit(1);
  assertNotEquals(error, null, "Expected SELECT on story_views to be denied");
});
