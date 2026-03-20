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
      standings/
        page.tsx                 # Standings page — server component wrapping StandingsClient
      story/
        [id]/
          page.tsx               # Story detail page — calls get-story-detail edge fn

    components/
      NavBar.tsx                 # Sticky header with Feed/Scores/Standings nav + settings + AuthButton
      FeedClient.tsx             # Feed client: tabs, realtime, sorting, favorites
      StoryCard.tsx              # Tweet-like story card
      GameTicker.tsx             # Horizontal scroll: live → fav games → finals → upcoming
      StoryDetailClient.tsx      # Full story view (client)
      TeamBadge.tsx              # Coloured team abbreviation chip
      SettingsSheet.tsx          # Slide-out settings: Favorite Teams (auth) + Follow Teams (localStorage)
      ScoresClient.tsx           # Scores page client: sections, league tabs, realtime, box score expansion
      BoxScorePanel.tsx          # Inline box score panel: NBA/NFL/MLB/NCAAB — fetched just-in-time from ESPN summary API
      StandingsClient.tsx        # Standings page client: league tabs, Division/Conference/League toggle, ESPN just-in-time fetch
      AuthModal.tsx              # Email+password sign in / sign up modal (no page redirect)
      AuthButton.tsx             # NavBar auth widget: "Sign in" button or avatar dropdown
      OnboardingOverlay.tsx      # First-login full-screen team picker (max 2 per league)

    lib/
      types.ts                   # TypeScript interfaces: Story, Game, Standing, Team, StoryDetail, FavoriteTeam
      teamConfig.ts              # All 30 NBA + 32 NFL teams: colors, full names
      teams.json                 # 92 teams (32 NFL + 30 NBA + 30 MLB) with ESPN logos + espnId
      supabase/
        client.ts                # createBrowserClient — for client components
        server.ts                # createServerClient — for server components

  middleware.ts                  # Supabase session refresh on every request

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

**Logged-out:** All / NBA / NFL / NCAAB / MLB / Yankees (static).

**Logged-in:** Dynamic tabs based on `favorite_teams` from `user_preferences`:
```
All | NBA | [NBA fav 1] | [NBA fav 2] | NFL | [NFL fav 1] | [NFL fav 2] | NCAAB | MLB | [MLB fav 1] | [MLB fav 2] | Yankees
```
Tabs computed via `useMemo` from the `favorites` array. Tab bar is `overflow-x-auto scrollbar-hide`. Favorite team tabs filter by `story.team_tags.includes(abbr)`.

`page.tsx` fetches `user_preferences.favorite_teams` server-side (if user is logged in) and passes as `initialFavorites` prop. Client re-fetches on `favorites-changed` event (dispatched when SettingsSheet saves).

### Game ticker
Horizontal scroll of today's games. Supabase Realtime subscribed to `games` table changes for live score updates without polling.

Priority: live → games featuring a favorite team (non-live) → recent finals → upcoming. `FavoriteTeam[]` passed from `FeedClient`.

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

## Auth

Optional Supabase email + password auth. No page redirect — modal only.

- **`AuthModal.tsx`**: sign-in / sign-up toggle. `onSuccess(isNewUser: boolean)` callback. Friendly error messages.
- **`AuthButton.tsx`**: client component, listens to `supabase.auth.onAuthStateChange()`.
  - Logged-out: "Sign in" text → opens `AuthModal`.
  - After auth success: if new user OR no `user_preferences` row → show `OnboardingOverlay`. Else → `router.refresh()`.
  - Logged-in: avatar with initials → dropdown: "Favorite Teams" (opens SettingsSheet) + "Sign out".
  - After sign-out or onboarding done: `router.refresh()` to re-run server components.
- NavBar right side: `[AuthButton] [gear icon]`.
- Email confirmations must be **disabled** in Supabase Auth settings (TODO MAS — requires manual dashboard action).

## Onboarding

**`OnboardingOverlay.tsx`**: Full-screen overlay shown once on first login.
- NFL / NBA / MLB team grids (4 columns per league) from `lib/teams.json`.
- Each `TeamCard`: ESPN logo (28px) + team name. Checkmark when selected. Blue border when selected.
- Max 2 per league — unselected cards disabled (`opacity-40`) when league is at max.
- Save: upserts `{ user_id, favorite_teams: selections }` to `user_preferences` via Supabase browser client.
- Skip: upserts `{ user_id, favorite_teams: [] }` (prevents re-trigger on next login).
- After save/skip: `onDone()` callback → `router.refresh()`.
- Trigger condition: `user_preferences` row does not exist for the logged-in user.

## Settings Sheet

Slide-out panel from the right. Opens from NavBar gear icon or "Favorite Teams" in avatar dropdown.

**When logged in:**
- **Favorite Teams** section: NFL / NBA / MLB grids from `lib/teams.json` (4 columns per league).
  - Up to 2 per league. `atMax` shows "Max 2" label; excess selections show amber warning.
  - Persisted to `user_preferences.favorite_teams` via Supabase on Save.
  - Dispatches `favorites-changed` window event so FeedClient re-fetches.

