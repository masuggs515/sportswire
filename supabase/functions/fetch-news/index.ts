/**
 * fetch-news/index.ts
 *
 * Triggered by Supabase Cron at :15 and :45 past every hour.
 *
 * Logic:
 *  1. Fetch ESPN RSS for NBA, NFL, and NCAAB
 *  2. Parse XML: extract guid, title, description, link, pubDate, all <category> tags
 *  3. Skip articles already in DB (deduplication on external_id)
 *  4. Layer 1 — RSS category → team_tags: match <category> text against known team
 *     names using a league-scoped lookup. No Gemini quota spent for this.
 *  5. Layer 2 — Gemini fills the gaps: always called for ai_summary, ai_analysis,
 *     and is_hot. Also provides team_tags when Layer 1 returned zero tags.
 *  6. Upsert story to `stories` table
 *
 * BDL requests per run: 0 (ESPN RSS only — no BallDontLie calls)
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── ESPN RSS feed URLs ───────────────────────────────────────────────────────
const ESPN_RSS: Record<string, string> = {
  NBA:   "https://www.espn.com/espn/rss/nba/news",
  NFL:   "https://www.espn.com/espn/rss/nfl/news",
  NCAAB: "https://www.espn.com/espn/rss/ncb/news",
};

// ─── Gemini Flash endpoint ────────────────────────────────────────────────────
// gemini-2.0-flash deprecated 2026-03-03, retires 2026-09. Using Flash-Lite preview
// which has 1,000 RPD on the free tier — sufficient for our use case.
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent";

// ─── Team name lookup tables (league-scoped) ──────────────────────────────────
// Maps team abbreviation → lowercase name fragments to match in ESPN <category> tags.
// League-scoped to avoid collisions: ATL = Hawks in NBA, Falcons in NFL, etc.
// Any category string that includes a fragment (substring match) maps to that abbr.

const NBA_TEAM_LOOKUP: Record<string, string[]> = {
  ATL: ["atlanta hawks"],
  BOS: ["boston celtics", "celtics"],
  BKN: ["brooklyn nets", "nets"],
  CHA: ["charlotte hornets", "hornets"],
  CHI: ["chicago bulls", "bulls"],
  CLE: ["cleveland cavaliers", "cavaliers", "cavs"],
  DAL: ["dallas mavericks", "mavericks", "mavs"],
  DEN: ["denver nuggets", "nuggets"],
  DET: ["detroit pistons", "pistons"],
  GSW: ["golden state warriors", "warriors"],
  HOU: ["houston rockets", "rockets"],
  IND: ["indiana pacers", "pacers"],
  LAC: ["la clippers", "los angeles clippers", "clippers"],
  LAL: ["los angeles lakers", "lakers"],
  MEM: ["memphis grizzlies", "grizzlies"],
  MIA: ["miami heat"],
  MIL: ["milwaukee bucks", "bucks"],
  MIN: ["minnesota timberwolves", "timberwolves"],
  NOP: ["new orleans pelicans", "pelicans"],
  NYK: ["new york knicks", "knicks"],
  OKC: ["oklahoma city thunder", "thunder"],
  ORL: ["orlando magic", "magic"],
  PHI: ["philadelphia 76ers", "76ers", "sixers"],
  PHX: ["phoenix suns", "suns"],
  POR: ["portland trail blazers", "trail blazers", "blazers"],
  SAC: ["sacramento kings", "kings"],
  SAS: ["san antonio spurs", "spurs"],
  TOR: ["toronto raptors", "raptors"],
  UTA: ["utah jazz", "jazz"],
  WAS: ["washington wizards", "wizards"],
};

const NFL_TEAM_LOOKUP: Record<string, string[]> = {
  ARI: ["arizona cardinals"],
  ATL: ["atlanta falcons", "falcons"],
  BAL: ["baltimore ravens", "ravens"],
  BUF: ["buffalo bills", "bills"],
  CAR: ["carolina panthers", "panthers"],
  CHI: ["chicago bears", "bears"],
  CIN: ["cincinnati bengals", "bengals"],
  CLE: ["cleveland browns", "browns"],
  DAL: ["dallas cowboys", "cowboys"],
  DEN: ["denver broncos", "broncos"],
  DET: ["detroit lions", "lions"],
  GB:  ["green bay packers", "packers"],
  HOU: ["houston texans", "texans"],
  IND: ["indianapolis colts", "colts"],
  JAX: ["jacksonville jaguars", "jaguars"],
  KC:  ["kansas city chiefs", "chiefs"],
  LAC: ["los angeles chargers", "chargers"],
  LAR: ["los angeles rams", "rams"],
  LV:  ["las vegas raiders", "raiders"],
  MIA: ["miami dolphins", "dolphins"],
  MIN: ["minnesota vikings", "vikings"],
  NE:  ["new england patriots", "patriots"],
  NO:  ["new orleans saints", "saints"],
  NYG: ["new york giants", "giants"],
  NYJ: ["new york jets", "jets"],
  PHI: ["philadelphia eagles", "eagles"],
  PIT: ["pittsburgh steelers", "steelers"],
  SEA: ["seattle seahawks", "seahawks"],
  SF:  ["san francisco 49ers", "49ers"],
  TB:  ["tampa bay buccaneers", "buccaneers"],
  TEN: ["tennessee titans", "titans"],
  WAS: ["washington commanders", "commanders"],
};

// NCAAB: top programs by ESPN coverage volume. Abbreviations follow common ESPN usage.
// Less comprehensive than NBA/NFL — Gemini handles the long tail.
const NCAAB_TEAM_LOOKUP: Record<string, string[]> = {
  DUKE:   ["duke blue devils", "duke"],
  UNC:    ["north carolina tar heels", "north carolina"],
  UK:     ["kentucky wildcats", "kentucky"],
  KU:     ["kansas jayhawks", "kansas jayhawks"],
  UCLA:   ["ucla bruins", "ucla"],
  GONZ:   ["gonzaga bulldogs", "gonzaga"],
  ARIZ:   ["arizona wildcats", "arizona wildcats"],
  UCONN:  ["uconn huskies", "connecticut huskies", "uconn"],
  CUSE:   ["syracuse orange", "syracuse"],
  MSU:    ["michigan state spartans", "michigan state"],
  PURDUE: ["purdue boilermakers", "purdue"],
  TENN:   ["tennessee volunteers", "tennessee vols"],
  BAYLOR: ["baylor bears", "baylor"],
  HOUS:   ["houston cougars", "houston cougars"],
  MARQ:   ["marquette golden eagles", "marquette"],
  NOVA:   ["villanova wildcats", "villanova"],
  OSU:    ["ohio state buckeyes", "ohio state"],
  IU:     ["indiana hoosiers", "indiana hoosiers"],
  UVA:    ["virginia cavaliers", "virginia cavaliers"],
  OU:     ["oklahoma sooners", "oklahoma sooners"],
  LSU:    ["lsu tigers", "lsu"],
  AUB:    ["auburn tigers", "auburn"],
  IOWA:   ["iowa hawkeyes", "iowa hawkeyes"],
  ILL:    ["illinois fighting illini", "illinois fighting"],
  WISC:   ["wisconsin badgers", "wisconsin"],
  MICH:   ["michigan wolverines", "michigan wolverines"],
  ND:     ["notre dame fighting irish", "notre dame"],
  LOU:    ["louisville cardinals", "louisville"],
  PITT:   ["pittsburgh panthers", "pittsburgh panthers"],
  CLEM:   ["clemson tigers", "clemson"],
  PSU:    ["penn state nittany lions", "penn state"],
  TAMU:   ["texas a&m aggies", "texas a&m"],
  TEX:    ["texas longhorns", "texas longhorns"],
  STAN:   ["stanford cardinal", "stanford"],
  ORE:    ["oregon ducks", "oregon ducks"],
  UTAH:   ["utah utes", "utah utes"],
  COLO:   ["colorado buffaloes", "colorado buffaloes"],
  NEB:    ["nebraska cornhuskers", "nebraska"],
  MU:     ["missouri tigers", "missouri tigers"],
  WAKE:   ["wake forest demon deacons", "wake forest"],
};

const LEAGUE_LOOKUP: Record<string, Record<string, string[]>> = {
  NBA:   NBA_TEAM_LOOKUP,
  NFL:   NFL_TEAM_LOOKUP,
  NCAAB: NCAAB_TEAM_LOOKUP,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract all values of a given XML tag from an RSS item string.
 * Handles both CDATA-wrapped and plain text content.
 * Returns an array because ESPN items can have multiple <category> tags.
 */
