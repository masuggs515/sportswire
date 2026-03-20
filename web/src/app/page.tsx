import { createClient } from '@/lib/supabase/server'
import { Story, Game, FavoriteTeam } from '@/lib/types'
import FeedClient from '@/components/FeedClient'

export const revalidate = 60

export default async function FeedPage() {
  const supabase = await createClient()

  // Fetch stories
  const { data: stories } = await supabase
    .from('stories')
    .select('id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url, article_url')
    .order('published_at', { ascending: false })
    .limit(50)

  // Fetch games for ticker: today + tomorrow
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

  // Fetch user favorites (null → empty array for logged-out users)
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
