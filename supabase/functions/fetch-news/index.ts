/**
 * fetch-news/index.ts
 *
 * Triggered by Supabase Cron at :15 and :45 past every hour.
 *
 * Logic:
 *  1. Fetch ESPN RSS for NBA, NFL, and NCAAB
 *  2. Parse XML: extract guid, title, description, link, pubDate, category
 *  3. Skip articles already in DB (deduplication on external_id)
 *  4. Call Gemini Flash once per new article — result stored permanently
 *  5. Strip ```json fences before parsing Gemini response
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

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const googleAiKey = Deno.env.get("GOOGLE_AI_KEY")!;
  let inserted = 0;
  let skipped  = 0;

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
      const get = (tag: string): string =>
        item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] ??
        item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? "";

      const guid        = get("guid");
      const headline    = get("title");
      const description = get("description");
      const link        = get("link");
      const pubDate     = get("pubDate");

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

      // Call Gemini Flash — once per article, result cached permanently in Postgres
      // analysis comes first in the template so it is generated before token budget runs out.
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

      let parsed: Record<string, any> = {};
      try {
        const geminiRes = await fetch(`${GEMINI_URL}?key=${googleAiKey}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(geminiPayload),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
          // Log first article per run so we can verify analysis is present
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

      // article_url is required by ESPN ToS — skip insert if missing
      if (!link) {
        console.warn(`[fetch-news] Skipping article with no link: ${headline}`);
        continue;
      }

      const { error: upsertError } = await supabase.from("stories").insert({
        external_id:  guid,
        league,
        team_tags:    Array.isArray(parsed.team_tags) ? parsed.team_tags : [],
        headline,
        rss_summary:  description || null,
        ai_summary:   typeof parsed.summary === "string"
                        ? parsed.summary.slice(0, 160)
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

  console.log(`[fetch-news] Done. inserted=${inserted} skipped=${skipped}`);

  return new Response(JSON.stringify({ ok: true, inserted, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ─── Gemini JSON parser ───────────────────────────────────────────────────────
// Gemini sometimes wraps output in ```json ... ``` fences, adds leading/trailing
// whitespace, or prefixes with a newline before the fence. Rather than trying to
// strip the fence with a regex anchor (which fails when there's a leading \n),
// we extract the JSON object directly by finding the first { and last }.

function parseGeminiJson(raw: string): Record<string, any> {
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
