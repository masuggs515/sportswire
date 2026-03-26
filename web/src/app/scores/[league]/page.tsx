import { notFound, redirect } from 'next/navigation'

const LEAGUE_MAP: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  mlb: 'MLB',
  ncaab: 'NCAAB',
}

interface PageProps {
  params: Promise<{ league: string }>
}

export default async function ScoresLeaguePage({ params }: PageProps) {
  const { league: leagueSlug } = await params
  const league = LEAGUE_MAP[leagueSlug.toLowerCase()]
  if (!league) notFound()
  redirect(`/scores?tab=${league}`)
}
