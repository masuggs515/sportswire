import { createClient } from '@/lib/supabase/server'
import { Game } from '@/lib/types'
import { notFound } from 'next/navigation'
import GameDetailClient from '@/components/GameDetailClient'

const LEAGUE_MAP: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  mlb: 'MLB',
  ncaab: 'NCAAB',
}

interface PageProps {
  params: Promise<{ league: string; gameId: string }>
}

export default async function GameDetailPage({ params }: PageProps) {
  const { league: leagueSlug, gameId } = await params
  const league = LEAGUE_MAP[leagueSlug.toLowerCase()]
  if (!league) notFound()

  const supabase = await createClient()
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('external_id', gameId)
    .single()

  if (!game) notFound()

  return <GameDetailClient game={game as Game} leagueSlug={leagueSlug.toLowerCase()} />
}
