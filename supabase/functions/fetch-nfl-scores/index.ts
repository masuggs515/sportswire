/**
 * fetch-nfl-scores/index.ts
 *
 * Triggered by Supabase Cron every 1 minute.
 *
 * Fetches today's NFL games from the ESPN public scoreboard API.
 * No auth required. On any ESPN fetch error, returns { ok: true, skipped: true }
 * so the cron job never alerts.
 *
 * Seasonal gate: September–February (months 9–12, 1–2).
 * Stores full competitors JSON (logos, linescores, leaders, situation) in details JSONB column.
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[fetch-nfl-scores] env check:", {
    SUPABASE_URL:              supabaseUrl ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: secretKey   ? "SET" : "MISSING",
  });

  // ── Seasonal gate: NFL season September–February ──────────────────────────
  const month = new Date().getUTCMonth() + 1; // 1–12
  const nflActive = month >= 9 || month <= 2;
  if (!nflActive) {
    console.log("[fetch-nfl-scores] NFL offseason — skipping");
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "nfl-offseason" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Fetch from ESPN ───────────────────────────────────────────────────────
  let espnData: any;
  try {
    const res = await fetch(ESPN_URL);
    if (!res.ok) {
      console.warn(`[fetch-nfl-scores] ESPN returned HTTP ${res.status}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "espn-fetch-error" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    espnData = await res.json();
  } catch (fetchErr) {
    console.warn("[fetch-nfl-scores] ESPN fetch threw:", fetchErr);
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "espn-fetch-error" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const events: any[] = espnData?.events ?? [];
  if (events.length === 0) {
    console.log("[fetch-nfl-scores] No events returned from ESPN");
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
      const state     = event.status?.type?.state ?? "pre";
      const completed = event.status?.type?.completed ?? false;
      const status: "scheduled" | "in_progress" | "final" =
        completed || state === "post" ? "final"
        : state === "in"             ? "in_progress"
        : "scheduled";

      // ── Period and clock ────────────────────────────────────────────────
      // period = quarter number (1–4, plus OT)
      // clock  = human-readable detail e.g. "4th Qtr 2:14", "Final", "Halftime"
      const period = event.status?.period != null
        ? String(event.status.period)
        : null;
      const clock  = event.status?.type?.detail ?? null;

      // ── Scores ──────────────────────────────────────────────────────────
      const homeScore = parseInt(homeComp.score ?? "0", 10) || 0;
      const awayScore = parseInt(awayComp.score ?? "0", 10) || 0;

      // ── Build details JSONB ─────────────────────────────────────────────
      const details = {
        competitors: competitors.map((c: any) => ({
          homeAway:   c.homeAway,
          team: {
            displayName:  c.team?.displayName ?? "",
            abbreviation: c.team?.abbreviation ?? "",
            color:        c.team?.color ?? "",
            logo:         c.team?.logo ?? "",
          },
          score:      c.score ?? "0",
          linescores: (c.linescores ?? []).map((ls: any) => ({
            period:       ls.period ?? ls.value,
            displayValue: ls.displayValue ?? "0",
          })),
          statistics: (c.statistics ?? []).map((s: any) => ({
            name:         s.name ?? "",
            displayValue: s.displayValue ?? "",
          })),
          leaders: (c.leaders ?? []).map((l: any) => ({
            name: l.name ?? "",
            leaders: (l.leaders ?? []).slice(0, 1).map((ll: any) => ({
              athlete: {
                fullName: ll.athlete?.fullName ?? "",
                headshot: ll.athlete?.headshot?.href ?? null,
              },
              displayValue: ll.displayValue ?? "",
            })),
          })),
          records: (c.records ?? []).slice(0, 1).map((r: any) => ({
            summary: r.summary ?? "",
          })),
        })),
        situation:        competition.situation ?? null,
        featuredAthletes: competition.status?.featuredAthletes ?? null,
        broadcast:        competition.broadcast ?? null,
        seasonType:       event.season?.type ?? null,
        seasonSlug:       event.season?.slug ?? null,
      };

      const { error } = await supabase.from("games").upsert(
        {
          external_id: `nfl_${event.id}`,
          league:      "NFL",
          home_team:   homeComp.team?.displayName ?? homeComp.team?.abbreviation ?? "",
          away_team:   awayComp.team?.displayName ?? awayComp.team?.abbreviation ?? "",
          home_score:  homeScore,
          away_score:  awayScore,
          status,
          game_time:   event.date ?? null,
          period,
          clock,
          broadcast:   competition.broadcast ?? null,
          details,
          fetched_at:  new Date().toISOString(),
        },
        { onConflict: "external_id" }
      );

      if (error) {
        console.error(`[fetch-nfl-scores] upsert failed for event ${event.id}:`, error.message);
        errored++;
      } else {
        upserted++;
      }
    } catch (eventErr) {
      console.error(`[fetch-nfl-scores] error processing event ${event.id}:`, eventErr);
      errored++;
    }
  }

  console.log(`[fetch-nfl-scores] Done. upserted=${upserted} errored=${errored} total=${events.length}`);

  return new Response(
    JSON.stringify({ ok: true, upserted, errored }),
    { headers: { "Content-Type": "application/json" } }
  );
});
