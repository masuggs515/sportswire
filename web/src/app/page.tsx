import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Story, Game, FavoriteTeam, StoryDetail } from '@/lib/types'
import FeedClient from '@/components/FeedClient'
import ScoresClient from '@/components/ScoresClient'
import StandingsClient from '@/components/StandingsClient'
import StoryDetailClient from '@/components/StoryDetailClient'

interface PageProps {
  searchParams: Promise<{ view?: string; id?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const { view, id } = await searchParams
  const supabase = await createClient()

  // ── Story detail ──────────────────────────────────────────────────────────
  if (view === 'story') {
    if (!id) notFound()
    const { data, error } = await supabase.functions.invoke('get-story-detail', {
      body: { storyId: id },
    })
    if (error || !data || data.error) notFound()
    return <StoryDetailClient detail={data as StoryDetail} />
  }

  // ── Scores ────────────────────────────────────────────────────────────────
  if (view === 'scores') {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const threeDaysOut = new Date()
    threeDaysOut.setDate(threeDaysOut.getDate() + 3)
    threeDaysOut.setHours(23, 59, 59, 999)

    const [rangeResult, liveResult] = await Promise.all([
      supabase
        .from('games')
        .select('*')
        .gte('game_time', yesterday.toISOString())
        .lte('game_time', threeDaysOut.toISOString())
        .order('game_time', { ascending: true }),
      supabase
        .from('games')
        .select('*')
        .eq('status', 'in_progress')
        .order('game_time', { ascending: true }),
    ])

    const seen = new Set<string>()
    const games: Game[] = []
    for (const g of [...(liveResult.data ?? []), ...(rangeResult.data ?? [])]) {
      if (!seen.has(g.id)) {
        seen.add(g.id)
        games.push(g as Game)
      }
    }
    games.sort((a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime())

    return <ScoresClient initialGames={games} serverNow={new Date().toISOString()} />
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  if (view === 'standings') {
    return <StandingsClient />
  }

  // ── Feed (default) ────────────────────────────────────────────────────────
  const { data: stories } = await supabase
    .from('stories')
    .select('id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url, article_url')
    .order('published_at', { ascending: false })
    .limit(50)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const twoDaysOut = new Date(today)
  twoDaysOut.setDate(twoDaysOut.getDate() + 2)

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .gte('game_time', today.toISOString())
    .lt('game_time', twoDaysOut.toISOString())
    .order('game_time', { ascending: true })
    .limit(20)

  const { data: { user } } = await supabase.auth.getUser()
  let initialFavorites: FavoriteTeam[] = []
  if (user) {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('favorite_teams')
      .eq('user_id', user.id)
      .maybeSingle()
    initialFavorites = prefs?.favorite_teams ?? []
  }

  return (
    <FeedClient
      initialStories={(stories ?? []) as Story[]}
      initialGames={(games ?? []) as Game[]}
      initialFavorites={initialFavorites}
    />
  )
}
