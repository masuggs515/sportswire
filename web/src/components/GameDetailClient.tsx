'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Game,
  GameCompetitor,
  GameDetails,
  EspnSummaryResponse,
  EspnBoxPlayer,
  EspnStatGroup,
  EspnBoxAthlete,
  EspnBoxTeamStats,
} from '@/lib/types'
import { getTeam } from '@/lib/teamConfig'
import { createClient } from '@/lib/supabase/client'

// ─── ESPN summary URL ────────────────────────────────────────────────────────

const SPORT_PATH: Record<string, string> = {
  NBA:   'basketball/nba',
  NFL:   'football/nfl',
  MLB:   'baseball/mlb',
  NCAAB: 'basketball/mens-college-basketball',
}

function summaryUrl(league: string, externalId: string): string {
  const path = SPORT_PATH[league] ?? 'basketball/nba'
  const eventId = externalId.includes('_') ? externalId.replace(/^[^_]+_/, '') : externalId
  return `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${eventId}`
}

// ─── Column definitions ──────────────────────────────────────────────────────

const NBA_COLS    = ['MIN', 'FG', '3PT', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const NCAAB_COLS  = ['MIN', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'PTS']
const NFL_PASS_COLS = ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'QBR']
const NFL_RUSH_COLS = ['CAR', 'YDS', 'AVG', 'LNG', 'TD']
const NFL_REC_COLS  = ['REC', 'YDS', 'AVG', 'LNG', 'TD']
const MLB_BAT_COLS  = ['AB', 'R', 'H', 'RBI', 'BB', 'K', 'AVG']
const MLB_PITCH_COLS = ['IP', 'H', 'R', 'ER', 'BB', 'K', 'ERA']

const NFL_GROUPS: Array<{ typeAbbr: string; label: string; desired: string[] }> = [
  { typeAbbr: 'passing',   label: 'Passing',   desired: NFL_PASS_COLS },
  { typeAbbr: 'rushing',   label: 'Rushing',   desired: NFL_RUSH_COLS },
  { typeAbbr: 'receiving', label: 'Receiving', desired: NFL_REC_COLS  },
]

const NFL_TEAM_STATS: Array<{ name: string; label: string }> = [
  { name: 'totalYards',     label: 'Total Yards'  },
  { name: 'turnovers',      label: 'Turnovers'    },
  { name: 'possessionTime', label: 'Poss. Time'   },
  { name: 'thirdDownEff',   label: '3rd Down'     },
  { name: 'redZoneAtts',    label: 'Red Zone'     },
]

function colIndices(names: string[], desired: string[]): number[] {
  return desired.map(d => names.indexOf(d)).filter(i => i !== -1)
}

function desiredHeaders(names: string[], desired: string[]): string[] {
  return desired.filter(d => names.includes(d))
}

