import { createClient } from '@/lib/supabase/server'
import { Story, Game } from '@/lib/types'
import FeedClient from '@/components/FeedClient'

export const revalidate = 60 // revalidate every 60 seconds

export default async function FeedPage() {
  const supabase = await createClient()

  // Fetch recent stories
  const { data: stories } = await supabase
    .from('stories')
    .select('id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url, article_url')
    .order('published_at', { ascending: false })
    .limit(50)

  // Fetch games for ticker: today + tomorrow (catches live, today's finals, upcoming)
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

  return (
    <FeedClient
      initialStories={(stories ?? []) as Story[]}
      initialGames={(games ?? []) as Game[]}
    />
  )
}
