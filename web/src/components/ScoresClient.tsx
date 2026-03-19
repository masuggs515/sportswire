'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Game, GameCompetitor, GameDetails } from '@/lib/types'
import { getTeam } from '@/lib/teamConfig'
import { createClient } from '@/lib/supabase/client'

const LEAGUE_TABS = ['All', 'NBA', 'NFL', 'MLB', 'NCAAB'] as const
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

// ─── TeamLogo ────────────────────────────────────────────────────────────────

function TeamLogo({ logo, abbr, color }: { logo?: string | null; abbr: string; color: string }) {
  const [imgError, setImgError] = useState(false)

  if (!logo || imgError) {
    return (
      <div
        className="w-10 h-10 rounded-sm flex items-center justify-center text-xs font-bold text-white"
        style={{ backgroundColor: color || '#374151' }}
      >
        {abbr}
      </div>
    )
  }

  return (
    <div className="w-10 h-10 relative flex-shrink-0">
      <Image
        src={logo}
        alt={abbr}
        fill
        className="object-contain rounded-sm"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  )
}

// ─── LinescoreTable ──────────────────────────────────────────────────────────

function LinescoreTable({ game, homeComp, awayComp }: {
  game: Game
  homeComp: GameCompetitor
  awayComp: GameCompetitor
}) {
  const league = game.league

  if (league === 'MLB') {
    // MLB: innings 1–9 (or more) | R H E
    const maxInnings = Math.max(
      awayComp.linescores.length,
      homeComp.linescores.length,
      9
    )
    const innings = Array.from({ length: maxInnings }, (_, i) => i + 1)

    const getStat = (comp: GameCompetitor, name: string) =>
      comp.statistics.find(s => s.name === name)?.displayValue ?? '—'

    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-gray-600">
              <th className="text-left pr-2 font-normal w-8"></th>
              {innings.map(i => (
                <th key={i} className="text-center px-1 font-normal w-6">{i}</th>
              ))}
              <th className="text-center px-1 font-semibold border-l border-gray-700 w-6">R</th>
              <th className="text-center px-1 font-normal w-6">H</th>
              <th className="text-center px-1 font-normal w-6">E</th>
            </tr>
          </thead>
          <tbody>
            {[awayComp, homeComp].map(comp => (
              <tr key={comp.homeAway} className="text-gray-300">
                <td className="text-left pr-2 text-gray-500 font-sans text-xs">
                  {comp.team.abbreviation}
                </td>
                {innings.map(i => {
                  const ls = comp.linescores.find(l => l.period === i)
                  return (
                    <td key={i} className="text-center px-1">
                      {ls ? ls.displayValue : '—'}
                    </td>
                  )
                })}
                <td className="text-center px-1 font-bold border-l border-gray-700">
                  {comp.score}
                </td>
                <td className="text-center px-1">{getStat(comp, 'hits')}</td>
                <td className="text-center px-1">{getStat(comp, 'errors')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (league === 'NCAAB') {
    // NCAAB: 1H 2H (OT) | T
    const maxPeriods = Math.max(awayComp.linescores.length, homeComp.linescores.length)
    const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1)
    const periodLabel = (i: number) => i === 1 ? '1H' : i === 2 ? '2H' : `OT${i - 2}`

    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-gray-600">
              <th className="text-left pr-2 font-normal w-8"></th>
              {periods.map(i => (
                <th key={i} className="text-center px-1 font-normal w-8">{periodLabel(i)}</th>
              ))}
              <th className="text-center px-1 font-semibold border-l border-gray-700 w-6">T</th>
            </tr>
          </thead>
          <tbody>
            {[awayComp, homeComp].map(comp => (
              <tr key={comp.homeAway} className="text-gray-300">
                <td className="text-left pr-2 text-gray-500 font-sans text-xs">
                  {comp.team.abbreviation}
                </td>
                {periods.map(i => {
                  const ls = comp.linescores[i - 1]
                  return (
                    <td key={i} className="text-center px-1">
                      {ls ? ls.displayValue : '—'}
                    </td>
                  )
                })}
                <td className="text-center px-1 font-bold border-l border-gray-700">
                  {comp.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // NBA / NFL: Q1 Q2 Q3 Q4 (OT) | T
  const maxPeriods = Math.max(awayComp.linescores.length, homeComp.linescores.length)
  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1)
  const periodLabel = (i: number) => {
    if (i <= 4) return `Q${i}`
    return `OT${i - 4 > 1 ? i - 4 : ''}`
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-gray-600">
            <th className="text-left pr-2 font-normal w-8"></th>
            {periods.map(i => (
              <th key={i} className="text-center px-1 font-normal w-8">{periodLabel(i)}</th>
            ))}
            <th className="text-center px-1 font-semibold border-l border-gray-700 w-6">T</th>
          </tr>
        </thead>
        <tbody>
          {[awayComp, homeComp].map(comp => (
            <tr key={comp.homeAway} className="text-gray-300">
              <td className="text-left pr-2 text-gray-500 font-sans text-xs">
                {comp.team.abbreviation}
              </td>
              {periods.map(i => {
                const ls = comp.linescores[i - 1]
                return (
                  <td key={i} className="text-center px-1">
                    {ls ? ls.displayValue : '—'}
                  </td>
                )
              })}
              <td className="text-center px-1 font-bold border-l border-gray-700">
                {comp.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── BaserunnerDiagram ───────────────────────────────────────────────────────

function BaserunnerDiagram({ onFirst, onSecond, onThird }: {
  onFirst?: boolean
  onSecond?: boolean
  onThird?: boolean
}) {
  const base = (filled: boolean) => (
    <div
      className={`w-3 h-3 rotate-45 border ${
        filled ? 'bg-yellow-400 border-yellow-400' : 'bg-transparent border-gray-600'
      }`}
    />
  )

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div>{base(!!onSecond)}</div>
      <div className="flex gap-0.5">
        {base(!!onThird)}
        <div className="w-3" />
        {base(!!onFirst)}
      </div>
    </div>
  )
}

// ─── LiveSituation ───────────────────────────────────────────────────────────

function LiveSituation({ game, details }: { game: Game; details: GameDetails }) {
  const sit = details.situation
  if (!sit) return null

  if (game.league === 'MLB') {
    return (
      <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400 space-y-2">
        <div className="flex items-center gap-4">
          <span className="text-gray-300">
            {sit.balls ?? 0}-{sit.strikes ?? 0} Count · {sit.outs ?? 0} Out{sit.outs !== 1 ? 's' : ''}
          </span>
          <BaserunnerDiagram
            onFirst={sit.onFirst}
            onSecond={sit.onSecond}
            onThird={sit.onThird}
          />
        </div>
        {sit.batter && (
          <div>
            <span className="text-gray-500">AB: </span>
            <span className="text-gray-300">{sit.batter.athlete.fullName}</span>
            {sit.batter.summary && <span className="text-gray-500"> · {sit.batter.summary}</span>}
          </div>
        )}
        {sit.pitcher && (
          <div>
            <span className="text-gray-500">P: </span>
            <span className="text-gray-300">{sit.pitcher.athlete.fullName}</span>
            {sit.pitcher.summary && <span className="text-gray-500"> · {sit.pitcher.summary}</span>}
          </div>
        )}
      </div>
    )
  }

  if (game.league === 'NFL' && (sit.shortDownDistanceText || sit.yardLine != null)) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400">
        {sit.shortDownDistanceText}
        {sit.yardLine != null && ` · Yd ${sit.yardLine}`}
      </div>
    )
  }

  return null
}

// ─── Leaders ─────────────────────────────────────────────────────────────────

function LeaderRow({ name, headshot, stat }: { name: string; headshot: string | null; stat: string }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className="flex items-center gap-1.5">
      {headshot && !imgError ? (
        <div className="w-6 h-6 relative flex-shrink-0 rounded-full overflow-hidden">
          <Image
            src={headshot}
            alt={name}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized
          />
        </div>
      ) : (
        <div className="w-6 h-6 bg-gray-800 rounded-full flex-shrink-0" />
      )}
      <span className="text-gray-400 text-xs truncate">
        {name} — {stat}
      </span>
    </div>
  )
}

function Leaders({ game, details }: { game: Game; details: GameDetails }) {
  const league = game.league
  const isLive = game.status === 'in_progress'
  const isFinal = game.status === 'final'

  if (!isLive && !isFinal) return null

  // MLB final: show winning/losing pitcher from featuredAthletes
  if (league === 'MLB' && isFinal && details.featuredAthletes?.length) {
    const wp = details.featuredAthletes.find(fa => fa.name === 'winningPitcher')
    const lp = details.featuredAthletes.find(fa => fa.name === 'losingPitcher')
    const sv = details.featuredAthletes.find(fa => fa.name === 'savePitcher')

    const statLine = (fa: typeof wp) => {
      if (!fa) return null
      const era = fa.statistics.find(s => s.name === 'ERA')?.displayValue
      const w   = fa.statistics.find(s => s.name === 'wins' || s.name === 'W')?.displayValue
      const l   = fa.statistics.find(s => s.name === 'losses' || s.name === 'L')?.displayValue
      const sv2 = fa.statistics.find(s => s.name === 'saves' || s.name === 'SV')?.displayValue
      const parts = []
      if (w != null && l != null) parts.push(`${w}-${l}`)
      if (era) parts.push(`${era} ERA`)
      if (sv2) parts.push(`${sv2} SV`)
      return parts.join(', ') || ''
    }

    return (
      <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
        {wp && <LeaderRow name={`W: ${wp.athlete.fullName}`} headshot={wp.athlete.headshot} stat={statLine(wp) ?? ''} />}
        {lp && <LeaderRow name={`L: ${lp.athlete.fullName}`} headshot={lp.athlete.headshot} stat={statLine(lp) ?? ''} />}
        {sv && <LeaderRow name={`SV: ${sv.athlete.fullName}`} headshot={sv.athlete.headshot} stat={statLine(sv) ?? ''} />}
      </div>
    )
  }

  // For NBA/NFL/MLB live + NCAAB: top performer per team
  const leaderNameMap: Record<string, string[]> = {
    NBA:   ['points', 'rebounds', 'assists'],
    NFL:   ['passingYards', 'rushingYards', 'receivingYards'],
    MLB:   ['avg', 'homeRuns', 'RBIs'],
    NCAAB: ['points'],
  }
  const preferred = leaderNameMap[league] ?? ['points']

  const rows: Array<{ name: string; headshot: string | null; stat: string }> = []

  for (const comp of details.competitors) {
    for (const pref of preferred) {
      const leader = comp.leaders.find(l => l.name === pref)
      if (leader?.leaders?.[0]) {
        const ll = leader.leaders[0]
        rows.push({
          name:    ll.athlete.fullName,
          headshot: ll.athlete.headshot,
          stat:    ll.displayValue,
        })
        break
      }
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
      {rows.map((r, i) => (
        <LeaderRow key={i} name={r.name} headshot={r.headshot} stat={r.stat} />
      ))}
    </div>
  )
}

// ─── SeasonBadge ─────────────────────────────────────────────────────────────

function SeasonBadge({ seasonType }: { seasonType: number | null | undefined }) {
  if (seasonType === 1) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-medium">
        Spring Training
      </span>
    )
  }
  if (seasonType === 3) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 font-medium">
        Playoffs
      </span>
    )
  }
  return null
}

// ─── GameCard ────────────────────────────────────────────────────────────────

function GameCard({ game }: { game: Game }) {
  const isLive = game.status === 'in_progress'
  const isFinal = game.status === 'final'
  const isScheduled = game.status === 'scheduled'
  const details = game.details

  // Find competitors from details if available, else fall back to teamConfig
  const homeComp = details?.competitors.find(c => c.homeAway === 'home')
  const awayComp = details?.competitors.find(c => c.homeAway === 'away')

  const fallbackHome = getTeam(game.home_team, game.league)
  const fallbackAway = getTeam(game.away_team, game.league)

  const homeColor = homeComp?.team.color ? `#${homeComp.team.color}` : (fallbackHome?.primaryColor ?? '#6B7280')
  const awayColor = awayComp?.team.color ? `#${awayComp.team.color}` : (fallbackAway?.primaryColor ?? '#6B7280')

  const homeAbbr = homeComp?.team.abbreviation ?? game.home_team
  const awayAbbr = awayComp?.team.abbreviation ?? game.away_team
  const homeName = homeComp?.team.displayName ?? fallbackHome?.fullName ?? game.home_team
  const awayName = awayComp?.team.displayName ?? fallbackAway?.fullName ?? game.away_team

  // Bold the winning team if final
  const awayWins = isFinal && game.away_score > game.home_score
  const homeWins = isFinal && game.home_score > game.away_score

  // Human-readable status — prefer clock (ESPN), fall back to period (NCAAB/BDL legacy)
  const statusDisplay = game.clock ?? game.period ?? 'LIVE'

  const showLinescore = (isLive || isFinal) && homeComp && awayComp &&
    (homeComp.linescores.length > 0 || awayComp.linescores.length > 0)

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 ${isLive ? 'border-green-500/40' : 'border-gray-800'}`}>
      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {game.league}
          </span>
          {game.league === 'MLB' && (
            <SeasonBadge seasonType={details?.seasonType} />
          )}
          {game.broadcast && (
            <span className="text-xs text-gray-600">{game.broadcast}</span>
          )}
        </div>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {statusDisplay}
          </span>
        )}
        {isFinal && (
          <span className="text-xs font-semibold text-gray-500">FINAL</span>
        )}
        {isScheduled && (
          <span className="text-xs text-gray-400">{formatTime(game.game_time)}</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-stretch gap-4">
        {/* Away */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <TeamLogo logo={awayComp?.team.logo} abbr={awayAbbr} color={awayColor} />
          <span className="text-xs text-gray-400">{awayAbbr}</span>
        </div>

        {/* Scores / vs */}
        <div className="flex-1 flex items-center justify-between">
          <div className="flex-1">
            <div className={`text-base font-semibold mb-0.5 ${awayWins ? 'text-white' : 'text-gray-300'}`}>
              {awayName}
            </div>
            <div className={`text-base font-semibold ${homeWins ? 'text-white' : 'text-gray-300'}`}>
              {homeName}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xl tabular-nums ${awayWins ? 'font-bold text-white' : 'font-medium text-gray-400'}`}>
              {(isLive || isFinal) ? game.away_score : '—'}
            </div>
            <div className={`text-xl tabular-nums ${homeWins ? 'font-bold text-white' : 'font-medium text-gray-400'}`}>
              {(isLive || isFinal) ? game.home_score : '—'}
            </div>
          </div>
        </div>

        {/* Home */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <TeamLogo logo={homeComp?.team.logo} abbr={homeAbbr} color={homeColor} />
          <span className="text-xs text-gray-400">{homeAbbr}</span>
        </div>
      </div>

      {/* Win probability for scheduled */}
      {isScheduled && game.home_win_prob !== null && (
        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600 text-center">
          {Math.round(game.home_win_prob * 100)}% {homeAbbr} · {Math.round((1 - game.home_win_prob) * 100)}% {awayAbbr}
        </div>
      )}

      {/* Linescore table */}
      {showLinescore && homeComp && awayComp && (
        <LinescoreTable game={game} homeComp={homeComp} awayComp={awayComp} />
      )}

      {/* Live situation (MLB: count + bases, NFL: down & distance) */}
      {isLive && details && (
        <LiveSituation game={game} details={details} />
      )}

      {/* Leaders / top performers */}
      {details && (
        <Leaders game={game} details={details} />
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

  // Offseason messages per league
  const offseasonMsg: Partial<Record<LeagueTab, string>> = {
    NFL:  'NFL season returns in September',
    NBA:  'NBA season returns in October',
    MLB:  'MLB season returns in March',
  }

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
            {offseasonMsg[activeTab] ? (
              <>
                <p className="text-sm">{offseasonMsg[activeTab]}</p>
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
