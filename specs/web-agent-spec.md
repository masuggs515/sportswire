# Web Agent Spec
**Project:** SportsWire
**Agent Role:** Next.js web specialist — owns all UI pages, components, Supabase client integration, and localStorage preference management.
**Document Version:** 2.0
**Last Updated:** March 2026
**Replaces:** flutter-agent-spec.md (Flutter removed 2026-03-18)

---

## Agent Convention — TODO MAS

Any time you need human input, a decision, a credential, a review, or anything uncertain:

```
// TODO MAS: [clear description of what is needed and why]
```

Never stall silently. At the end of every session, print a consolidated list of every TODO MAS item.

---

## Agent Context

You are a Next.js expert building the web client for SportsWire. You own everything the user sees and touches. Your responsibilities:

- All Next.js pages (App Router) and navigation
- React client/server components
- Supabase JS SDK reads (queries to content tables)
- Supabase Edge Function calls (`get-story-detail`)
- User preference management (localStorage)
- Mixpanel event tracking calls
- Tailwind CSS styling

You do not write Edge Functions. You do not modify the Supabase schema. You never write directly to `stories`, `games`, or `standings` — those are written by Edge Functions only. All reads use the Supabase anon key with RLS enforced.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Next.js | 15.x | Web framework (App Router) |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| @supabase/supabase-js | Latest | Supabase client |
| @supabase/ssr | Latest | Next.js SSR integration |
| React | 19.x | UI library |

---

## Project Structure

```
web/
  src/
    app/
      page.tsx                   # Feed page — server component, fetches stories + games
      layout.tsx                 # Root layout with NavBar
      globals.css                # Tailwind directives + global styles
      scores/
        page.tsx                 # Scores page — yesterday through next 3 days, revalidate 30s
      story/
        [id]/
          page.tsx               # Story detail page — calls get-story-detail edge fn

    components/
      NavBar.tsx                 # Sticky header with Feed/Scores nav + settings button
      FeedClient.tsx             # Feed client: tabs, realtime, sorting
      StoryCard.tsx              # Tweet-like story card
      GameTicker.tsx             # Horizontal scroll: live games → upcoming → recent
      StoryDetailClient.tsx      # Full story view (client)
      TeamBadge.tsx              # Coloured team abbreviation chip
      SettingsSheet.tsx          # Slide-out settings panel with team picker
      ScoresClient.tsx           # Scores page client: sections, league tabs, realtime

    lib/
      types.ts                   # TypeScript interfaces: Story, Game, Standing, Team, StoryDetail
      teamConfig.ts              # All 30 NBA + 32 NFL teams: colors, full names
      supabase/
        client.ts                # createBrowserClient — for client components
        server.ts                # createServerClient — for server components

  .env.local                     # Gitignored — contains Supabase URL + keys
  package.json
  next.config.ts
  tailwind.config.ts
```

---

## Environment Variables

All in `web/.env.local` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Supabase anon key
NEXT_PUBLIC_MIXPANEL_TOKEN=      # Mixpanel project token
```

---

## Supabase Client Initialisation

Two clients — one for server components, one for client components:

```typescript
// lib/supabase/client.ts — browser client (client components)
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

// lib/supabase/server.ts — server client (server components, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}
```

---

## Feed Page (`/`)

Server component. Fetches stories and today's games from Supabase at request time (`revalidate = 60`).
Passes data to `FeedClient` for client-side interactivity.

### Feed query
```typescript
supabase
  .from('stories')
  .select('id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url, article_url')
  .order('published_at', { ascending: false })
  .limit(50)
```

### Client-side sort (in FeedClient)
```typescript
// followed teams first → hot → newest
stories.sort((a, b) => {
  const aF = a.team_tags.some(t => followedSet.has(t))
  const bF = b.team_tags.some(t => followedSet.has(t))
  if (aF !== bF) return aF ? -1 : 1
  if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
})
```

### League tabs
Four tabs: All / NBA / NFL / NCAAB. Filters `stories` array by `league` field client-side.

### Game ticker
Horizontal scroll of today's games. Supabase Realtime subscribed to `games` table changes for live score updates without polling.

---

## Story Detail Page (`/story/[id]`)

Server component. Calls `get-story-detail` Edge Function for the full assembled payload.

```typescript
const { data } = await supabase.functions.invoke('get-story-detail', {
  body: { storyId: id },
})
```

Response shape: `{ story, recentGames, upcomingGames, standings, related, teams }` — see `lib/types.ts`.

### Layout (top to bottom)
1. Team color top border
2. Back to feed link
3. League + TRENDING badge if hot
4. Headline (h1)
5. AI summary
6. Team badges + timestamp
7. "Read Full Story" button → opens `article_url` in new tab (required by ESPN ToS)
8. Share button → copies `/story/:id` URL to clipboard
9. AI Analysis card (from Postgres cache — instant, no loading state needed)
10. Recent Games — horizontal scroll of score cards
11. Upcoming Games — list with win probability
12. Standings table — top 10, current team highlighted
13. Related Stories — up to 4, tappable

---

## Preferences (localStorage)

No auth required. Teams saved to `localStorage` key `sportswire_followed_teams` as a JSON array of abbreviations.

```typescript
// In SettingsSheet.tsx
const STORAGE_KEY = 'sportswire_followed_teams'

