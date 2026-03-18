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

  const gameDate = new Date(game.game_time)
  const timeStr = gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div className="flex-shrink-0 bg-gray-900 border border-gray-800 rounded-xl p-3 w-40">
      {/* Status */}
      <div className="text-center mb-2">
        {isLive ? (
          <span className="text-xs text-green-400 font-semibold">
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
  if (games.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-4">
        No games today
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-4">
      {games.map(game => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  )
}
