'use client'

import { Game } from '@/lib/types'
import { getTeamColor } from '@/lib/teamConfig'

interface GameTickerProps {
  games: Game[]
}

function GameCard({ game }: { game: Game }) {
  const homeColor = getTeamColor(game.home_team, game.league)
  const awayColor = getTeamColor(game.away_team, game.league)
  const isFinal = game.status === 'final'
  const isLive = game.status === 'in_progress'

  const timeStr = new Date(game.game_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className={`flex-shrink-0 rounded-xl p-3 w-40 border ${
      isLive
        ? 'bg-gray-900 border-green-500/40'
        : 'bg-gray-900 border-gray-800'
    }`}>
      {/* Status */}
      <div className="text-center mb-2">
        {isLive ? (
          <span className="flex items-center justify-center gap-1 text-xs text-green-400 font-semibold">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {game.period ?? 'LIVE'}
          </span>
        ) : isFinal ? (
          <span className="text-xs text-gray-500 font-semibold">FINAL</span>
        ) : (
          <span className="text-xs text-gray-500">{timeStr}</span>
        )}
      </div>

      {/* Away team */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: awayColor }} />
          <span className="text-sm font-semibold text-white">{game.away_team}</span>
        </div>
        {(isLive || isFinal) && (
          <span className="text-sm font-bold text-white">{game.away_score}</span>
        )}
      </div>

      {/* Home team */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: homeColor }} />
          <span className="text-sm font-semibold text-white">{game.home_team}</span>
        </div>
        {(isLive || isFinal) && (
          <span className="text-sm font-bold text-white">{game.home_score}</span>
        )}
      </div>

      {/* Win probability for upcoming */}
      {!isLive && !isFinal && game.home_win_prob !== null && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          {Math.round(game.home_win_prob * 100)}% {game.home_team}
        </div>
      )}
    </div>
  )
}

export default function GameTicker({ games }: GameTickerProps) {
  const live = games.filter(g => g.status === 'in_progress')
  const upcoming = games.filter(g => g.status === 'scheduled')
  const finished = games.filter(g => g.status === 'final')

  // Priority: show live games; if none show upcoming; if none show recent finals
  const display = live.length > 0 ? live : upcoming.length > 0 ? upcoming : finished

  if (display.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-3">
        No games today
      </div>
    )
  }

  const label = live.length > 0
    ? 'Live Now'
    : upcoming.length > 0
    ? 'Upcoming'
    : 'Recent'

  return (
    <div>
      <div className="flex items-center gap-2 px-4 mb-2">
        {live.length > 0 && (
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        )}
        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-4">
        {display.map(game => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  )
}