function statTypeKey(type: EspnStatGroup['type']): string {
  if (!type) return ''
  return typeof type === 'string' ? type.toLowerCase() : (type.abbreviation ?? '').toLowerCase()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── TeamLogo ─────────────────────────────────────────────────────────────────

function TeamLogo({ logo, abbr, color, size = 40 }: {
  logo?: string | null
  abbr: string
  color: string
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const cls = `rounded-sm flex-shrink-0`

  if (!logo || imgError) {
    return (
      <div
        className={`${cls} flex items-center justify-center text-xs font-bold text-white`}
        style={{ backgroundColor: color || '#374151', width: size, height: size }}
      >
        {abbr}
      </div>
    )
  }

  return (
    <div className={`${cls} relative`} style={{ width: size, height: size }}>
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

// ─── LinescoreTable ───────────────────────────────────────────────────────────

function LinescoreTable({ game, homeComp, awayComp }: {
  game: Game
  homeComp: GameCompetitor
  awayComp: GameCompetitor
}) {
  const league = game.league

  if (league === 'MLB') {
    const maxInnings = Math.max(awayComp.linescores.length, homeComp.linescores.length, 9)
    const innings = Array.from({ length: maxInnings }, (_, i) => i + 1)
    const getStat = (comp: GameCompetitor, name: string) =>
      comp.statistics.find(s => s.name === name)?.displayValue ?? '—'

    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-gray-600">
              <th className="text-left pr-2 font-normal w-8" />
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
                  return <td key={i} className="text-center px-1">{ls ? ls.displayValue : '—'}</td>
                })}
                <td className="text-center px-1 font-bold border-l border-gray-700">{comp.score}</td>
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
    const maxPeriods = Math.max(awayComp.linescores.length, homeComp.linescores.length)
    const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1)
    const periodLabel = (i: number) => i === 1 ? '1H' : i === 2 ? '2H' : `OT${i - 2}`

    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-gray-600">
              <th className="text-left pr-2 font-normal w-8" />
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
                  return <td key={i} className="text-center px-1">{ls ? ls.displayValue : '—'}</td>
                })}
                <td className="text-center px-1 font-bold border-l border-gray-700">{comp.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // NBA / NFL
  const maxPeriods = Math.max(awayComp.linescores.length, homeComp.linescores.length)
  const periods = Array.from({ length: maxPeriods }, (_, i) => i + 1)
  const periodLabel = (i: number) => i <= 4 ? `Q${i}` : `OT${i - 4 > 1 ? i - 4 : ''}`

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-gray-600">
            <th className="text-left pr-2 font-normal w-8" />
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
                return <td key={i} className="text-center px-1">{ls ? ls.displayValue : '—'}</td>
              })}
              <td className="text-center px-1 font-bold border-l border-gray-700">{comp.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── BaserunnerDiagram ───────────────────────────────────────────────────────

function BaserunnerDiagram({ onFirst, onSecond, onThird }: {
  onFirst?: boolean; onSecond?: boolean; onThird?: boolean
}) {
  const base = (filled: boolean) => (
    <div className={`w-3 h-3 rotate-45 border ${filled ? 'bg-yellow-400 border-yellow-400' : 'bg-transparent border-gray-600'}`} />
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
          <BaserunnerDiagram onFirst={sit.onFirst} onSecond={sit.onSecond} onThird={sit.onThird} />
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
          <Image src={headshot} alt={name} fill className="object-cover" onError={() => setImgError(true)} unoptimized />
        </div>
      ) : (
        <div className="w-6 h-6 bg-gray-800 rounded-full flex-shrink-0" />
      )}
      <span className="text-gray-400 text-xs truncate">{name} — {stat}</span>
    </div>
  )
}

function Leaders({ game, details }: { game: Game; details: GameDetails }) {
  const league = game.league
  const isLive = game.status === 'in_progress'
  const isFinal = game.status === 'final'
  if (!isLive && !isFinal) return null

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

  const leaderNameMap: Record<string, string[]> = {
    NBA: ['points'], NFL: ['passingYards', 'rushingYards'], MLB: ['avg', 'homeRuns', 'RBIs'], NCAAB: ['points'],
  }
  const preferred = leaderNameMap[league] ?? ['points']
  const rows: Array<{ name: string; headshot: string | null; stat: string }> = []
  for (const comp of details.competitors) {
    for (const pref of preferred) {
      const leader = comp.leaders.find(l => l.name === pref)
      if (leader?.leaders?.[0]) {
        const ll = leader.leaders[0]
        rows.push({ name: ll.athlete.fullName, headshot: ll.athlete.headshot, stat: ll.displayValue })
        break
      }
    }
  }
  if (rows.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
      {rows.map((r, i) => <LeaderRow key={i} name={r.name} headshot={r.headshot} stat={r.stat} />)}
    </div>
  )
}

// ─── SeasonBadge ─────────────────────────────────────────────────────────────

