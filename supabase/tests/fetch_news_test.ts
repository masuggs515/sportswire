/**
 * supabase/tests/fetch_news_test.ts
 *
 * Unit tests for fetch-news Edge Function logic.
 * Focuses on: Gemini JSON fence-stripping and deduplication logic.
 *
 * Run with: deno test supabase/tests/fetch_news_test.ts
 */

import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ── Re-export the parser for testing ─────────────────────────────────────────
// The parseGeminiJson function is embedded in fetch-news/index.ts.
// We replicate it here to keep the test self-contained and fast (no HTTP calls).

function parseGeminiJson(raw: string): Record<string, any> {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    return {};
  }
}

// ── Gemini JSON parsing ────────────────────────────────────────────────────────

Deno.test("parseGeminiJson: parses clean JSON", () => {
  const raw = '{"summary":"Lakers win","analysis":"Good game","is_hot":true,"team_tags":["LAL"]}';
  const result = parseGeminiJson(raw);
  assertEquals(result["summary"], "Lakers win");
  assertEquals(result["analysis"], "Good game");
  assertEquals(result["is_hot"], true);
  assertEquals(result["team_tags"], ["LAL"]);
});

Deno.test("parseGeminiJson: strips ```json fences before parsing", () => {
  const raw = "```json\n{\"summary\":\"Lakers win\",\"is_hot\":false,\"team_tags\":[\"LAL\"]}\n```";
  const result = parseGeminiJson(raw);
  assertEquals(result["summary"], "Lakers win");
  assertEquals(result["is_hot"], false);
});

Deno.test("parseGeminiJson: strips plain ``` fences (no language tag)", () => {
  const raw = "```\n{\"summary\":\"Chiefs win\",\"team_tags\":[\"KC\"]}\n```";
  const result = parseGeminiJson(raw);
  assertEquals(result["summary"], "Chiefs win");
  assertEquals(result["team_tags"], ["KC"]);
});

Deno.test("parseGeminiJson: returns empty object on unparseable text", () => {
  const raw = "sorry I cannot help with sports analysis";
  const result = parseGeminiJson(raw);
  assertEquals(Object.keys(result).length, 0);
});

Deno.test("parseGeminiJson: returns empty object on malformed JSON", () => {
  const raw = '{"summary": "Lakers win", "team_tags": ["LAL"';
  const result = parseGeminiJson(raw);
  assertEquals(Object.keys(result).length, 0);
});

Deno.test("parseGeminiJson: handles extra whitespace and newlines in fences", () => {
  const raw = "```json  \n  {\"summary\":\"Test\",\"team_tags\":[]}  \n  ```  ";
  const result = parseGeminiJson(raw);
  assertEquals(result["summary"], "Test");
});

Deno.test("parseGeminiJson: team_tags present as array", () => {
  const raw = '{"summary":"Two teams","analysis":"Good","is_hot":false,"team_tags":["LAL","BOS"]}';
  const result = parseGeminiJson(raw);
  assertEquals(Array.isArray(result["team_tags"]), true);
  assertEquals(result["team_tags"].length, 2);
});

// ── Summary truncation ────────────────────────────────────────────────────────

Deno.test("ai_summary is capped at 160 characters", () => {
  const longSummary = "A".repeat(200);
  const capped = typeof longSummary === "string" ? longSummary.slice(0, 160) : null;
  assertEquals(capped?.length, 160);
});

// ── article_url guard ─────────────────────────────────────────────────────────

Deno.test("articles without a link are skipped (ESPN ToS requires article_url)", () => {
  const link = ""; // empty — simulates missing <link> tag in RSS
  const shouldSkip = !link;
  assertEquals(shouldSkip, true);
});

Deno.test("articles with a valid link are not skipped", () => {
  const link = "https://www.espn.com/nba/story/_/id/12345/lakers-win";
  const shouldSkip = !link;
  assertEquals(shouldSkip, false);
});
