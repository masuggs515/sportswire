/**
 * fetch-standings/index.ts
 *
 * Called by Supabase Cron every hour (at :30 to stagger from fetch-scores).
 *
 * Request budget per run:
 *   - NBA standings: 1 req
 *   - NFL standings: 1 req
 *   Total:           2 req  (easily within free tier, and only runs once/hour)
 *
 * Stagger note: cron schedule is '30 * * * *' (at :30 past each hour).
 * fetch-scores runs at every-5-min so they never fire simultaneously.
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bdlFetch, shouldRefreshStandings } from "../_shared/bdl_client.ts";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check staleness before hitting the API — extra safety net beyond the cron schedule
  const { data: lastRow } = await supabase
    .from("standings")
    .select("fetched_at")
    .eq("league", "NBA")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shouldRefreshStandings(lastRow?.fetched_at ?? null)) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "still-fresh" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ── NBA standings ─────────────────────────────────────────────────────────
    const nbaData = await bdlFetch("/nba/v1/standings");

    for (const entry of nbaData.data ?? []) {
      const { error } = await supabase.from("standings").upsert({
        league:          "NBA",
        conference:      entry.conference ?? null,
        team_abbr:       entry.team?.abbreviation ?? "",
        team_name:       entry.team?.full_name ?? "",
        wins:            entry.wins ?? 0,
        losses:          entry.losses ?? 0,
        win_pct:         safeWinPct(entry.wins, entry.losses),
        conference_rank: entry.conference_rank ?? null,
        fetched_at:      new Date().toISOString(),
      }, { onConflict: "league, team_abbr" });

      if (error) {
        console.error(`[fetch-standings] NBA upsert failed for ${entry.team?.abbreviation}:`, error.message);
      }
    }

    // ── NFL standings ─────────────────────────────────────────────────────────
    // bdl_client inserts a 300ms gap between sequential calls automatically
    const nflData = await bdlFetch("/nfl/v1/standings");

    for (const entry of nflData.data ?? []) {
      const { error } = await supabase.from("standings").upsert({
        league:          "NFL",
        conference:      entry.conference ?? null,
        team_abbr:       entry.team?.abbreviation ?? "",
        team_name:       entry.team?.full_name ?? "",
        wins:            entry.wins ?? 0,
        losses:          entry.losses ?? 0,
        win_pct:         safeWinPct(entry.wins, entry.losses),
        conference_rank: entry.conference_rank ?? null,
        fetched_at:      new Date().toISOString(),
      }, { onConflict: "league, team_abbr" });

      if (error) {
        console.error(`[fetch-standings] NFL upsert failed for ${entry.team?.abbreviation}:`, error.message);
      }
    }

  } catch (err) {
    console.error("[fetch-standings] Error:", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status:  200, // 200 to prevent Supabase Cron alert spam
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

function safeWinPct(wins: number, losses: number): number {
  const total = (wins ?? 0) + (losses ?? 0);
  return total > 0 ? (wins ?? 0) / total : 0;
}