function SeasonBadge({ seasonType }: { seasonType: number | null | undefined }) {
  if (seasonType === 1) return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-medium">Spring Training</span>
  )
  if (seasonType === 3) return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 font-medium">Playoffs</span>
  )
  return null
}

// ─── OverviewCard ─────────────────────────────────────────────────────────────

function OverviewCard({ game }: { game: Game }) {
  const isLive = game.status === 'in_progress'
  const isFinal = game.status === 'final'
  const isScheduled = game.status === 'scheduled'
  const details = game.details

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

  const awayWins = isFinal && game.away_score > game.home_score
  const homeWins = isFinal && game.home_score > game.away_score
  const statusDisplay = game.clock ?? game.period ?? 'LIVE'
  const showLinescore = (isLive || isFinal) && homeComp && awayComp &&
    (homeComp.linescores.length > 0 || awayComp.linescores.length > 0)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4">
        {/* Status row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{game.league}</span>
            {game.league === 'MLB' && <SeasonBadge seasonType={details?.seasonType} />}
            {game.broadcast && <span className="text-xs text-gray-600">{game.broadcast}</span>}
          </div>
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                {statusDisplay}
              </span>
            )}
            {isFinal && <span className="text-xs font-semibold text-gray-500">FINAL</span>}
            {isScheduled && <span className="text-xs text-gray-400">{formatTime(game.game_time)}</span>}
          </div>
        </div>

        {/* Teams */}
        <div className="flex items-stretch gap-4">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <TeamLogo logo={awayComp?.team.logo} abbr={awayAbbr} color={awayColor} />
            <span className="text-xs text-gray-400">{awayAbbr}</span>
          </div>

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

          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <TeamLogo logo={homeComp?.team.logo} abbr={homeAbbr} color={homeColor} />
            <span className="text-xs text-gray-400">{homeAbbr}</span>
          </div>
        </div>

        {isScheduled && game.home_win_prob !== null && (
          <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600 text-center">
            {Math.round(game.home_win_prob * 100)}% {homeAbbr} · {Math.round((1 - game.home_win_prob) * 100)}% {awayAbbr}
          </div>
        )}

        {showLinescore && homeComp && awayComp && (
          <LinescoreTable game={game} homeComp={homeComp} awayComp={awayComp} />
        )}

        {isLive && details && <LiveSituation game={game} details={details} />}
        {details && <Leaders game={game} details={details} />}
      </div>
    </div>
  )
}

// ─── Stat table helpers ───────────────────────────────────────────────────────

interface StatRow {
  key: string
  name: string
  headshot?: string
  position?: string
  stats: string[]
  isTotals?: boolean
  isDivider?: boolean
}

function Headshot({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) return <div className="w-6 h-6 bg-gray-800 rounded-full flex-shrink-0" />
  return (
    <div className="w-6 h-6 relative flex-shrink-0 rounded-full overflow-hidden">
      <Image src={src} alt={name} fill className="object-cover" onError={() => setErr(true)} unoptimized />
    </div>
  )
}

