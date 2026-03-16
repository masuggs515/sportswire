/**
 * get-story-detail/index.ts
 *
 * Called by Flutter when a user taps a story card.
 * Assembles the full story view payload in a single round trip.
 *
 * Input:  { "storyId": "<uuid>" }
 * Output: { story, recentGames, upcomingGames, standings, related, teams }
 *
 * BDL requests: 0 — reads exclusively from Postgres cache.
 * This function must never call BallDontLie directly.
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Parse request body
  let storyId: string;
  try {
    const body = await req.json();
    storyId = body.storyId;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body — expected { storyId }" }), {
      status:  400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!storyId || typeof storyId !== "string") {
    return new Response(JSON.stringify({ error: "storyId is required" }), {
      status:  400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Fetch the story itself
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .single();

  if (storyError || !story) {
    return new Response(JSON.stringify({ error: "Story not found" }), {
      status:  404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tags: string[] = Array.isArray(story.team_tags) ? story.team_tags : [];
  const league: string = story.league;

  // Build tag OR filter for games queries
  // e.g. "home_team.eq.LAL,away_team.eq.LAL,home_team.eq.DEN,away_team.eq.DEN"
  const tagFilter = tags.length > 0
    ? tags.flatMap(t => [`home_team.eq.${t}`, `away_team.eq.${t}`]).join(",")
    : null;

  // 2. Recent final games for the story's team tags (last 4, same league)
  let recentGames: any[] = [];
  if (tagFilter) {
    const { data } = await supabase
      .from("games")
      .select("id, league, home_team, away_team, home_score, away_score, status, game_time, period")
      .eq("league", league)
      .eq("status", "final")
      .or(tagFilter)
      .order("game_time", { ascending: false })
      .limit(4);
    recentGames = data ?? [];
  }

  // 3. Upcoming scheduled games for the story's team tags (next 3, same league)
  let upcomingGames: any[] = [];
  if (tagFilter) {
    const { data } = await supabase
      .from("games")
      .select("id, league, home_team, away_team, status, game_time, home_win_prob")
      .eq("league", league)
      .eq("status", "scheduled")
      .or(tagFilter)
      .order("game_time", { ascending: true })
      .limit(3);
    upcomingGames = data ?? [];
  }

  // 4. Standings — disabled until BDL All-Star tier upgrade enables fetch-standings.
  //    Returns empty array so Flutter can handle gracefully (hide the section).
  //    TODO MAS: re-enable standings query when BDL tier upgraded.
  const standings: any[] = [];

  // 5. Related stories — same league, overlapping team_tags, most recent, not this story
  let related: any[] = [];
  if (tags.length > 0) {
    const { data } = await supabase
      .from("stories")
      .select("id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url")
      .eq("league", league)
      .neq("id", storyId)
      .overlaps("team_tags", tags)
      .order("published_at", { ascending: false })
      .limit(4);
    related = data ?? [];
  }

  // 6. Team metadata for display (colors, logos) — limited to tags in this story
  let teams: any[] = [];
  if (tags.length > 0) {
    const { data } = await supabase
      .from("teams")
      .select("abbr, full_name, primary_color, accent_color, logo_url")
      .in("abbr", tags)
      .eq("league", league);
    teams = data ?? [];
  }

  // 7. Increment view count (fire-and-forget — don't block on this)
  supabase.rpc("increment_story_views", { story_id: storyId }).then(({ error }) => {
    if (error) console.error("[get-story-detail] increment_story_views failed:", error.message);
  });

  return new Response(JSON.stringify({
    story,
    recentGames,
    upcomingGames,
    standings:   standings ?? [],
    related,
    teams,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
