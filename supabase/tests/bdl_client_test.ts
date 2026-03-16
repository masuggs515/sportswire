/**
 * supabase/tests/bdl_client_test.ts
 *
 * Unit tests for BallDontLie rate-limiting client.
 * Run with: deno test supabase/tests/bdl_client_test.ts
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { shouldPollScoresAt, shouldRefreshStandings } from "../functions/_shared/bdl_client.ts";

// ── shouldPollScoresAt ────────────────────────────────────────────────────────

Deno.test("shouldPollScoresAt: returns false outside game window (midday ET)", () => {
  // 12 PM UTC = 7 AM ET — well outside the 5 PM–2 AM ET game window
  // March = NBA active month
  const outside = new Date("2026-03-15T17:00:00Z"); // 12 PM ET
  assertEquals(shouldPollScoresAt(outside), false);
});

Deno.test("shouldPollScoresAt: returns true during NBA evening hours", () => {
  // 23:30 UTC = 6:30 PM ET — prime NBA tip-off time in March
  const gameTime = new Date("2026-03-15T23:30:00Z");
  assertEquals(shouldPollScoresAt(gameTime), true);
});

Deno.test("shouldPollScoresAt: returns true during late-night window (1 AM UTC)", () => {
  // 01:00 UTC = 8 PM ET previous day — still in game window
  const lateGame = new Date("2026-03-16T01:00:00Z");
  assertEquals(shouldPollScoresAt(lateGame), true);
});

Deno.test("shouldPollScoresAt: returns true on NFL Sunday (active season)", () => {
  // Jan 5 2026 is a Sunday — NFL active (month=1, utcD=0)
  const nflSunday = new Date("2026-01-05T17:00:00Z"); // 12 PM ET
  assertEquals(shouldPollScoresAt(nflSunday), true);
});

Deno.test("shouldPollScoresAt: returns true on NFL Thursday (active season)", () => {
  // Thursday in NFL season
  const nflThursday = new Date("2026-01-08T22:00:00Z"); // Thursday
  assertEquals(shouldPollScoresAt(nflThursday), true);
});

Deno.test("shouldPollScoresAt: returns false in full offseason (July)", () => {
  // July — both NBA (off Jun–Sep) and NFL (off Mar–Aug) are inactive
  const offseason = new Date("2026-07-15T23:30:00Z");
  assertEquals(shouldPollScoresAt(offseason), false);
});

// ── shouldRefreshStandings ────────────────────────────────────────────────────

Deno.test("shouldRefreshStandings: returns true when lastFetchedAt is null", () => {
  assertEquals(shouldRefreshStandings(null), true);
});

Deno.test("shouldRefreshStandings: returns false when standings are 5 minutes old", () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assertEquals(shouldRefreshStandings(fiveMinutesAgo), false);
});

Deno.test("shouldRefreshStandings: returns false when standings are 54 minutes old", () => {
  const fiftyFourMinAgo = new Date(Date.now() - 54 * 60 * 1000).toISOString();
  assertEquals(shouldRefreshStandings(fiftyFourMinAgo), false);
});

Deno.test("shouldRefreshStandings: returns true when standings are 56 minutes old", () => {
  const fiftySevenMinAgo = new Date(Date.now() - 56 * 60 * 1000).toISOString();
  assertEquals(shouldRefreshStandings(fiftySevenMinAgo), true);
});

Deno.test("shouldRefreshStandings: returns true when standings are 2 hours old", () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assertEquals(shouldRefreshStandings(twoHoursAgo), true);
});
