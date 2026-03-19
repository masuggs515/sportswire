/**
 * fetch-scores/index.ts
 *
 * ⚠️  DEPRECATED — 2026-03-19
 *
 * NBA and NFL scores are now fetched via ESPN hidden API in:
 *   - supabase/functions/fetch-nba-scores/index.ts
 *   - supabase/functions/fetch-nfl-scores/index.ts
 *
 * This function remains in place (not deleted) so the cron job
 * can be unscheduled gracefully. The BALLDONTLIE_API_KEY secret
 * is retained in Supabase secrets for potential future use.
 *
 * The cron job 'fetch-scores' should be unscheduled via:
 *   SELECT cron.unschedule('fetch-scores');
 *
 * Original logic:
 *  1. Call shouldPollScores() — skip if outside game hours or full offseason
 *  2. Fetch today + tomorrow games from BallDontLie for NBA and NFL
 *  3. Normalize status string to 'scheduled' | 'in_progress' | 'final'
 *  4. Upsert each game to `games` table on external_id conflict
 *  5. Return HTTP 200 even on rate limit errors (prevents Supabase Cron alert spam)
 *
 * BDL requests per active run: 2 (NBA + NFL)
 * BDL requests when skipped:   0
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bdlFetch, shouldPollScores } from "../_shared/bdl_client.ts";

serve(async () => {
  // ── Startup diagnostics — logged on every invocation ─────────────────────
  // Tells us immediately which secrets are missing without exposing values.
  const supabaseUrl  = Deno.env.get("SUPABASE_URL");
  const secretKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bdlKey       = Deno.env.get("BALLDONTLIE_API_KEY");

  console.log("[fetch-scores] env check:", {
    SUPABASE_URL:             supabaseUrl  ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: secretKey    ? "SET" : "MISSING",
    BALLDONTLIE_API_KEY: bdlKey       ? "SET" : "MISSING",
  });

  // Outer try/catch — catches anything that was previously escaping to a 500,
  // including createClient() failures and unexpected import errors.
  try {
    // Gate: skip entirely if no games are likely active right now
    if (!shouldPollScores()) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "outside-game-window" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl!, secretKey!);

    // Build date params: today and tomorrow in YYYY-MM-DD
    const today    = todayUTC();
    const tomorrow = tomorrowUTC();

    let nbaInserted = 0;
    let nflInserted = 0;

    // ── NBA games ───────────────────────────────────────────────────────────
    const nbaData = await bdlFetch(
      `/nba/v1/games?per_page=25&dates[]=${today}&dates[]=${tomorrow}`
    );

    for (const game of nbaData.data ?? []) {
      const nbaStatus = normalizeStatus(game.status);
      const { error } = await supabase.from("games").upsert({
        external_id:  String(game.id),
        league:       "NBA",
        home_team:    game.home_team?.abbreviation ?? "",
        away_team:    game.visitor_team?.abbreviation ?? "",
        home_score:   game.home_team_score ?? 0,
        away_score:   game.visitor_team_score ?? 0,
        status:       nbaStatus,
        game_time:    game.date ?? null,
        // BDL puts display text in game.status for active games ("Q2 4:32", "Halftime").
        // Scheduled games: null. Final: "Final". Never store ISO datetime in period.
        period:       nbaStatus === "final"       ? "Final"
                    : nbaStatus === "in_progress" ? (game.status ?? null)
                    : null,
        fetched_at:   new Date().toISOString(),
      }, { onConflict: "external_id" });

      if (error) {
        console.error(`[fetch-scores] NBA upsert failed for game ${game.id}:`, error.message);
      } else {
        nbaInserted++;
      }
    }

    // ── NFL games — seasonal gate Sep–Feb ────────────────────────────────────
    // NFL season runs September through February. Skip BDL call outside that window
    // to conserve request budget. bdl_client inserts a 300ms gap automatically.
    const nflMonth  = new Date().getUTCMonth() + 1; // 1–12
    const nflActive = nflMonth >= 9 || nflMonth <= 2;

    if (!nflActive) {
      console.log("[fetch-scores] NFL offseason — skipping NFL games");
    } else {
      const nflData = await bdlFetch(
        `/nfl/v1/games?per_page=25&dates[]=${today}&dates[]=${tomorrow}`
      );

      for (const game of nflData.data ?? []) {
        const nflStatus = normalizeStatus(game.status);
        const { error } = await supabase.from("games").upsert({
          external_id:  `nfl_${game.id}`,
          league:       "NFL",
          home_team:    game.home_team?.abbreviation ?? "",
          away_team:    game.away_team?.abbreviation ?? "",
          home_score:   game.home_team_score ?? 0,
          away_score:   game.away_team_score ?? 0,
          status:       nflStatus,
          game_time:    game.date ?? null,
          // BDL NFL uses game.quarter (1-4) for active games.
          // Scheduled games: null. Final: "Final". Never store ISO datetime in period.
          period:       nflStatus === "final"       ? "Final"
                      : nflStatus === "in_progress" ? (game.quarter ? `Q${game.quarter}` : (game.status ?? null))
                      : null,
          fetched_at:   new Date().toISOString(),
        }, { onConflict: "external_id" });

        if (error) {
          console.error(`[fetch-scores] NFL upsert failed for game ${game.id}:`, error.message);
        } else {
          nflInserted++;
        }
      }
    }

    console.log(`[fetch-scores] Done. NBA=${nbaInserted} NFL=${nflInserted}`);

    return new Response(JSON.stringify({ ok: true, nbaInserted, nflInserted }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    // Surface the real error — status 500 so it's visible in dashboard + curl.
    // Once the root cause is identified and fixed this will go back to 200
    // to prevent Supabase Cron alert spam.
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack   : undefined;
    console.error("[fetch-scores] Unhandled error:", message, stack);
    return new Response(JSON.stringify({ ok: false, error: message, stack }), {
      status:  500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ─── Status normalizer ────────────────────────────────────────────────────────

function normalizeStatus(s: string | null | undefined): string {
  const lower = (s ?? "").toLowerCase();
  if (lower.includes("final"))                                         return "final";
  if (lower.includes("progress") || lower.includes("quarter") ||
      lower.includes("half")     || lower.includes("period"))          return "in_progress";
  return "scheduled";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function tomorrowUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