export function getFollowedTeams(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
}

export function saveFollowedTeams(teams: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
  window.dispatchEvent(new Event('followed-teams-changed'))
}
```

`FeedClient` listens for `followed-teams-changed` events to re-sort the feed reactively.

---

## Settings Sheet

Slide-out panel from the right. Opens from the NavBar settings button.

- NBA team grid (30 teams) — toggle follow/unfollow
- NFL team grid (32 teams) — toggle follow/unfollow
- "Save & Close" — persists to localStorage and closes

---

## Mixpanel Events

```typescript
// TODO MAS: Mixpanel integration — add mixpanel-browser package and track:
// story_viewed(story_id, league, teams[], is_hot, source)
// team_followed(team, followed_teams[])
// team_unfollowed(team)
// share_link_generated(story_id)
// tab_changed(tab: 'all' | 'nba' | 'nfl' | 'ncaab')
// settings_opened()
// Use NEXT_PUBLIC_MIXPANEL_TOKEN from .env.local
```

---

## Team Config

All team data in `lib/teamConfig.ts`:
- `NBA_TEAMS` — 30 teams with fullName, primaryColor, accentColor
- `NFL_TEAMS` — 32 teams with fullName, primaryColor, accentColor
- `getTeam(abbr, league)` — lookup by abbreviation
- `getTeamColor(abbr, league)` — returns primaryColor hex
- `getTeamsByLeague(league)` — returns full map for settings picker

---

## Run Commands

```bash
cd web
npm install             # Install dependencies
npm run dev             # Start dev server (localhost:3000)
npm run build           # Production build
npm run lint            # ESLint check
npx tsc --noEmit        # TypeScript check
```

Fill in `web/.env.local` before running.

---

## Scores Page (`/scores`)

Server component (`revalidate = 30`). Reads directly from the `games` table — no Edge Function needed.

### Data window
Fetches games from yesterday through next 3 days. Also merges any in_progress games outside that window (edge case).

### Sections (in order, hidden if empty for active tab)
1. **Live** — `status = 'in_progress'` — green animated dot, live period shown
2. **Today** — `status = 'final' | 'scheduled'` with game_time = today
3. **Upcoming** — `status = 'scheduled'` grouped by date label (e.g. "Thu, Mar 20")
4. **Yesterday** — `status = 'final'` with game_time = yesterday

### League tabs
All / NBA / NFL / NCAAB — filters client-side. NCAAB shows "coming soon" empty state.

### Game card layout
- League badge + status (LIVE·period / FINAL / tip-time in local timezone)
- Away row: color dot, abbr, full name (sm+), score (or —)
- Home row: color dot, abbr, full name (sm+), score (or —)
- Winning team bold when final
- Win probability row for scheduled games (when available)
- Live games have green border accent

### Realtime
Supabase channel subscribed to `games` table changes — score updates without page refresh.

---

## Game Ticker (updated)

Prioritises: LIVE games → upcoming scheduled → recent finals. Shows a "Live Now" / "Upcoming" label. Feed page query window expanded to today + 2 days to catch upcoming games for the ticker.

---

## Deliverable Checklist

- [x] Feed page showing stories from Supabase
- [x] League tabs (All / NBA / NFL / NCAAB) filtering correctly
- [x] Game ticker: prioritises live → upcoming → recent
- [x] Story card: team color accent, badges, headline, ai_summary
- [x] Story detail page assembled from get-story-detail response
- [x] AI analysis displayed (no loading state — always cached)
- [x] "Read Full Story" opens ESPN URL in new tab
- [x] Share button copies deep link URL to clipboard
- [x] Settings sheet: team picker saves to localStorage
- [x] Realtime game score updates via Supabase channel (feed + scores)
- [x] Scores page (/scores): LIVE → TODAY → UPCOMING → RECENT sections
- [x] Scores page: league tabs All / NBA / NFL / NCAAB
- [x] Scores page: team colors + win probability
- [x] NavBar: Feed + Scores nav links with active state
- [x] ESLint clean
- [x] TypeScript clean
- [ ] Mixpanel events (TODO MAS — see above)

---

*This spec is the single source of truth for the Web agent. Do not make architectural decisions not covered here without raising a TODO MAS.*
