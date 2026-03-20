export interface Story {
  id: string
  external_id: string
  league: string
  team_tags: string[]
  headline: string
  rss_summary: string | null
  ai_summary: string | null
  ai_analysis: string | null
  article_url: string
  image_url: string | null
  published_at: string
  fetched_at: string
  is_hot: boolean
  view_count: number
}

export interface GameCompetitorTeam {
  displayName: string
  abbreviation: string
  color: string
  logo: string
}

export interface GameLinescore {
  period: number
  displayValue: string
}

export interface GameLeaderEntry {
  athlete: { fullName: string; headshot: string | null }
  displayValue: string
}

export interface GameLeader {
  name: string
  leaders: GameLeaderEntry[]
}

export interface GameProbable {
  name: string
  athlete: { fullName: string; headshot: string | null }
  statistics: Array<{ name: string; displayValue: string }>
}

export interface GameCompetitor {
  homeAway: 'home' | 'away'
  team: GameCompetitorTeam
  score: string
  linescores: GameLinescore[]
  statistics: Array<{ name: string; displayValue: string }>
  leaders: GameLeader[]
  records: Array<{ summary: string }>
  probables?: GameProbable[]
}

export interface GameSituation {
  balls?: number
  strikes?: number
  outs?: number
  onFirst?: boolean
  onSecond?: boolean
  onThird?: boolean
  batter?: { athlete: { fullName: string }; summary: string }
  pitcher?: { athlete: { fullName: string }; summary: string }
  possession?: string
  shortDownDistanceText?: string
  yardLine?: number
}

export interface GameFeaturedAthlete {
  name: string
  athlete: { fullName: string; headshot: string | null }
  statistics: Array<{ name: string; displayValue: string }>
}

export interface GameDetails {
  competitors: GameCompetitor[]
  situation: GameSituation | null
  featuredAthletes: GameFeaturedAthlete[] | null
  broadcast: string | null
  seasonType: number | null
  seasonSlug: string | null
}

export interface Game {
  id: string
  external_id: string
  league: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  status: 'scheduled' | 'in_progress' | 'final'
  game_time: string
  period: string | null
  clock: string | null
  broadcast: string | null
  details: GameDetails | null
  home_win_prob: number | null
  box_score: Record<string, unknown> | null
  fetched_at: string
}

export interface Standing {
  id: string
  league: string
  conference: string | null
  team_abbr: string
  team_name: string
  wins: number
  losses: number
  win_pct: number
  conference_rank: number | null
  fetched_at: string
}

export interface Team {
  abbr: string
  league: string
  full_name: string
  city: string | null
  conference: string | null
  division: string | null
  primary_color: string | null
  accent_color: string | null
  logo_url: string | null
  stadium: string | null
  description: string | null
  updated_at: string
}

export interface FavoriteTeam {
  league: 'NFL' | 'NBA' | 'MLB'
  espnId: number
  name: string
  abbr: string
}

// ── ESPN Summary / Box Score (fetched client-side, just-in-time) ──────────────

export interface EspnBoxAthlete {
  athlete: {
    id: string
    displayName: string
    shortName?: string
    headshot?: { href: string }
    jersey?: string
    position?: { abbreviation: string }
  }
  starter?: boolean
  stats: string[]
  active?: boolean
  didNotPlay?: boolean
}

export interface EspnStatGroup {
  type?: { abbreviation: string; name: string }
  names: string[]
  athletes: EspnBoxAthlete[]
  totals?: string[]
}

export interface EspnBoxTeamStats {
  team: { abbreviation: string; displayName: string }
  statistics: Array<{ name: string; displayValue: string }>
}

export interface EspnBoxPlayer {
  team: { abbreviation: string; displayName: string; color?: string }
  statistics: EspnStatGroup[]
}

export interface EspnBoxScore {
  teams?: EspnBoxTeamStats[]
  players?: EspnBoxPlayer[]
}

export interface EspnSummaryResponse {
  boxscore?: EspnBoxScore
}

// ── ESPN Standings (fetched client-side, just-in-time) ───────────────────────

export interface EspnStandingEntry {
  team: {
    id: string
    displayName: string
    abbreviation: string
    logos: Array<{ href: string }>
    color: string
    alternateColor?: string
  }
  note?: { color: string; text: string }
  stats: Array<{ name: string; displayValue: string; value?: number }>
}

export interface EspnStandingGroup {
  name: string
  entries: EspnStandingEntry[]
}

export interface EspnStandingConference {
  name: string
  divisions: EspnStandingGroup[]
}

export type StandingsView = 'Division' | 'Conference' | 'League'

export interface StoryDetail {
  story: Story
  recentGames: Game[]
  upcomingGames: Game[]
  standings: Standing[]
  related: Pick<Story, 'id' | 'headline' | 'ai_summary' | 'league' | 'team_tags' | 'published_at' | 'is_hot'>[]
  teams: Pick<Team, 'abbr' | 'full_name' | 'primary_color' | 'accent_color' | 'logo_url'>[]
}
