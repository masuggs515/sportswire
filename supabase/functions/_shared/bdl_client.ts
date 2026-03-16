/**
 * _shared/bdl_client.ts — BallDontLie rate-aware HTTP client
 *
 * Responsibilities:
 *  1. Track remaining requests from response headers
 *  2. Pre-emptively delay between calls when budget is low
 *  3. On 429: read Retry-After header, wait exactly that long, then retry once
 *  4. Smart scheduling: skip fetch entirely if no games are live/upcoming soon
 *
 * Free tier: 5 req/min  →  1 req per 12 seconds to be safe
 * All-Star tier: 60 req/min → 1 req per 1 second
 */

const BDL_BASE = "https://api.balldontlie.io";
const API_KEY  = Deno.env.get("BALLDONTLIE_API_KEY") ?? "";

// ─── Rate limit state (per Edge Function invocation) ────────────────────────
// Supabase Edge Functions are stateless per invocation, so this tracks state
// within a single run. Cross-invocation state is handled by the cron schedule
// gap itself (5 min between score fetches >> 1 min rate limit window).

let remainingRequests = 5;   // conservative starting assumption (free tier)
let resetAtMs         = 0;   // epoch ms when the window resets

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

export async function bdlFetch(path: string): Promise<any> {
  const url = `${BDL_BASE}${path}`;

  // 1. Pre-emptive delay: if we're nearly out of budget, wait for reset
  if (remainingRequests <= 1 && resetAtMs > Date.now()) {
    const waitMs = resetAtMs - Date.now() + 200; // 200ms buffer
    console.log(`[bdl] Pre-emptive delay ${waitMs}ms (remaining=${remainingRequests})`);
    await sleep(waitMs);
  }

  // 2. Small courtesy gap between sequential calls within one run
  // Keeps burst rate well under 5/min even if called in a tight loop
  await sleep(300);

  const res = await fetch(url, {
    headers: { Authorization: API_KEY },
  });

  // 3. Parse rate limit headers from every response
  updateRateLimitState(res.headers);

  // 4. Handle 429 — wait for Retry-After then retry once
  if (res.status === 429) {
    const retryAfterRaw = res.headers.get("retry-after") ?? "60";
    const waitMs        = parseRetryAfter(retryAfterRaw);
    console.warn(`[bdl] 429 received. Waiting ${waitMs}ms before retry.`);
    await sleep(waitMs);

    // Single retry — if it 429s again, throw so the cron job fails gracefully
    const retry = await fetch(url, { headers: { Authorization: API_KEY } });
    updateRateLimitState(retry.headers);

    if (retry.status === 429) {
      throw new Error(`[bdl] 429 on retry for ${path} — skipping this run`);
    }
    if (!retry.ok) {
      throw new Error(`[bdl] ${retry.status} on retry for ${path}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    throw new Error(`[bdl] ${res.status} ${res.statusText} for ${path}`);
  }

  return res.json();
}

// ─── Sequential multi-fetch with automatic throttle ─────────────────────────
// Use this instead of Promise.all() — parallel requests would burst the limit.

export async function bdlFetchAll(paths: string[]): Promise<any[]> {
  const results: any[] = [];
  for (const path of paths) {
    results.push(await bdlFetch(path));
  }
  return results;
}

// ─── Smart scheduling helpers ────────────────────────────────────────────────

/**
 * Returns true if it's worth polling for live scores right now.
 * Avoids burning requests in the middle of the night or during offseason.
 *
 * Logic:
 *  - NBA season: Oct–Jun.  Games typically 7 PM–11 PM ET.
 *  - NFL season: Sep–Feb.  Games Thu/Sun/Mon, roughly 1 PM–11 PM ET.
 *  - During "active window": poll every 5 min (cron default).
 *  - Outside window: cron still runs but this fn returns false → skip API call.
 *    Supabase cron can't dynamically change its schedule, so we gate inside the fn.
 */
export function shouldPollScores(): boolean {
  return shouldPollScoresAt(new Date());
}

/** Testable variant — accepts a date so tests can inject any time. */
export function shouldPollScoresAt(now: Date): boolean {
  const utcH  = now.getUTCHours();        // 0–23
  const utcM  = now.getUTCMonth() + 1;    // 1–12
  const utcD  = now.getUTCDay();          // 0=Sun … 6=Sat

  // Rough "NBA/NFL active months" — offseason check
  const nbaActive = utcM >= 10 || utcM <= 6;   // Oct–Jun
  const nflActive = utcM >= 9  || utcM <= 2;   // Sep–Feb

  if (!nbaActive && !nflActive) {
    console.log("[bdl] Full offseason — skipping score poll");
    return false;
  }

  // Game-time window: 5 PM–2 AM ET = 22:00–07:00 UTC
  const inGameWindow = utcH >= 22 || utcH <= 7;

  // NFL days: Thu(4), Sun(0), Mon(1)
  const isNflDay = nflActive && [0, 1, 4].includes(utcD);

  if (!inGameWindow && !isNflDay) {
    console.log("[bdl] Outside game window — skipping score poll");
    return false;
  }

  return true;
}

/**
 * Returns true if standings are stale enough to warrant a refresh.
 * Pass in the fetched_at timestamp of the most recent row.
 */
export function shouldRefreshStandings(lastFetchedAt: string | null): boolean {
  if (!lastFetchedAt) return true;
  const age = Date.now() - new Date(lastFetchedAt).getTime();
  return age > 55 * 60 * 1000; // refresh if older than 55 min
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function updateRateLimitState(headers: Headers): void {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset     = headers.get("x-ratelimit-reset");

  if (remaining !== null) remainingRequests = parseInt(remaining, 10);
  if (reset     !== null) resetAtMs         = parseInt(reset, 10) * 1000; // seconds → ms

  console.log(`[bdl] remaining=${remainingRequests} resetAt=${new Date(resetAtMs).toISOString()}`);
}

function parseRetryAfter(header: string): number {
  // Retry-After can be seconds (integer) or an HTTP date string
  const seconds = parseFloat(header);
  if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 200; // ms + buffer

  // HTTP date format
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now()) + 200;

  return 61_000; // safe fallback: 61 seconds
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