function getAllTagValues(item: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*?))<\\/${tag}>`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = regex.exec(item)) !== null) {
    const val = (m[1] ?? m[2] ?? "").trim();
    if (val) results.push(val);
  }
  return results;
}

/** Get the first value of a given XML tag (for single-value fields). */
function getTagValue(item: string, tag: string): string {
  return getAllTagValues(item, tag)[0] ?? "";
}

/**
 * Layer 1: match ESPN <category> strings against the league-scoped lookup.
 * Returns deduped abbreviations. Empty array if nothing matched.
 */
function tagsFromCategories(categories: string[], league: string): string[] {
  const lookup = LEAGUE_LOOKUP[league] ?? {};
  const found = new Set<string>();

  for (const cat of categories) {
    const catLower = cat.toLowerCase();
    for (const [abbr, fragments] of Object.entries(lookup)) {
      if (fragments.some((frag) => catLower.includes(frag))) {
        found.add(abbr);
      }
    }
  }

  return [...found];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const googleAiKey = Deno.env.get("GOOGLE_AI_KEY")!;
  let inserted   = 0;
  let skipped    = 0;
  let rssTagHits = 0; // articles where Layer 1 supplied all tags

  for (const [league, feedUrl] of Object.entries(ESPN_RSS)) {
    let xml: string;
    try {
      const res = await fetch(feedUrl);
      if (!res.ok) {
        console.error(`[fetch-news] ESPN RSS ${league} returned ${res.status}`);
        continue;
      }
      xml = await res.text();
    } catch (err) {
      console.error(`[fetch-news] Failed to fetch ESPN RSS ${league}:`, err.message);
      continue;
    }

    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    console.log(`[fetch-news] ${league}: ${items.length} items in feed`);

    for (const item of items) {
      const guid        = getTagValue(item, "guid");
      const headline    = getTagValue(item, "title");
      const description = getTagValue(item, "description");
      const link        = getTagValue(item, "link");
      const pubDate     = getTagValue(item, "pubDate");
      const categories  = getAllTagValues(item, "category");

      if (!guid || !headline) continue;

      // Deduplication: skip if already in DB
      const { data: exists } = await supabase
        .from("stories")
        .select("id")
        .eq("external_id", guid)
        .maybeSingle();

      if (exists) {
        skipped++;
        continue;
      }

      // ── Layer 1: RSS category → team_tags ──────────────────────────────────
      const rssTeamTags = tagsFromCategories(categories, league);
      const gotTagsFromRss = rssTeamTags.length > 0;
      if (gotTagsFromRss) rssTagHits++;

      // ── Layer 2: Gemini for summary + analysis + is_hot (always) ───────────
      // Also asks for team_tags — only used when Layer 1 returned nothing.
      // analysis is listed first so it generates before the token budget runs out.
      const geminiPayload = {
        contents: [{
          parts: [{
            text: `You are a sports analyst. Return ONLY valid JSON, no markdown fences, no other text:
{
  "analysis": "3 sentences: (1) immediate team impact, (2) relevant league context with a specific stat, (3) what to watch next",
  "summary": "1-2 sentence summary for a news card (max 160 chars)",
  "is_hot": true or false based on significance,
  "team_tags": ["ABR1", "ABR2"]
}

