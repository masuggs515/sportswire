import { createClient } from '@/lib/supabase/server'
import { Game } from '@/lib/types'
import ScoresClient from '@/components/ScoresClient'

export const revalidate = 30

export default async function ScoresPage() {
  const supabase = await createClient()

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
