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

export interface StoryDetail {
  story: Story
  recentGames: Game[]
  upcomingGames: Game[]
  standings: Standing[]
  related: Pick<Story, 'id' | 'headline' | 'ai_summary' | 'league' | 'team_tags' | 'published_at' | 'is_hot'>[]
  teams: Pick<Team, 'abbr' | 'full_name' | 'primary_color' | 'accent_color' | 'logo_url'>[]
}
