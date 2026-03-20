'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Game, FavoriteTeam } from '@/lib/types'

interface GameTickerProps {
  games: Game[]
  favorites?: FavoriteTeam[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getCompetitor(game: Game, side: 'home' | 'away') {
  return game.details?.competitors.find(c => c.homeAway === side)
}

function gameFeaturesFavorite(game: Game, favAbbrs: Set<string>): boolean {
  if (favAbbrs.size === 0) return false
  const competitors = game.details?.competitors ?? []
  return competitors.some(c => favAbbrs.has(c.team.abbreviation))
}

// ─── TeamLogo — compact, 32px ─────────────────────────────────────────────────

function TeamLogo({ logo, abbr, color }: { logo?: string | null; abbr: string; color?: string }) {
  const [imgError, setImgError] = useState(false)

  if (!logo || imgError) {
    return (
      <div
        className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: color || '#374151' }}
      >
        {abbr.slice(0, 3)}
      </div>
    )
  }

  return (
    <div className="w-8 h-8 relative flex-shrink-0">
      <Image
        src={logo}
        alt={abbr}
        fill
        className="object-contain"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  )
}

// ─── TickerCard ───────────────────────────────────────────────────────────────

function TickerCard({ game, isFavorite }: { game: Game; isFavorite: boolean }) {
  const isLive = game.status === 'in_progress'
  const isFinal = game.status === 'final'

  const awayComp = getCompetitor(game, 'away')
  const homeComp = getCompetitor(game, 'home')

  const awayAbbr = awayComp?.team.abbreviation ?? game.away_team.slice(0, 3).toUpperCase()
  const homeAbbr = homeComp?.team.abbreviation ?? game.home_team.slice(0, 3).toUpperCase()
  const awayColor = awayComp?.team.color ? `#${awayComp.team.color}` : undefined
  const homeColor = homeComp?.team.color ? `#${homeComp.team.color}` : undefined

  const statusDisplay = game.clock ?? game.period ?? 'LIVE'

  const timeStr = new Date(game.game_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const awayWins = isFinal && game.away_score > game.home_score
  const homeWins = isFinal && game.home_score > game.away_score

  return (
    <div className={`flex-shrink-0 rounded-xl p-3 w-32 border ${
      isLive
        ? 'bg-gray-900 border-green-500/40'
        : isFavorite
        ? 'bg-gray-900 border-blue-500/30'
        : 'bg-gray-900 border-gray-800'
    }`}>
      {/* Status */}
      <div className="text-center mb-2">
        {isLive ? (
          <span className="flex items-center justify-center gap-1 text-xs text-green-400 font-semibold">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {statusDisplay}
          </span>
        ) : isFinal ? (
          <span className="text-xs text-gray-500 font-semibold">FINAL</span>
        ) : (
          <span className="text-xs text-gray-500">{timeStr}</span>
        )}
      </div>

      {/* Away row: logo + score */}
      <div className="flex items-center justify-between mb-1.5">
        <TeamLogo logo={awayComp?.team.logo} abbr={awayAbbr} color={awayColor} />
        {(isLive || isFinal) && (
          <span className={`text-sm tabular-nums ml-2 ${awayWins ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
            {game.away_score}
          </span>
        )}
      </div>

      {/* Home row: logo + score */}
      <div className="flex items-center justify-between">
        <TeamLogo logo={homeComp?.team.logo} abbr={homeAbbr} color={homeColor} />
        {(isLive || isFinal) && (
          <span className={`text-sm tabular-nums ml-2 ${homeWins ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
            {game.home_score}
          </span>
        )}
      </div>

      {/* Favorite star */}
      {isFavorite && !isLive && (
        <div className="text-center mt-1.5">
          <span className="text-blue-500 text-xs">★</span>
        </div>
      )}
    </div>
  )
}

// ─── GameTicker ───────────────────────────────────────────────────────────────

export default function GameTicker({ games, favorites = [] }: GameTickerProps) {
  const favAbbrs = new Set(favorites.map(f => f.abbr))

  const live     = games.filter(g => g.status === 'in_progress')
  const finals   = games.filter(g => g.status === 'final')
  const upcoming = games.filter(g => g.status === 'scheduled')

  // Priority: 1. live, 2. favorite-team games (non-live), 3. finals, 4. upcoming
  const nonLive = [...finals, ...upcoming]
  const favGames    = nonLive.filter(g => gameFeaturesFavorite(g, favAbbrs))
  const nonFavGames = nonLive.filter(g => !gameFeaturesFavorite(g, favAbbrs))

  const display = [
    ...live,
    ...favGames,
    ...nonFavGames,
  ]

  if (display.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-3">
        No games today
      </div>
    )
  }

  const label = live.length > 0 ? 'Live Now' : favGames.length > 0 ? 'Your Teams' : finals.length > 0 ? 'Recent' : 'Upcoming'

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
          <TickerCard
            key={game.id}
            game={game}
            isFavorite={gameFeaturesFavorite(game, favAbbrs)}
          />
        ))}
      </div>
    </div>
  )
}