function StatTable({ colHeaders, rows }: { colHeaders: string[]; rows: StatRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-max">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-1.5 pr-3 font-normal text-gray-500 sticky left-0 bg-gray-950 min-w-36">
              Player
            </th>
            {colHeaders.map(h => (
              <th key={h} className="text-right px-2 py-1.5 font-semibold text-gray-400 font-mono whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            if (row.isDivider) {
              return (
                <tr key={row.key}>
                  <td colSpan={colHeaders.length + 1} className="py-px">
                    <div className="border-t border-gray-800" />
                  </td>
                </tr>
              )
            }
            return (
              <tr
                key={row.key}
                className={
                  row.isTotals
                    ? 'border-t border-gray-700 font-semibold text-gray-300'
                    : 'border-b border-gray-800/50 text-gray-400 hover:bg-gray-800/30'
                }
              >
                <td className="py-1.5 pr-3 sticky left-0 bg-gray-950">
                  {row.isTotals ? (
                    <span className="text-gray-500 font-mono">Team</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Headshot src={row.headshot} name={row.name} />
                      <span className="text-gray-300 truncate max-w-28">{row.name}</span>
                      {row.position && <span className="text-gray-600 ml-0.5">{row.position}</span>}
                    </div>
                  )}
                </td>
                {row.stats.map((s, i) => (
                  <td key={i} className="text-right px-2 py-1.5 font-mono tabular-nums text-gray-300">
                    {s || '—'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BoxSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1 pb-1 border-b border-gray-800">
      {children}
    </div>
  )
}

function buildAthleteRow(a: EspnBoxAthlete, key: string, indices: number[]): StatRow {
  return {
    key,
    name:     a.athlete.displayName,
    headshot: a.athlete.headshot?.href,
    position: a.athlete.position?.abbreviation,
    stats:    indices.map(i => a.stats[i] ?? ''),
  }
}

// ─── Box score per sport (single team) ───────────────────────────────────────

function BasketballTeamBox({ playerData, league }: { playerData: EspnBoxPlayer; league: string }) {
  const desired = league === 'NCAAB' ? NCAAB_COLS : NBA_COLS
  const group: EspnStatGroup | undefined = playerData.statistics[0]
  if (!group) return <div className="py-4 text-center text-xs text-gray-600">No data</div>

  const indices = colIndices(group.names, desired)
  const headers = desiredHeaders(group.names, desired)

  const starters = group.athletes.filter(a => a.starter && !a.didNotPlay)
  const bench    = group.athletes.filter(a => !a.starter && !a.didNotPlay && a.active !== false)
  const dnp      = group.athletes.filter(a => a.didNotPlay)

  const rows: StatRow[] = [
    ...starters.map((a, i) => buildAthleteRow(a, `s-${i}`, indices)),
    ...(bench.length > 0 ? [{ key: 'div', name: '', stats: [], isDivider: true }] : []),
    ...bench.map((a, i) => buildAthleteRow(a, `b-${i}`, indices)),
    ...(dnp.length > 0 ? [{
      key: 'dnp',
      name: `DNP: ${dnp.map(a => a.athlete.shortName ?? a.athlete.displayName).join(', ')}`,
      stats: indices.map(() => ''),
    }] : []),
    ...(group.totals ? [{
      key: 'tot',
      name: 'Team',
      stats: indices.map(i => group.totals![i] ?? ''),
      isTotals: true,
    }] : []),
  ]

  return <StatTable colHeaders={headers} rows={rows} />
}

function NflTeamBox({ playerData, teams, teamAbbr }: {
  playerData: EspnBoxPlayer
  teams?: EspnBoxTeamStats[]
  teamAbbr: string
}) {
  const teamStats = teams?.find(t => t.team.abbreviation === teamAbbr)

  return (
    <div className="space-y-6">
      {NFL_GROUPS.map(({ typeAbbr, label, desired }) => {
        const group = playerData.statistics.find(
          (g: EspnStatGroup) => statTypeKey(g.type) === typeAbbr
        )
        if (!group || group.athletes.length === 0) return null

        const indices = colIndices(group.names, desired)
        const headers = desiredHeaders(group.names, desired)
        const rows: StatRow[] = group.athletes
          .filter((a: EspnBoxAthlete) => !a.didNotPlay && a.active !== false)
          .map((a: EspnBoxAthlete, i: number) => buildAthleteRow(a, `${typeAbbr}-${i}`, indices))

        if (rows.length === 0) return null

        return (
          <div key={typeAbbr}>
            <BoxSectionHeader>{label}</BoxSectionHeader>
            <StatTable colHeaders={headers} rows={rows} />
          </div>
        )
      })}

      {teamStats && (
        <div>
          <BoxSectionHeader>Team Stats</BoxSectionHeader>
          <div className="text-xs space-y-0">
            {NFL_TEAM_STATS.map(({ name, label }) => {
              const val = teamStats.statistics.find(s => s.name === name)?.displayValue
              if (!val) return null
              return (
                <div key={name} className="flex justify-between py-2 border-b border-gray-800/50">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono tabular-nums text-gray-300">{val}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MlbTeamBox({ playerData }: { playerData: EspnBoxPlayer }) {
  const pitchGroup = playerData.statistics.find(
    (g: EspnStatGroup) => statTypeKey(g.type) === 'pitching'
  )
  const batGroup = playerData.statistics.find(
    (g: EspnStatGroup) => statTypeKey(g.type) === 'batting'
  )

  return (
    <div className="space-y-6">
      {pitchGroup && pitchGroup.athletes.length > 0 && (
        <div>
          <BoxSectionHeader>Pitching</BoxSectionHeader>
          <StatTable
            colHeaders={desiredHeaders(pitchGroup.names, MLB_PITCH_COLS)}
            rows={pitchGroup.athletes.map((a: EspnBoxAthlete, i: number) => ({
              key:      `p-${i}`,
              name:     a.athlete.displayName,
              headshot: a.athlete.headshot?.href,
              stats:    colIndices(pitchGroup.names, MLB_PITCH_COLS).map(idx => a.stats[idx] ?? ''),
            }))}
          />
        </div>
      )}

      {batGroup && batGroup.athletes.length > 0 && (
        <div>
          <BoxSectionHeader>Batting</BoxSectionHeader>
          <StatTable
            colHeaders={desiredHeaders(batGroup.names, MLB_BAT_COLS)}
            rows={[
              ...batGroup.athletes.map((a: EspnBoxAthlete, i: number) => ({
                key:      `b-${i}`,
                name:     a.athlete.displayName,
                headshot: a.athlete.headshot?.href,
                stats:    colIndices(batGroup.names, MLB_BAT_COLS).map(idx => a.stats[idx] ?? ''),
              })),
              ...(batGroup.totals ? [{
                key:   'bat-tot',
                name:  'Team',
                stats: colIndices(batGroup.names, MLB_BAT_COLS).map(idx => batGroup.totals![idx] ?? ''),
                isTotals: true,
              }] : []),
            ]}
          />
        </div>
      )}
    </div>
  )
}

// ─── MLB Highlights ───────────────────────────────────────────────────────────

interface MlbHighlightCut { width: number; src: string }
interface MlbHighlightPlayback { name: string; url: string }
interface MlbHighlightItem {
  title: string
  duration: string
  image?: { cuts?: MlbHighlightCut[] }
  playbacks?: MlbHighlightPlayback[]
}

function pickThumb(cuts?: MlbHighlightCut[]): string | null {
  if (!cuts || cuts.length === 0) return null
  return cuts.reduce((best, cut) =>
    Math.abs(cut.width - 320) < Math.abs(best.width - 320) ? cut : best
  ).src
}

function pickVideo(playbacks?: MlbHighlightPlayback[]): string | null {
  if (!playbacks || playbacks.length === 0) return null
  return playbacks.find(p => p.name === 'mp4Avc')?.url ?? playbacks.find(p => !!p.url)?.url ?? null
}

function fmtDuration(s: string): string {
  const n = parseInt(s, 10)
  if (isNaN(n)) return ''
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
}

function HighlightCard({ item, isPlaying, onPlay }: {
  item: MlbHighlightItem
  isPlaying: boolean
  onPlay: () => void
}) {
  const thumb = pickThumb(item.image?.cuts)
  const videoUrl = pickVideo(item.playbacks)
  const duration = fmtDuration(item.duration)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!isPlaying && videoRef.current) videoRef.current.pause()
  }, [isPlaying])

  return (
    <div className="mb-3">
      <button
        className="w-full text-left flex items-start gap-3 p-2 rounded-md hover:bg-gray-800/50 transition-colors"
        onClick={() => {
          if (!videoUrl) { window.open(videoUrl ?? '', '_blank'); return }
          onPlay()
        }}
      >
        <div className="relative w-20 h-14 rounded overflow-hidden flex-shrink-0 bg-gray-800">
          {thumb ? (
            <Image src={thumb} alt={item.title} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          {duration && (
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded font-mono">
              {duration}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-300 leading-snug line-clamp-3 flex-1">{item.title}</p>
      </button>
      {isPlaying && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          className="w-full mt-1 rounded-md bg-black"
          onError={() => window.open(videoUrl, '_blank')}
        />
      )}
    </div>
  )
}

function MlbHighlightsSection({ gamePk }: { gamePk: string }) {
  const [items, setItems] = useState<MlbHighlightItem[]>([])
  const [loading, setLoading] = useState(true)
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/content`)
      .then(r => r.json())
      .then((d: Record<string, unknown>) => {
        const h = d?.highlights as { highlights?: { items?: MlbHighlightItem[] } } | undefined
        setItems((h?.highlights?.items ?? []).slice(0, 10))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [gamePk])

  if (loading) return <div className="text-xs text-gray-600 animate-pulse py-2">Loading highlights…</div>
  if (items.length === 0) return <div className="text-xs text-gray-600 py-2">No highlights available</div>

  return (
    <div>
      {items.map((item, i) => (
        <HighlightCard
          key={i}
          item={item}
          isPlaying={playingIdx === i}
          onPlay={() => setPlayingIdx(playingIdx === i ? null : i)}
        />
      ))}
    </div>
  )
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-gray-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-800/20 transition-colors"
      >
        <span className="font-semibold text-white text-sm">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-5">{children}</div>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GameDetailClient({ game, leagueSlug }: { game: Game; leagueSlug: string }) {
  const [currentGame, setCurrentGame] = useState<Game>(game)
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [boxScoreOpen, setBoxScoreOpen] = useState(false)
  const [highlightsOpen, setHighlightsOpen] = useState(false)

  const [summaryData, setSummaryData] = useState<EspnSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(false)
  const summaryFetched = useRef(false)

  const [selectedTeamIdx, setSelectedTeamIdx] = useState<0 | 1>(0) // 0 = away, 1 = home

  // Auto-refresh for live games
  useEffect(() => {
    if (currentGame.status !== 'in_progress') return
    const supabase = createClient()
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('id', currentGame.id)
        .single()
      if (data) setCurrentGame(data as Game)
    }, 30000)
    return () => clearInterval(interval)
  }, [currentGame.status, currentGame.id])

  // Fetch ESPN summary when box score section opens
  const fetchSummary = useCallback(() => {
    if (summaryFetched.current) return
    summaryFetched.current = true
    setSummaryLoading(true)
    fetch(summaryUrl(currentGame.league, currentGame.external_id))
      .then(r => r.json() as Promise<EspnSummaryResponse>)
      .then(d => { setSummaryData(d); setSummaryLoading(false) })
      .catch(() => { setSummaryError(true); setSummaryLoading(false) })
  }, [currentGame.league, currentGame.external_id])

  const handleBoxScoreToggle = () => {
    if (!boxScoreOpen) fetchSummary()
    setBoxScoreOpen(prev => !prev)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
  }

  const isLive = currentGame.status === 'in_progress'

  // Resolve teams from game details
  const awayComp = currentGame.details?.competitors.find(c => c.homeAway === 'away')
  const homeComp = currentGame.details?.competitors.find(c => c.homeAway === 'home')
  const awayAbbr = awayComp?.team.abbreviation ?? currentGame.away_team
  const homeAbbr = homeComp?.team.abbreviation ?? currentGame.home_team
  const awayLogo = awayComp?.team.logo ?? null
  const homeLogo = homeComp?.team.logo ?? null
  const awayColor = awayComp?.team.color ? `#${awayComp.team.color}` : '#6B7280'
  const homeColor = homeComp?.team.color ? `#${homeComp.team.color}` : '#6B7280'

  // Box score player data for selected team
  const players = summaryData?.boxscore?.players ?? []
  const teams   = summaryData?.boxscore?.teams
  const selectedAbbr = selectedTeamIdx === 0 ? awayAbbr : homeAbbr
  const selectedPlayerData = players.find((p: EspnBoxPlayer) => p.team.abbreviation === selectedAbbr)

  return (
    <div>
      {/* Sticky sub-header */}
      <div className="sticky top-14 z-30 bg-gray-950 border-b border-gray-800">
        <div className="px-4 h-12 flex items-center gap-3">
          <Link
            href={`/scores/${leagueSlug}`}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to scores"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-gray-300">
            {currentGame.league} Scores
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
          <button
            onClick={handleShare}
            className="ml-auto text-gray-400 hover:text-white transition-colors"
            aria-label="Copy link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sections */}
      <CollapsibleSection title="Overview" open={overviewOpen} onToggle={() => setOverviewOpen(p => !p)}>
        <OverviewCard game={currentGame} />
        {isLive && (
          <p className="text-xs text-gray-600 text-center mt-3">Auto-refreshes every 30 seconds</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Box Score" open={boxScoreOpen} onToggle={handleBoxScoreToggle}>
        {/* Team tabs */}
        <div className="flex gap-0 border-b border-gray-800 mb-4 -mx-4 px-4">
          {([
            { abbr: awayAbbr, logo: awayLogo, color: awayColor, idx: 0 as const },
            { abbr: homeAbbr, logo: homeLogo, color: homeColor, idx: 1 as const },
          ]).map(({ abbr, logo, color, idx }) => (
            <button
              key={idx}
              onClick={() => setSelectedTeamIdx(idx)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                selectedTeamIdx === idx
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {logo ? (
                <div className="w-5 h-5 relative flex-shrink-0">
                  <Image src={logo} alt={abbr} fill className="object-contain" unoptimized />
                </div>
              ) : (
                <div
                  className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {abbr.slice(0, 2)}
                </div>
              )}
              <span>{abbr}</span>
            </button>
          ))}
        </div>

        {/* Loading / error states */}
        {summaryLoading && (
          <div className="py-8 text-center text-gray-600 text-xs animate-pulse">Loading box score…</div>
        )}
        {summaryError && (
          <div className="py-8 text-center text-gray-600 text-xs">Box score unavailable</div>
        )}
        {!summaryLoading && !summaryError && summaryData && !selectedPlayerData && (
          <div className="py-8 text-center text-gray-600 text-xs">
            {currentGame.status === 'scheduled' ? "Game hasn't started yet" : 'No data for this team'}
          </div>
        )}

        {/* Per-sport box score */}
        {!summaryLoading && !summaryError && selectedPlayerData && (
          <>
            {(currentGame.league === 'NBA' || currentGame.league === 'NCAAB') && (
              <BasketballTeamBox playerData={selectedPlayerData} league={currentGame.league} />
            )}
            {currentGame.league === 'NFL' && (
              <NflTeamBox playerData={selectedPlayerData} teams={teams} teamAbbr={selectedAbbr} />
            )}
            {currentGame.league === 'MLB' && (
              <MlbTeamBox playerData={selectedPlayerData} />
            )}
          </>
        )}
      </CollapsibleSection>

      {/* Highlights — MLB only */}
      {currentGame.league === 'MLB' && currentGame.mlb_game_pk && (
        <CollapsibleSection
          title="Highlights"
          open={highlightsOpen}
          onToggle={() => setHighlightsOpen(p => !p)}
        >
          {highlightsOpen && <MlbHighlightsSection gamePk={currentGame.mlb_game_pk} />}
        </CollapsibleSection>
      )}
    </div>
  )
}
