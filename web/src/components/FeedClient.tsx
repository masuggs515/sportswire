'use client'

import { useEffect, useMemo, useState } from 'react'
import { Story, Game, FavoriteTeam } from '@/lib/types'
import StoryCard from './StoryCard'
import GameTicker from './GameTicker'
import { getFollowedTeams } from './SettingsSheet'
import { createClient } from '@/lib/supabase/client'

// Tabs that filter by story.league value
const LEAGUE_TABS = ['NBA', 'NFL', 'NCAAB', 'MLB'] as const

interface FeedClientProps {
  initialStories: Story[]
  initialGames: Game[]
  initialFavorites: FavoriteTeam[]
}

function sortStories(stories: Story[], pinnedAbbrs: Set<string>): Story[] {
  return [...stories].sort((a, b) => {
    const aF = a.team_tags.some(t => pinnedAbbrs.has(t))
    const bF = b.team_tags.some(t => pinnedAbbrs.has(t))
    if (aF !== bF) return aF ? -1 : 1
    if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })
}

export default function FeedClient({ initialStories, initialGames, initialFavorites }: FeedClientProps) {
  const [followed, setFollowed]     = useState<string[]>(() =>
    typeof window !== 'undefined' ? getFollowedTeams() : []
  )
  const [favorites, setFavorites]   = useState<FavoriteTeam[]>(initialFavorites)
  const [stories]                   = useState<Story[]>(initialStories)
  const [games, setGames]           = useState<Game[]>(initialGames)
  const [activeTab, setActiveTab]   = useState('All')

  // Sync localStorage followed teams
  useEffect(() => {
    const onChanged = () => setFollowed(getFollowedTeams())
    window.addEventListener('followed-teams-changed', onChanged)
    return () => window.removeEventListener('followed-teams-changed', onChanged)
  }, [])

  // Sync favorites when saved from settings sheet
  useEffect(() => {
    const onChanged = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('favorite_teams')
          .eq('user_id', user.id)
          .maybeSingle()
        setFavorites(prefs?.favorite_teams ?? [])
      }
    }
    window.addEventListener('favorites-changed', onChanged)
    return () => window.removeEventListener('favorites-changed', onChanged)
  }, [])

  // Supabase realtime for live game scores
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('games-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setGames(prev => [...prev, payload.new as Game])
          } else if (payload.eventType === 'UPDATE') {
            setGames(prev => prev.map(g => g.id === payload.new.id ? payload.new as Game : g))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Build dynamic tab list based on favorites
  // Order: All | NBA | [NBA favs] | NFL | [NFL favs] | Panthers (skip if CAR in favs) | NCAAB | MLB | [MLB favs] | Yankees
  const tabs = useMemo(() => {
    const hasCARFavorite = favorites.some(f => f.league === 'NFL' && f.abbr === 'CAR')
    const result: string[] = ['All', 'NBA']
    favorites.filter(f => f.league === 'NBA').slice(0, 2).forEach(f => result.push(f.abbr))
    result.push('NFL')
    favorites.filter(f => f.league === 'NFL').slice(0, 2).forEach(f => result.push(f.abbr))
    if (!hasCARFavorite) result.push('Panthers')
    result.push('NCAAB', 'MLB')
    favorites.filter(f => f.league === 'MLB').slice(0, 2).forEach(f => result.push(f.abbr))
    result.push('Yankees')
    return result
  }, [favorites])

  // Derive effective tab — if a favorite tab was removed, fall back to 'All' without setState
  const effectiveTab = tabs.includes(activeTab) ? activeTab : 'All'

  // Story sort: combine favorites + followed teams for pinning
  const pinnedAbbrs = useMemo(() => {
    const s = new Set(followed)
    favorites.forEach(f => s.add(f.abbr))
    return s
  }, [followed, favorites])

  // Filter stories for the effective tab
  const filteredStories = useMemo(() => {
    if (effectiveTab === 'All') return stories
    if ((LEAGUE_TABS as readonly string[]).includes(effectiveTab)) {
      return stories.filter(s => s.league === effectiveTab)
    }
    // Panthers tab — NFL stories tagged CAR or Panthers
    if (effectiveTab === 'Panthers') {
      return stories.filter(s => s.team_tags.includes('CAR') || s.team_tags.includes('Panthers'))
    }
    // Yankees tab — MLB stories tagged NYY or Yankees
    if (effectiveTab === 'Yankees') {
      return stories.filter(s => s.team_tags.includes('NYY') || s.team_tags.includes('Yankees'))
    }
    // Favorite team tab — filter by team_tags
    return stories.filter(s => s.team_tags.includes(effectiveTab))
  }, [stories, effectiveTab])

  const sorted = useMemo(() => sortStories(filteredStories, pinnedAbbrs), [filteredStories, pinnedAbbrs])

  const todayGames = games.filter(g => {
    const d = new Date(g.game_time)
    const today = new Date()
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  })

  return (
    <div>
      {/* Game Ticker */}
      <section className="py-3 border-b border-gray-800">
        <GameTicker games={todayGames} favorites={favorites} />
      </section>

      {/* League Tabs */}
      <div className="flex border-b border-gray-800 px-4 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              effectiveTab === tab
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Story Feed */}
      <div className="px-4 py-4 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center text-gray-600 py-12">No stories yet</div>
        ) : (
          sorted.map(story => (
            <StoryCard key={story.id} story={story} followed={[...pinnedAbbrs]} />
          ))
        )}
      </div>
    </div>
  )
}
