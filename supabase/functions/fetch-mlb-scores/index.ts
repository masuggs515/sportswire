/**
 * fetch-mlb-scores/index.ts
 *
 * Triggered by Supabase Cron every 1 minute.
 *
 * Fetches today's MLB games from the ESPN public scoreboard API.
 * No auth required. On any ESPN fetch error, returns { ok: true, skipped: true }
 * so the cron job never alerts.
 *
 * Seasonal gate: March–November (months 3–11).
 * Stores full competitors JSON (logos, linescores, leaders, probables, situation)
 * in details JSONB column. MLB-specific: featuredAthletes for final game pitching lines,
 * situation for live at-bat/baserunner state.
 *
 * Also fetches MLB Stats API schedule to cross-reference gamePk for highlight videos.
 * Stored in mlb_game_pk column. MLB schedule fetch errors are non-blocking.
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";

// ── MLB Stats API schedule ────────────────────────────────────────────────────
// Free, no auth. Returns games for a given date with team names.
function mlbScheduleUrl(dateStr: string): string {
  return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}&hydrate=team`;
}

// ── Team name fuzzy matching ──────────────────────────────────────────────────
// ESPN uses full display names e.g. "New York Yankees".
// MLB Stats API also uses full names. Direct match is usually sufficient;
// fallback to last-word (nickname) comparison for edge cases.
function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function teamLastWord(name: string): string {
  const parts = normalise(name).split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

function teamNamesMatch(espnName: string, mlbName: string): boolean {
  const e = normalise(espnName);
  const m = normalise(mlbName);
  if (e === m) return true;
  if (e.includes(m) || m.includes(e)) return true;
  // nickname fallback
  if (teamLastWord(espnName) === teamLastWord(mlbName)) return true;
  return false;
}

// ── Build gamePk lookup map from MLB schedule ─────────────────────────────────
// Returns Map keyed by "awayTeamName|homeTeamName" → gamePk
async function buildGamePkMap(dateStr: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(mlbScheduleUrl(dateStr));
    if (!res.ok) {
      console.warn(`[fetch-mlb-scores] MLB schedule returned HTTP ${res.status}`);
      return map;
    }
    const data: any = await res.json();
    const mlbGames: any[] = data?.dates?.[0]?.games ?? [];
    for (const g of mlbGames) {
      const pk   = g.gamePk;
      const home = g.teams?.home?.team?.name ?? "";
      const away = g.teams?.away?.team?.name ?? "";
      if (pk && home && away) {
        map.set(`${away}|${home}`, pk);
      }
    }
    console.log(`[fetch-mlb-scores] MLB schedule fetched: ${map.size} games for ${dateStr}`);
  } catch (err) {
    console.warn("[fetch-mlb-scores] MLB schedule fetch error (non-blocking):", err);
  }
  return map;
}

// ── Look up gamePk for an ESPN event ─────────────────────────────────────────
function findGamePk(
  espnHomeTeam: string,
  espnAwayTeam: string,
  gamePkMap: Map<string, number>
): number | null {
  for (const [key, pk] of gamePkMap.entries()) {
    const [mapAway, mapHome] = key.split("|");
    if (teamNamesMatch(espnHomeTeam, mapHome) && teamNamesMatch(espnAwayTeam, mapAway)) {
      return pk;
    }
  }
  return null;
}

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[fetch-mlb-scores] env check:", {
    SUPABASE_URL:              supabaseUrl ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: secretKey   ? "SET" : "MISSING",
  });

  // ── Seasonal gate: MLB season March–November ──────────────────────────────
  const now   = new Date();
  const month = now.getUTCMonth() + 1; // 1–12
  const mlbActive = month >= 3 && month <= 11;
  if (!mlbActive) {
    console.log("[fetch-mlb-scores] MLB offseason — skipping");
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "mlb-offseason" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Fetch from ESPN ───────────────────────────────────────────────────────
  let espnData: any;
  try {
    const res = await fetch(ESPN_URL);
    if (!res.ok) {
      console.warn(`[fetch-mlb-scores] ESPN returned HTTP ${res.status}`);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "espn-fetch-error" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    espnData = await res.json();
  } catch (fetchErr) {
    console.warn("[fetch-mlb-scores] ESPN fetch threw:", fetchErr);
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "espn-fetch-error" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const events: any[] = espnData?.events ?? [];
  if (events.length === 0) {
    console.log("[fetch-mlb-scores] No events returned from ESPN");
    return new Response(
      JSON.stringify({ ok: true, upserted: 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Fetch MLB schedule once for today ─────────────────────────────────────
  // Use UTC date since ESPN game dates are UTC-based; MLB schedule date param is YYYY-MM-DD.
  const dateStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const gamePkMap = await buildGamePkMap(dateStr);

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
      const period = event.status?.period != null
        ? String(event.status.period)
        : null;
      const clock  = event.status?.type?.detail ?? null;

      // ── Scores ──────────────────────────────────────────────────────────
      const homeScore = parseInt(homeComp.score ?? "0", 10) || 0;
      const awayScore = parseInt(awayComp.score ?? "0", 10) || 0;

      // ── MLB gamePk from Stats API ────────────────────────────────────────
      const homeTeamName = homeComp.team?.displayName ?? homeComp.team?.abbreviation ?? "";
      const awayTeamName = awayComp.team?.displayName ?? awayComp.team?.abbreviation ?? "";
      const gamePk = gamePkMap.size > 0
        ? findGamePk(homeTeamName, awayTeamName, gamePkMap)
        : null;
      const mlbGamePkStr = gamePk != null ? String(gamePk) : null;

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
          probables: (c.probables ?? []).map((p: any) => ({
            name:    p.name ?? "",
            athlete: {
              fullName: p.athlete?.fullName ?? "",
              headshot: p.athlete?.headshot?.href ?? null,
            },
            statistics: (p.statistics ?? []).map((s: any) => ({
              name:         s.name ?? "",
              displayValue: s.displayValue ?? "",
            })),
          })),
        })),
        situation: competition.situation ?? null,
        featuredAthletes: (competition.status?.featuredAthletes ?? []).map((fa: any) => ({
          name:    fa.name ?? "",
          athlete: {
            fullName: fa.athlete?.fullName ?? "",
            headshot: fa.athlete?.headshot?.href ?? null,
          },
          statistics: (fa.statistics ?? []).map((s: any) => ({
            name:         s.name ?? "",
            displayValue: s.displayValue ?? "",
          })),
        })),
        broadcast:  competition.broadcast ?? null,
        seasonType: event.season?.type ?? null,
        seasonSlug: event.season?.slug ?? null,
      };

      const { error } = await supabase.from("games").upsert(
        {
          external_id:  `mlb_${event.id}`,
          league:       "MLB",
          home_team:    homeTeamName,
          away_team:    awayTeamName,
          home_score:   homeScore,
          away_score:   awayScore,
          status,
          game_time:    event.date ?? null,
          period,
          clock,
          broadcast:    competition.broadcast ?? null,
          details,
          mlb_game_pk:  mlbGamePkStr,
          fetched_at:   new Date().toISOString(),
        },
        { onConflict: "external_id" }
      );

      if (error) {
        console.error(`[fetch-mlb-scores] upsert failed for event ${event.id}:`, error.message);
        errored++;
      } else {
        upserted++;
        if (mlbGamePkStr) {
          console.log(`[fetch-mlb-scores] gamePk ${mlbGamePkStr} matched for ${awayTeamName} @ ${homeTeamName}`);
        }
      }
    } catch (eventErr) {
      console.error(`[fetch-mlb-scores] error processing event ${event.id}:`, eventErr);
      errored++;
    }
  }

  console.log(`[fetch-mlb-scores] Done. upserted=${upserted} errored=${errored} total=${events.length}`);

  return new Response(
    JSON.stringify({ ok: true, upserted, errored }),
    { headers: { "Content-Type": "application/json" } }
  );
});
