# Testing Agent Spec
**Project:** SportsWire  
**Agent Role:** Testing specialist — writes, maintains, and runs the test suite. Owns Dart unit tests, Flutter widget tests, and Deno Edge Function tests.  
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Agent Convention — TODO MAS

```
// TODO MAS: [clear description of what is needed and why]
```

---

## Core Principle

**Test what matters. Don't test everything.**

Test ruthlessly:
- Rate limiter logic (BDL request budget management)
- Story sort algorithm (followed teams → hot → newest)
- Gemini JSON parsing including fence-stripping
- RLS policies (public read, no writes from client)
- `get-story-detail` assembles correct payload

Test lightly:
- UI layout and styling (tested manually)
- Navigation flows (tested manually)

---

## Test Stack

| Layer | Tool | Purpose |
|---|---|---|
| Dart unit tests | `flutter test` | Sort algorithm, JSON parsing, team config |
| Flutter widget tests | `flutter test` | Feed card rendering, story screen states |
| Deno Edge Function tests | Deno test runner | Rate limiter, RLS, get-story-detail |

---

## Project Test Structure

```
test/
  feed/
    story_sort_test.dart           -- sort: followed first, hot second, newest third
    story_card_test.dart           -- card renders headline, ai_summary, team badge
  story/
    story_detail_test.dart         -- StoryDetail.fromJson parses all fields
    ai_analysis_test.dart          -- ai_analysis displayed when present, hidden when null
  settings/
    prefs_test.dart                -- team follow/unfollow, local persistence
  shared/
    team_config_test.dart          -- all team abbrs resolve to color + name

supabase/
  tests/
    rls_test.ts                    -- public read on stories/games/standings, no client writes
    bdl_client_test.ts             -- rate limit tracking, 429 handling, shouldPollScores
    get_story_detail_test.ts       -- assembles correct payload, increments view count
    fetch_news_test.ts             -- Gemini JSON fence-stripping, skips existing articles
```

---

## Critical Test Suites

### Suite 1 — Story Sort Algorithm

```dart
// test/feed/story_sort_test.dart

void main() {
  group('Feed sort order', () {
    test('followed team stories appear before unfollowed', () {
      final followed = {'LAL', 'OKC'};
      final stories = [
        Story(id: '1', teamTags: ['BOS'], isHot: true,  publishedAt: recent),
        Story(id: '2', teamTags: ['LAL'], isHot: false, publishedAt: older),
        Story(id: '3', teamTags: ['OKC'], isHot: false, publishedAt: oldest),
      ];
      final sorted = sortFeed(stories, followed);
      expect(sorted[0].id, anyOf('2', '3')); // followed teams first
      expect(sorted[2].id, '1');             // BOS last even though hot
    });

    test('hot stories appear before non-hot within same follow group', () {
      final followed = <String>{};
      final stories = [
        Story(id: '1', teamTags: ['LAL'], isHot: false, publishedAt: recent),
        Story(id: '2', teamTags: ['BOS'], isHot: true,  publishedAt: older),
      ];
      final sorted = sortFeed(stories, followed);
      expect(sorted[0].id, '2'); // hot first
    });

    test('within same group, newer stories appear first', () {
      final stories = [
        Story(id: '1', teamTags: ['LAL'], isHot: false, publishedAt: older),
        Story(id: '2', teamTags: ['LAL'], isHot: false, publishedAt: recent),
      ];
      final sorted = sortFeed(stories, {'LAL'});
      expect(sorted[0].id, '2'); // newer first
    });
  });
}
```

---

### Suite 2 — Gemini JSON Parsing

```dart
// test/shared/gemini_parse_test.dart

void main() {
  group('Gemini response parsing', () {
    test('parses clean JSON', () {
      const raw = '{"summary":"Lakers win","analysis":"Good game","is_hot":true,"team_tags":["LAL"]}';
      final result = parseGeminiResponse(raw);
      expect(result['summary'], 'Lakers win');
      expect(result['team_tags'], ['LAL']);
    });

    test('strips ```json fences before parsing', () {
      const raw = '```json\n{"summary":"Lakers win","is_hot":false}\n```';
      final result = parseGeminiResponse(raw);
      expect(result['summary'], 'Lakers win');
    });

    test('returns empty map on invalid JSON without throwing', () {
      const raw = 'sorry I cannot help with that';
      final result = parseGeminiResponse(raw);
      expect(result, isEmpty);
    });
  });
}
```

---

### Suite 3 — BDL Rate Limiter

```typescript
// supabase/tests/bdl_client_test.ts

Deno.test('shouldPollScores returns false outside game window', () => {
  // 3 AM UTC = 10 PM ET previous day — actually in window
  // 12 PM UTC = 7 AM ET — outside window
  const outside = new Date('2026-03-15T12:00:00Z'); // 7 AM ET
  assertEquals(shouldPollScoresAt(outside), false);
});

Deno.test('shouldPollScores returns true during NBA evening hours', () => {
  const gameTime = new Date('2026-03-15T23:30:00Z'); // 7:30 PM ET
  assertEquals(shouldPollScoresAt(gameTime), true);
});

Deno.test('shouldRefreshStandings returns false when fresh', () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assertEquals(shouldRefreshStandings(fiveMinutesAgo), false);
});

Deno.test('shouldRefreshStandings returns true when stale', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assertEquals(shouldRefreshStandings(twoHoursAgo), true);
});
```

---

### Suite 4 — RLS Policies

```typescript
// supabase/tests/rls_test.ts

Deno.test('anonymous user can read stories', async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await client.from('stories').select('id').limit(1);
  assertEquals(error, null);
  // data may be empty but should not error
});

Deno.test('anonymous user cannot insert into stories', async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  await client.auth.signInAnonymously();
  const { error } = await client.from('stories').insert({
    external_id: 'exploit', league: 'NBA', headline: 'hacked',
  });
  assertNotEquals(error, null); // must fail
});

Deno.test('anonymous user cannot insert into games', async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  await client.auth.signInAnonymously();
  const { error } = await client.from('games').insert({
    external_id: 'fake', league: 'NBA', home_team: 'LAL', away_team: 'BOS',
  });
  assertNotEquals(error, null);
});
```

---

## When to Run Tests

| Trigger | Suites to run |
|---|---|
| After any Dart/Flutter code change | `flutter test` (all suites) |
| After any Edge Function change | Relevant Deno test + rls_test.ts |
| After any schema migration | rls_test.ts |
| Before marking phase complete | Full suite |

---

## Coverage Targets

| Area | Target |
|---|---|
| Story sort algorithm | 100% |
| Gemini JSON parsing | 100% |
| BDL rate limiter logic | 100% |
| RLS policies | 100% — every table |
| `get-story-detail` assembly | 90% |
| Flutter widgets | 60% |

---

## Test Report Format

```markdown
# Test Report
Date: [date]
Triggered by: [agent session]

## Results
Total: [N] · Passing: [N] · Failing: [N]

## Coverage
[Area]: [X]% (target: [Y]%)

## Failures
[file, test name, expected vs actual]

## New Untested Paths
[code paths introduced this session with no test coverage]

## TODO MAS Items
[list]
```
