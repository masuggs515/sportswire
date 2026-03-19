/**
 * fetch-ncaab-scores/index.ts
 *
 * Triggered by Supabase Cron every 5 minutes.
 *
 * Fetches today's NCAAB games from the ESPN public scoreboard API
 * (unofficial but stable — no auth required). BallDontLie does not
 * include NCAAB on the All-Star tier, so ESPN is the only free source.
 *
 * Seasonal gate: Nov–Apr only. Returns { ok: true, skipped, reason } outside
 * that window so the cron job stays quiet during offseason.
 *
 * On any fetch/parse error: returns { ok: true, skipped: true, reason: 'espn-fetch-error' }
 * rather than HTTP 500 — prevents Supabase Cron alert spam.
 *
 * College basketball uses 2 halves (not 4 quarters).
 * Period is stored as "6:36 - 1st Half" / "6:36 - 2nd Half" for live games.
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[fetch-ncaab-scores] env check:", {
    SUPABASE_URL:              supabaseUrl ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: secretKey   ? "SET" : "MISSING",
  });

  // ── Seasonal gate: NCAAB season Nov–Apr ──────────────────────────────────
  const month = new Date().getUTCMonth() + 1; // 1–12
  const ncaabActive = month >= 11 || month <= 4;
  if (!ncaabActive) {
    console.log("[fetch-ncaab-scores] NCAAB offseason — skipping");
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "ncaab-offseason" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Fetch from ESPN ───────────────────────────────────────────────────────
  let espnData: any;
  try {
    const res = await fetch(ESPN_URL);
    if (!res.ok) {
      console.warn(`[fetch-ncaab-scores] ESPN returned HTTP ${res.status}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "espn-fetch-error" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    espnData = await res.json();
  } catch (fetchErr) {
    console.warn("[fetch-ncaab-scores] ESPN fetch threw:", fetchErr);
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "espn-fetch-error" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const events: any[] = espnData?.events ?? [];
  if (events.length === 0) {
    console.log("[fetch-ncaab-scores] No events returned from ESPN");
    return new Response(
      JSON.stringify({ ok: true, upserted: 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl!, secretKey!);
  let upserted  = 0;
  let errored   = 0;

  for (const event of events) {
    try {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      // ── Find home/away by homeAway field, NOT array order ──────────────
      const competitors: any[] = competition.competitors ?? [];
      const homeComp = competitors.find((c: any) => c.homeAway === "home");
      const awayComp = competitors.find((c: any) => c.homeAway === "away");
      if (!homeComp || !awayComp) continue;

      // ── Status mapping ──────────────────────────────────────────────────
      // ESPN state: "pre" → scheduled, "in" → in_progress, "post" → final
      const state     = event.status?.type?.state ?? "pre";
      const completed = event.status?.type?.completed ?? false;
      const status: "scheduled" | "in_progress" | "final" =
        completed || state === "post" ? "final"
        : state === "in"             ? "in_progress"
        : "scheduled";

      // ── Period (half) label for live games ─────────────────────────────
      // College basketball: period 1 = 1st Half, period 2 = 2nd Half
      const half      = competition.status?.period as number | undefined;  // 1 or 2
      const clock     = competition.status?.displayClock as string | undefined;

      let period: string | null = null;
      if (status === "in_progress") {
        const halfLabel = half === 1 ? "1st Half" : half === 2 ? "2nd Half" : null;
        period = clock && halfLabel ? `${clock} - ${halfLabel}` : halfLabel ?? null;
      } else if (status === "final") {
        period = "Final";
      }

      // ── Scores ──────────────────────────────────────────────────────────
      const homeScore = parseInt(homeComp.score ?? "0", 10) || 0;
      const awayScore = parseInt(awayComp.score ?? "0", 10) || 0;

      const { error } = await supabase.from("games").upsert(
        {
          external_id: `ncaab_${event.id}`,
          league:      "NCAAB",
          home_team:   homeComp.team?.abbreviation ?? "",
          away_team:   awayComp.team?.abbreviation ?? "",
          home_score:  homeScore,
          away_score:  awayScore,
          status,
          game_time:   event.date ?? null,
          period,
          fetched_at:  new Date().toISOString(),
        },
        { onConflict: "external_id" }
      );

      if (error) {
        console.error(
          `[fetch-ncaab-scores] upsert failed for event ${event.id}:`,
          error.message
        );
        errored++;
      } else {
        upserted++;
      }
    } catch (eventErr) {
      console.error(
        `[fetch-ncaab-scores] error processing event ${event.id}:`,
        eventErr
      );
      errored++;
    }
  }

  console.log(
    `[fetch-ncaab-scores] Done. upserted=${upserted} errored=${errored} total=${events.length}`
  );

  return new Response(
    JSON.stringify({ ok: true, upserted, errored }),
    { headers: { "Content-Type": "application/json" } }
  );
});