League: ${league}
Headline: ${headline}
Description: ${description}`,
          }],
        }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
      };

      let parsed: Record<string, unknown> = {};
      try {
        const geminiRes = await fetch(`${GEMINI_URL}?key=${googleAiKey}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(geminiPayload),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
          if (inserted === 0) {
            console.log("[fetch-news] Gemini raw (first article):", rawText.slice(0, 500));
          }
          parsed = parseGeminiJson(rawText);
        } else {
          console.error(`[fetch-news] Gemini ${geminiRes.status} for: ${headline}`);
        }
      } catch (err) {
        console.error(`[fetch-news] Gemini call failed for: ${headline}`, err.message);
      }

      // Merge: RSS tags take priority; Gemini fills the gap when RSS had nothing.
      const finalTeamTags = gotTagsFromRss
        ? rssTeamTags
        : Array.isArray(parsed.team_tags) ? parsed.team_tags as string[] : [];

      // article_url is required by ESPN ToS — skip insert if missing
      if (!link) {
        console.warn(`[fetch-news] Skipping article with no link: ${headline}`);
        continue;
      }

      const { error: upsertError } = await supabase.from("stories").insert({
        external_id:  guid,
        league,
        team_tags:    finalTeamTags,
        headline,
        rss_summary:  description || null,
        ai_summary:   typeof parsed.summary === "string"
                        ? (parsed.summary as string).slice(0, 160)
                        : description?.slice(0, 160) ?? null,
        ai_analysis:  typeof parsed.analysis === "string" ? parsed.analysis : null,
        article_url:  link,
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        is_hot:       parsed.is_hot === true,
      });

      if (upsertError) {
        console.error(`[fetch-news] Insert failed for ${guid}:`, upsertError.message);
      } else {
        inserted++;
      }
    }
  }

  console.log(
    `[fetch-news] Done. inserted=${inserted} skipped=${skipped} rssTagHits=${rssTagHits}`,
  );

  return new Response(JSON.stringify({ ok: true, inserted, skipped, rssTagHits }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Gemini JSON parser ───────────────────────────────────────────────────────
// Gemini sometimes wraps output in ```json ... ``` fences, adds leading/trailing
// whitespace, or prefixes with a newline before the fence. Rather than trying to
// strip the fence with a regex anchor (which fails when there's a leading \n),
// we extract the JSON object directly by finding the first { and last }.

function parseGeminiJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    console.warn("[fetch-news] No JSON object found in Gemini response:", raw.slice(0, 200));
    return {};
  }

  const extracted = raw.slice(start, end + 1);
  try {
    return JSON.parse(extracted);
  } catch {
    console.warn("[fetch-news] Could not parse Gemini JSON:", extracted.slice(0, 200));
    return {};
  }
}
