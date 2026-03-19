'use client'

import { useEffect, useState } from 'react'
import { Story, Game } from '@/lib/types'
import StoryCard from './StoryCard'
import GameTicker from './GameTicker'
import { getFollowedTeams } from './SettingsSheet'
import { createClient } from '@/lib/supabase/client'

const LEAGUES = ['All', 'NBA', 'NFL', 'NCAAB'] as const
type LeagueTab = typeof LEAGUES[number]

interface FeedClientProps {
  initialStories: Story[]
  initialGames: Game[]
}

function sortStories(stories: Story[], followed: string[]): Story[] {
  const followedSet = new Set(followed)
  return [...stories].sort((a, b) => {
    const aF = a.team_tags.some(t => followedSet.has(t))
    const bF = b.team_tags.some(t => followedSet.has(t))
    if (aF !== bF) return aF ? -1 : 1
    if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })
}

export default function FeedClient({ initialStories, initialGames }: FeedClientProps) {
  const [activeTab, setActiveTab] = useState<LeagueTab>('All')
  const [followed, setFollowed] = useState<string[]>(() =>
    typeof window !== 'undefined' ? getFollowedTeams() : []
  )
  const [stories] = useState<Story[]>(initialStories)
  const [games, setGames] = useState<Game[]>(initialGames)

  // Sync followed teams from localStorage and listen for changes
  useEffect(() => {
    const onChanged = () => setFollowed(getFollowedTeams())
    window.addEventListener('followed-teams-changed', onChanged)
    return () => window.removeEventListener('followed-teams-changed', onChanged)
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

  const filteredStories = activeTab === 'All'
    ? stories
    : stories.filter(s => s.league === activeTab)

  const sorted = sortStories(filteredStories, followed)

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
        <GameTicker games={todayGames} />
      </section>

      {/* League Tabs */}
      <div className="flex border-b border-gray-800 px-4">
        {LEAGUES.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab
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
            <StoryCard key={story.id} story={story} followed={followed} />
          ))
        )}
      </div>
    </div>
  )
}