**For all users (localStorage):**
- NBA team grid (30 teams) — toggle follow/unfollow
- NFL team grid (32 teams) — toggle follow/unfollow
- "Save & Close" — persists localStorage + Supabase (if logged in) and closes

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
All / NBA / NFL / MLB / NCAAB — filters client-side.
Offseason empty state messages per league (NFL: September, NBA: October, MLB: March).

### Game card layout
- League badge + status (LIVE·clock / FINAL / tip-time in local timezone)
- Broadcast network badge (if available from `details.broadcast`)
- MLB: Spring Training / Playoffs season badge (from `details.seasonType`)
- Team display: ESPN logo image (~40px, rounded-sm) + abbreviation underneath, stacked vertically
  - Logo loaded from `details.competitors[n].team.logo` (ESPN CDN URL)
  - If logo missing or load fails: falls back to abbreviation in team-colored box
  - Team color from `details.competitors[n].team.color` (hex without #, prefixed with #)
- Score: large tabular numbers, winner bolded white when final
- Linescore table (live and final games, when linescores present in details):
  - MLB: innings 1–9 (or more) | R H E columns; dash for unplayed innings
  - NBA/NFL: Q1 Q2 Q3 Q4 (OT if applicable) | T columns
  - NCAAB: 1H 2H (OT if applicable) | T columns
  - Small monospace font, border between period columns and total
- Live situation (live games only):
  - MLB: count "B-S Count · N Out(s)" + diamond base diagram (filled = runner on base) + batter/pitcher names
  - NFL: down & distance text e.g. "2nd & 7 · Yd 35"
- Leaders / top performers (live and final games):
  - MLB live: HR or RBI leader per team with headshot
  - MLB final: winning/losing/saving pitcher from featuredAthletes (name + W-L + ERA)
  - NBA: points leader per team
  - NFL: passing yards leader (or rushing if no passer)
  - NCAAB: points leader per team
  - Format: [24px headshot circle] "Player Name — stat line"

### Realtime
Supabase channel subscribed to `games` table changes — score updates without page refresh.

---

## Game Ticker

Compact cards (`w-32`). Each card: status label, away row (logo 32px + score), home row (logo 32px + score). No team name text — abbreviation fallback only when logo fails.

Priority: live → games featuring a favorite team (non-live) → recent finals → upcoming.

Label: "Live Now" | "Your Teams" | "Recent" | "Upcoming" based on what's showing.

Favorite games get `border-blue-500/30` border + star indicator. `gameFeaturesFavorite()` matches via `details.competitors[n].team.abbreviation`.

Feed page query window: today + 2 days to catch upcoming games.

---

## lib/teams.json

92 teams: 32 NFL, 30 NBA, 30 MLB. Shape per team:
```typescript
{ league: 'NFL' | 'NBA' | 'MLB', name: string, abbr: string, espnId: number, logo: string }
```

ESPN logo URL patterns:
- NFL: `https://a.espncdn.com/i/teamlogos/nfl/500/{abbr_lower}.png` (Raiders: `oak`)
- NBA: `https://a.espncdn.com/i/teamlogos/nba/500/{abbr_lower}.png` (notable: GSW→`gs`, NYK→`ny`, NOP→`no`, SAS→`sa`, UTA→`utah`)
- MLB: `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/{abbr_lower}.png`

## lib/types.ts — FavoriteTeam

```typescript
export interface FavoriteTeam {
  league: 'NFL' | 'NBA' | 'MLB'
  espnId: number
  name: string
  abbr: string
}
```

## Middleware

`web/src/middleware.ts` — refreshes Supabase session on every request. Skips `_next/static`, `_next/image`, `favicon.ico`, and static asset extensions.

---

## Standings Page (`/standings`)

No server-side data fetch. `StandingsClient` handles everything client-side.

### League tabs
NBA | NFL | MLB | NCAAB — top of page, sticky below NavBar.

### View toggle
Division | Conference | League — pill buttons below league tabs.
- **Division**: one table per division group (e.g. Atlantic, Central, Pacific within East/West conf)
- **Conference**: one table per conference, teams sorted by win% within conference
- **League**: single table, all teams sorted by win%

### ESPN standings endpoints (just-in-time, client-side fetch)
```
NBA:   https://site.api.espn.com/apis/v2/sports/basketball/nba/standings
NFL:   https://site.api.espn.com/apis/v2/sports/football/nfl/standings
MLB:   https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings
NCAAB: https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings
```
Response: `{ children: [{ name: "Eastern Conference", children: [{ name: "Atlantic", standings: { entries: [...] } }] }] }`
For NCAAB, `conf.children` may be absent (conferences as top-level children with flat `standings.entries`).

### Caching
Simple in-memory `useRef` Map. Switching league tabs does not re-fetch if data is cached in the current session.

### Columns per league
- **NBA/MLB**: W | L | PCT | GB | Home | Away | Strk
- **NFL**: W | L | T | PCT | Home | Away | Div | Strk
- **NCAAB**: W | L | PCT | Home | Away | Conf | Strk

### Table
Team logo (28px, ESPN CDN) + full name + clinch note. Monospace stat columns. Horizontally scrollable on mobile. Team name sticky left.

---

## Box Score Panel

Inline expandable panel on every game card in `/scores`. No page navigation.

### Trigger
Chevron icon (▾) in the status row of each game card. Rotates 180° when open. Click again to close.

### Data source
ESPN summary endpoint (just-in-time, client-side):
```
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={external_id}
```
Sport/league mapping: NBA→basketball/nba, NFL→football/nfl, MLB→baseball/mlb, NCAAB→basketball/mens-college-basketball.
`game.external_id` is the ESPN event ID (stored by fetch-nba/nfl/mlb/ncaab-scores Edge Functions).

### Per-sport layout
**NBA**: Two team sections (starters / bench divider / DNP row / team totals). Columns: MIN FG 3PT FT REB AST STL BLK TO PTS.
**NCAAB**: Same as NBA. Columns: MIN FG 3PT FT REB AST TO PTS.
**NFL**: Passing / Rushing / Receiving tables (both teams interleaved with team-header rows) + Team Stats table (Total Yards, Turnovers, Poss. Time, 3rd Down, Red Zone).
**MLB**: Pitching section (both teams) + Batting section (per team). Pitching columns: IP H R ER BB K ERA. Batting columns: AB R H RBI BB K AVG.

### Styling
- Panel appears below game card content, separated by a border
- Horizontally scrollable stat tables (mobile-safe)
- Player headshots 24px where available, gray circle fallback
- Monospace font for all stat numbers
- Player name sticky-left in each table
- "Game hasn't started yet" message for scheduled games with no box score

---

## lib/types.ts — ESPN types

```typescript
// Box score
EspnBoxAthlete      // athlete + stats array from ESPN players response
EspnStatGroup       // names[] + athletes[] + totals[] per stat type
EspnBoxTeamStats    // team-level statistics (NFL team stats)
EspnBoxPlayer       // one team's stat groups within boxscore.players[]
EspnBoxScore        // { teams?, players? }
EspnSummaryResponse // { boxscore? }

// Standings
EspnStandingEntry   // team + stats[] from ESPN standings entries
EspnStandingGroup   // { name, entries } (a division or conference)
EspnStandingConference // { name, divisions[] }
StandingsView       // 'Division' | 'Conference' | 'League'
```

---

## Deliverable Checklist

- [x] Feed page showing stories from Supabase
- [x] League tabs (All / NBA / NFL / NCAAB) filtering correctly
- [x] Game ticker: prioritises live → fav team games → recent → upcoming
- [x] Story card: team color accent, badges, headline, ai_summary
- [x] Story detail page assembled from get-story-detail response
- [x] AI analysis displayed (no loading state — always cached)
- [x] "Read Full Story" opens ESPN URL in new tab
- [x] Share button copies deep link URL to clipboard
- [x] Settings sheet: team picker saves to localStorage
- [x] Realtime game score updates via Supabase channel (feed + scores)
- [x] Scores page (/scores): LIVE → TODAY → UPCOMING → RECENT sections
- [x] Scores page: league tabs All / NBA / NFL / MLB / NCAAB
- [x] Scores page: team colors + win probability
- [x] Scores page: ESPN team logos + linescores + leaders + live situation (MLB/NFL)
- [x] Feed page: Yankees news tab
- [x] NavBar: Feed + Scores nav links with active state
- [x] ESLint clean
- [x] TypeScript clean
- [x] Optional email+password auth (AuthModal, AuthButton)
- [x] First-login onboarding overlay (OnboardingOverlay)
- [x] Favorite teams: stored in user_preferences, persisted to Supabase
- [x] Dynamic feed tabs based on favorites (max 2 per league × 3 leagues)
- [x] Settings sheet: Favorite Teams section (logged-in only) + Follow Teams (all)
- [x] GameTicker: compact logo+score cards, fav-team priority, fav star indicator
- [x] Middleware: Supabase session refresh
- [x] Standings page (/standings): NBA/NFL/MLB/NCAAB tabs, Division/Conference/League toggle
- [x] Standings table: ESPN just-in-time fetch, team logos, monospace stats, sticky team name, per-league columns
- [x] Box score chevron on all game cards (ScoresClient)
- [x] BoxScorePanel: NBA/NCAAB player tables (starters/bench/totals), NFL passing/rushing/receiving/team stats, MLB pitching+batting
- [x] NavBar: Standings link added alongside Feed + Scores
- [ ] Mixpanel events (TODO MAS — see above)
- [ ] Disable email confirmations in Supabase Auth settings (TODO MAS — manual dashboard action)

---

*This spec is the single source of truth for the Web agent. Do not make architectural decisions not covered here without raising a TODO MAS.*
