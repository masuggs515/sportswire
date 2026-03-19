'use client'

import { useEffect, useState } from 'react'
import { Game } from '@/lib/types'
import { getTeam } from '@/lib/teamConfig'
import { createClient } from '@/lib/supabase/client'

const LEAGUE_TABS = ['All', 'NBA', 'NFL', 'NCAAB'] as const
type LeagueTab = typeof LEAGUE_TABS[number]

interface ScoresClientProps {
  initialGames: Game[]
  serverNow: string
}

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ─── GameCard ────────────────────────────────────────────────────────────────

function GameCard({ game }: { game: Game }) {
  const isLive = game.status === 'in_progress'
  const isFinal = game.status === 'final'
  const isScheduled = game.status === 'scheduled'

  const awayTeam = getTeam(game.away_team, game.league)
  const homeTeam = getTeam(game.home_team, game.league)
  const awayColor = awayTeam?.primaryColor ?? '#6B7280'
  const homeColor = homeTeam?.primaryColor ?? '#6B7280'

  // Bold the winning team if final
  const awayWins = isFinal && game.away_score > game.home_score
  const homeWins = isFinal && game.home_score > game.away_score

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 ${isLive ? 'border-green-500/40' : 'border-gray-800'}`}>
      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {game.league}
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {game.period ?? 'LIVE'}
          </span>
        )}
        {isFinal && (
          <span className="text-xs font-semibold text-gray-500">FINAL</span>
        )}
        {isScheduled && (
          <span className="text-xs text-gray-400">{formatTime(game.game_time)}</span>
        )}
      </div>

      {/* Away team */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: awayColor }} />
          <span className={`text-base font-semibold ${awayWins ? 'text-white' : 'text-gray-300'}`}>
            {game.away_team}
          </span>
          {awayTeam && (
            <span className="text-xs text-gray-600 hidden sm:block">{awayTeam.fullName}</span>
          )}
        </div>
        <span className={`text-lg tabular-nums ${awayWins ? 'font-bold text-white' : 'font-medium text-gray-400'}`}>
          {(isLive || isFinal) ? game.away_score : '—'}
        </span>
      </div>

      {/* Home team */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: homeColor }} />
          <span className={`text-base font-semibold ${homeWins ? 'text-white' : 'text-gray-300'}`}>
            {game.home_team}
          </span>
          {homeTeam && (
            <span className="text-xs text-gray-600 hidden sm:block">{homeTeam.fullName}</span>
          )}
        </div>
        <span className={`text-lg tabular-nums ${homeWins ? 'font-bold text-white' : 'font-medium text-gray-400'}`}>
          {(isLive || isFinal) ? game.home_score : '—'}
        </span>
      </div>

      {/* Win probability for scheduled */}
      {isScheduled && game.home_win_prob !== null && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600 text-center">
          {Math.round(game.home_win_prob * 100)}% {game.home_team} · {Math.round((1 - game.home_win_prob) * 100)}% {game.away_team}
        </div>
      )}
    </div>
  )
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({
  title,
  games,
  accent,
  subtitle,
}: {
  title: string
  games: Game[]
  accent?: string
  subtitle?: string
}) {
  if (games.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3">
        {accent && <div className="w-1 h-4 rounded" style={{ backgroundColor: accent }} />}
        <h2 className="text-white font-semibold text-sm uppercase tracking-wide">{title}</h2>
        {subtitle && <span className="text-gray-600 text-xs">{subtitle}</span>}
        <span className="text-gray-600 text-xs ml-auto">{games.length} game{games.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="px-4 space-y-3">
        {games.map(g => <GameCard key={g.id} game={g} />)}
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ScoresClient({ initialGames, serverNow }: ScoresClientProps) {
  const [activeTab, setActiveTab] = useState<LeagueTab>('All')
  const [games, setGames] = useState<Game[]>(initialGames)

  // Supabase Realtime for live score updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('scores-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setGames(prev => [...prev, payload.new as Game].sort(
              (a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime()
            ))
          } else if (payload.eventType === 'UPDATE') {
            setGames(prev =>
              prev.map(g => g.id === payload.new.id ? payload.new as Game : g)
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const now = new Date(serverNow)
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Filter by league tab
  const tabGames = activeTab === 'All'
    ? games
    : games.filter(g => g.league === activeTab)

  // Partition into sections
  const live = tabGames.filter(g => g.status === 'in_progress')

  const todayGames = tabGames.filter(g => {
    const gDate = new Date(g.game_time)
    return isSameDay(gDate, today) && g.status !== 'in_progress'
  })

  const upcoming = tabGames.filter(g => {
    const gDate = new Date(g.game_time)
    return g.status === 'scheduled' && gDate > today && !isSameDay(gDate, today)
  })

  const recent = tabGames.filter(g => {
    const gDate = new Date(g.game_time)
    return g.status === 'final' && isSameDay(gDate, yesterday)
  })

  // Group upcoming by date label
  const upcomingByDate = upcoming.reduce<Record<string, Game[]>>((acc, g) => {
    const label = formatDate(g.game_time)
    if (!acc[label]) acc[label] = []
    acc[label].push(g)
    return acc
  }, {})

  const hasAnyGames = live.length + todayGames.length + upcoming.length + recent.length > 0

  return (
    <div>
      {/* League Tabs */}
      <div className="flex border-b border-gray-800 px-4 sticky top-14 z-30 bg-gray-950">
        {LEAGUE_TABS.map(tab => (
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

      <div className="py-4 space-y-6">
        {!hasAnyGames ? (
          <div className="px-4 py-12 text-center text-gray-600">
            {activeTab === 'NFL' ? (
              <>
                <p className="text-sm">NFL season returns in September</p>
                <p className="text-xs mt-1">Check back then for live scores and schedules</p>
              </>
            ) : (
              <p className="text-sm">No games in this window</p>
            )}
          </div>
        ) : (
          <>
            {/* LIVE */}
            <Section
              title="Live"
              games={live}
              accent="#22C55E"
            />

            {/* TODAY */}
            <Section
              title="Today"
              games={todayGames}
              accent="#3B82F6"
              subtitle={today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />

            {/* UPCOMING — grouped by date */}
            {Object.entries(upcomingByDate).map(([dateLabel, dateGames]) => (
              <Section
                key={dateLabel}
                title={dateLabel}
                games={dateGames}
                accent="#6B7280"
              />
            ))}

            {/* RECENT */}
            <Section
              title="Yesterday"
              games={recent}
              accent="#4B5563"
              subtitle={yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
          </>
        )}
      </div>
    </div>
  )
}
