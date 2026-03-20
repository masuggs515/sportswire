/**
 * fetch-news/index.ts
 *
 * Triggered by Supabase Cron at :15 and :45 past every hour.
 *
 * Logic:
 *  1. Fetch all RSS feeds in a single loop: NBA, NFL, NCAAB, MLB, plus team-specific
 *     feeds for Panthers (league = 'NFL') and Yankees (league = 'MLB').
 *  2. Parse XML: extract guid, title, description, link, pubDate, all <category> tags
 *  3. Skip articles already in DB (deduplication on external_id)
 *  4. Layer 1 — RSS category → team_tags: match <category> text against known team
 *     names using a league-scoped lookup. No Gemini quota spent for this.
 *  5. Layer 2 — Gemini fills the gaps: always called for ai_summary, ai_analysis,
 *     and is_hot. Also provides team_tags when Layer 1 returned zero tags.
 *  6. Upsert story to `stories` table
 *
 * Panthers and Yankees are not separate leagues — they are NFL and MLB stories
 * respectively. The feed tabs filter by team_tags ('CAR'/'Panthers' and 'NYY'/'Yankees').
 *
 * BDL requests per run: 0 (ESPN RSS only — no BallDontLie calls)
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── RSS feed URLs → league mapping ──────────────────────────────────────────
// Panthers feeds: league = 'NFL' (team_tags handles Panthers tab filtering)
// Yankees feed:   league = 'MLB' (team_tags handles Yankees tab filtering)
const ESPN_RSS: Record<string, string> = {
  NBA:     "https://www.espn.com/espn/rss/nba/news",
  NFL:     "https://www.espn.com/espn/rss/nfl/news",
  NCAAB:   "https://www.espn.com/espn/rss/ncb/news",
  MLB:     "https://www.espn.com/espn/rss/mlb/news",
  // Team-specific feeds: ingest as their real league, team_tags drive tab filtering
  NFL_Panthers_Official: "https://www.panthers.com/rss/news",
  NFL_Panthers_Wire:     "https://pantherswire.usatoday.com/feed/",
  NFL_Panthers_CSR:      "https://www.catscratchreader.com/rss/current",
  MLB_Yankees:           "https://www.espn.com/mlb/rss/news?id=10",
};

// League normalisation — team-specific feed keys map to their real league value
const FEED_LEAGUE: Record<string, string> = {
  NFL_Panthers_Official: "NFL",
  NFL_Panthers_Wire:     "NFL",
  NFL_Panthers_CSR:      "NFL",
  MLB_Yankees:           "MLB",
};

// ─── Gemini Flash endpoint ────────────────────────────────────────────────────
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

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

// NCAAB: top programs by ESPN coverage volume. Gemini handles the long tail.
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

const MLB_TEAM_LOOKUP: Record<string, string[]> = {
  ARI: ["arizona diamondbacks", "diamondbacks", "d-backs"],
  ATL: ["atlanta braves", "braves"],
  BAL: ["baltimore orioles", "orioles"],
  BOS: ["boston red sox", "red sox"],
  CHC: ["chicago cubs", "cubs"],
  CWS: ["chicago white sox", "white sox"],
  CIN: ["cincinnati reds", "reds"],
  CLE: ["cleveland guardians", "guardians"],
  COL: ["colorado rockies", "rockies"],
  DET: ["detroit tigers", "tigers"],
  HOU: ["houston astros", "astros"],
  KC:  ["kansas city royals", "royals"],
  LAA: ["los angeles angels", "angels"],
  LAD: ["los angeles dodgers", "dodgers"],
  MIA: ["miami marlins", "marlins"],
  MIL: ["milwaukee brewers", "brewers"],
  MIN: ["minnesota twins", "twins"],
  NYM: ["new york mets", "mets"],
  NYY: ["new york yankees", "yankees"],
  OAK: ["oakland athletics", "athletics"],
  PHI: ["philadelphia phillies", "phillies"],
  PIT: ["pittsburgh pirates", "pirates"],
  SD:  ["san diego padres", "padres"],
  SF:  ["san francisco giants", "giants"],
  SEA: ["seattle mariners", "mariners"],
  STL: ["st. louis cardinals", "cardinals"],
  TB:  ["tampa bay rays", "rays"],
  TEX: ["texas rangers", "rangers"],
  TOR: ["toronto blue jays", "blue jays"],
  WSH: ["washington nationals", "nationals"],
};

// Yankees feed: only one team — every article tags NYY
const YANKEES_FEED_LOOKUP: Record<string, string[]> = {
  NYY: ["new york yankees", "yankees", "new york"],
};

const LEAGUE_LOOKUP: Record<string, Record<string, string[]>> = {
  NBA:                   NBA_TEAM_LOOKUP,
  NFL:                   NFL_TEAM_LOOKUP,
  NCAAB:                 NCAAB_TEAM_LOOKUP,
  MLB:                   MLB_TEAM_LOOKUP,
  NFL_Panthers_Official: NFL_TEAM_LOOKUP,
  NFL_Panthers_Wire:     NFL_TEAM_LOOKUP,
  NFL_Panthers_CSR:      NFL_TEAM_LOOKUP,
  MLB_Yankees:           YANKEES_FEED_LOOKUP,
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
 * Layer 1: match RSS <category> strings against the lookup for this feed key.
 * Returns deduped abbreviations. Empty array if nothing matched.
 */
function tagsFromCategories(categories: string[], feedKey: string): string[] {
  const lookup = LEAGUE_LOOKUP[feedKey] ?? {};
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

  for (const [feedKey, feedUrl] of Object.entries(ESPN_RSS)) {
    // Resolve the league value stored in the DB row
    const league = FEED_LEAGUE[feedKey] ?? feedKey;

    let xml: string;
    try {
      const res = await fetch(feedUrl);
      if (!res.ok) {
        console.error(`[fetch-news] RSS ${feedKey} returned ${res.status}`);
        continue;
      }
      xml = await res.text();
    } catch (err) {
      console.error(`[fetch-news] Failed to fetch RSS ${feedKey}:`, err.message);
      continue;
    }

    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    console.log(`[fetch-news] ${feedKey}: ${items.length} items in feed`);

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
      const rssTeamTags = tagsFromCategories(categories, feedKey);
      const gotTagsFromRss = rssTeamTags.length > 0;
      if (gotTagsFromRss) rssTagHits++;

      // ── Layer 2: Gemini for summary + analysis + is_hot (always) ───────────
      // Also asks for team_tags — only used when Layer 1 returned nothing.
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
