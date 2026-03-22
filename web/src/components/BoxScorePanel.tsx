'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Game,
  EspnSummaryResponse,
  EspnBoxPlayer,
  EspnBoxTeamStats,
  EspnStatGroup,
  EspnBoxAthlete,
} from '@/lib/types'

// ─── ESPN summary URL per league ────────────────────────────────────────────

const SPORT_PATH: Record<string, string> = {
  NBA:   'basketball/nba',
  NFL:   'football/nfl',
  MLB:   'baseball/mlb',
  NCAAB: 'basketball/mens-college-basketball',
}

function summaryUrl(league: string, externalId: string): string {
  const path = SPORT_PATH[league] ?? 'basketball/nba'
  // external_id is stored as "nba_401585678" — strip the prefix to get the ESPN event ID
  const eventId = externalId.includes('_') ? externalId.replace(/^[^_]+_/, '') : externalId
  return `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${eventId}`
}

// ─── Desired column lists ────────────────────────────────────────────────────

const NBA_COLS   = ['MIN', 'FG', '3PT', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const NCAAB_COLS = ['MIN', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'PTS']
const NFL_PASS_COLS = ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'QBR']
const NFL_RUSH_COLS = ['CAR', 'YDS', 'AVG', 'LNG', 'TD']
const NFL_REC_COLS  = ['REC', 'YDS', 'AVG', 'LNG', 'TD']
const MLB_BAT_COLS  = ['AB', 'R', 'H', 'RBI', 'BB', 'K', 'AVG']
const MLB_PITCH_COLS = ['IP', 'H', 'R', 'ER', 'BB', 'K', 'ERA']

function colIndices(names: string[], desired: string[]): number[] {
  return desired.map(d => names.indexOf(d)).filter(i => i !== -1)
}

function desiredHeaders(names: string[], desired: string[]): string[] {
  return desired.filter(d => names.includes(d))
}

// ─── Headshot ────────────────────────────────────────────────────────────────

function Headshot({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) return <div className="w-6 h-6 bg-gray-800 rounded-full flex-shrink-0" />
  return (
    <div className="w-6 h-6 relative flex-shrink-0 rounded-full overflow-hidden">
      <Image src={src} alt={name} fill className="object-cover" onError={() => setErr(true)} unoptimized />
    </div>
  )
}

// ─── StatTable ───────────────────────────────────────────────────────────────

interface StatRow {
  key:       string
  name:      string
  headshot?: string
  position?: string
  stats:     string[]
  isTotals?: boolean
  isDivider?: boolean
}

function StatTable({ colHeaders, rows }: { colHeaders: string[]; rows: StatRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-max">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-1.5 pr-3 font-normal text-gray-500 sticky left-0 bg-gray-900 min-w-36">
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
                <td className="py-1.5 pr-3 sticky left-0 bg-gray-900">
                  {row.isTotals ? (
                    <span className="text-gray-500 font-mono">Team</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Headshot src={row.headshot} name={row.name} />
                      <span className="text-gray-300 truncate max-w-28">{row.name}</span>
                      {row.position && (
                        <span className="text-gray-600 ml-0.5">{row.position}</span>
                      )}
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

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1 pb-1 border-b border-gray-800">
      {children}
    </div>
  )
}

// ─── Basketball (NBA / NCAAB) ─────────────────────────────────────────────────

function buildAthleteRow(a: EspnBoxAthlete, key: string, indices: number[]): StatRow {
  return {
    key,
    name:     a.athlete.displayName,
    headshot: a.athlete.headshot?.href,
    position: a.athlete.position?.abbreviation,
    stats:    indices.map(i => a.stats[i] ?? ''),
  }
}

function BasketballBox({ players, league }: { players: EspnBoxPlayer[]; league: string }) {
  const desired = league === 'NCAAB' ? NCAAB_COLS : NBA_COLS

  return (
    <div className="space-y-6">
      {players.map((teamData, ti) => {
        const group: EspnStatGroup | undefined = teamData.statistics[0]
        if (!group) return null

        const indices = colIndices(group.names, desired)
        const headers = desiredHeaders(group.names, desired)

        const starters = group.athletes.filter(a => a.starter && !a.didNotPlay)
        const bench    = group.athletes.filter(a => !a.starter && !a.didNotPlay && a.active !== false)
        const dnp      = group.athletes.filter(a => a.didNotPlay)

        const rows: StatRow[] = [
          ...starters.map((a, i) => buildAthleteRow(a, `s${ti}-${i}`, indices)),
          ...(bench.length > 0 ? [{ key: `div-${ti}`, name: '', stats: [], isDivider: true }] : []),
          ...bench.map((a, i) => buildAthleteRow(a, `b${ti}-${i}`, indices)),
          ...(dnp.length > 0 ? [{
            key: `dnp-${ti}`,
            name: `DNP: ${dnp.map(a => a.athlete.shortName ?? a.athlete.displayName).join(', ')}`,
            stats: indices.map(() => ''),
          }] : []),
          ...(group.totals ? [{
            key: `tot-${ti}`,
            name: 'Team',
            stats: indices.map(i => group.totals![i] ?? ''),
            isTotals: true,
          }] : []),
        ]

        return (
          <div key={ti}>
            <SectionHeader>{teamData.team.displayName}</SectionHeader>
            <StatTable colHeaders={headers} rows={rows} />
          </div>
        )
      })}
    </div>
  )
}

// ─── NFL ──────────────────────────────────────────────────────────────────────

const NFL_GROUPS: Array<{ typeAbbr: string; label: string; desired: string[] }> = [
  { typeAbbr: 'passing',   label: 'Passing',   desired: NFL_PASS_COLS },
  { typeAbbr: 'rushing',   label: 'Rushing',   desired: NFL_RUSH_COLS },
  { typeAbbr: 'receiving', label: 'Receiving', desired: NFL_REC_COLS  },
]

const NFL_TEAM_STATS: Array<{ name: string; label: string }> = [
  { name: 'totalYards',    label: 'Total Yards'  },
  { name: 'turnovers',     label: 'Turnovers'    },
  { name: 'possessionTime',label: 'Poss. Time'   },
  { name: 'thirdDownEff',  label: '3rd Down'     },
  { name: 'redZoneAtts',   label: 'Red Zone'     },
]

function NflBox({ players, teams }: { players: EspnBoxPlayer[]; teams: EspnBoxTeamStats[] | undefined }) {
  return (
    <div className="space-y-6">
      {NFL_GROUPS.map(({ typeAbbr, label, desired }) => {
        const rows: StatRow[] = []
        let headers: string[] = []

        for (const teamData of players) {
          const group = teamData.statistics.find(
            (g: EspnStatGroup) => g.type?.abbreviation?.toLowerCase() === typeAbbr
          )
          if (!group || group.athletes.length === 0) continue

          const indices = colIndices(group.names, desired)
          headers = desiredHeaders(group.names, desired)

          if (rows.length > 0) rows.push({ key: `div-${typeAbbr}-${teamData.team.abbreviation}`, name: '', stats: [], isDivider: true })
          rows.push({
            key:  `hdr-${typeAbbr}-${teamData.team.abbreviation}`,
            name: teamData.team.abbreviation,
            stats: headers.map(() => ''),
            isTotals: true,
          })

          group.athletes
            .filter((a: EspnBoxAthlete) => !a.didNotPlay && a.active !== false)
            .forEach((a: EspnBoxAthlete, i: number) => {
              rows.push(buildAthleteRow(a, `${typeAbbr}-${teamData.team.abbreviation}-${i}`, indices))
            })
        }

        if (rows.length === 0) return null

        return (
          <div key={typeAbbr}>
            <SectionHeader>{label}</SectionHeader>
            <StatTable colHeaders={headers} rows={rows} />
          </div>
        )
      })}

      {/* Team stats */}
      {teams && teams.length >= 2 && (
        <div>
          <SectionHeader>Team Stats</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-1.5 pr-4 font-normal text-gray-500 sticky left-0 bg-gray-900 min-w-36" />
                  {teams.map(t => (
                    <th key={t.team.abbreviation} className="text-right px-4 py-1.5 font-semibold text-gray-400">
                      {t.team.abbreviation}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NFL_TEAM_STATS.map(({ name, label }) => {
                  const vals = teams.map(t => t.statistics.find(s => s.name === name)?.displayValue ?? '—')
                  return (
                    <tr key={name} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-4 text-gray-500 sticky left-0 bg-gray-900">{label}</td>
                      {vals.map((v, i) => (
                        <td key={i} className="text-right px-4 py-1.5 font-mono tabular-nums text-gray-300">{v}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MLB ──────────────────────────────────────────────────────────────────────

function MlbBox({ players }: { players: EspnBoxPlayer[] }) {
  return (
    <div className="space-y-6">
      {/* Pitching — both teams */}
      <div>
        <SectionHeader>Pitching</SectionHeader>
        {players.map((teamData, ti) => {
          const group = teamData.statistics.find(
            (g: EspnStatGroup) => g.type?.abbreviation?.toLowerCase() === 'pitching'
          )
          if (!group || group.athletes.length === 0) return null

          const indices = colIndices(group.names, MLB_PITCH_COLS)
          const headers = desiredHeaders(group.names, MLB_PITCH_COLS)

          const rows: StatRow[] = group.athletes.map((a: EspnBoxAthlete, i: number) => ({
            key:     `pitch-${ti}-${i}`,
            name:    a.athlete.displayName,
            headshot: a.athlete.headshot?.href,
            stats:   indices.map(idx => a.stats[idx] ?? ''),
          }))

          return (
            <div key={ti} className={ti > 0 ? 'mt-3' : ''}>
              <div className="text-xs text-gray-500 mb-1.5 px-1">{teamData.team.displayName}</div>
              <StatTable colHeaders={headers} rows={rows} />
            </div>
          )
        })}
      </div>

      {/* Batting — per team */}
      {players.map((teamData, ti) => {
        const group = teamData.statistics.find(
          (g: EspnStatGroup) => g.type?.abbreviation?.toLowerCase() === 'batting'
        )
        if (!group || group.athletes.length === 0) return null

        const indices = colIndices(group.names, MLB_BAT_COLS)
        const headers = desiredHeaders(group.names, MLB_BAT_COLS)

        const rows: StatRow[] = [
          ...group.athletes.map((a: EspnBoxAthlete, i: number) => ({
            key:     `bat-${ti}-${i}`,
            name:    a.athlete.displayName,
            headshot: a.athlete.headshot?.href,
            stats:   indices.map(idx => a.stats[idx] ?? ''),
          })),
          ...(group.totals ? [{
            key:   `bat-tot-${ti}`,
            name:  'Team',
            stats: indices.map(idx => group.totals![idx] ?? ''),
            isTotals: true,
          }] : []),
        ]

        return (
          <div key={ti}>
            <SectionHeader>Batting — {teamData.team.displayName}</SectionHeader>
            <StatTable colHeaders={headers} rows={rows} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BoxScorePanel({ game }: { game: Game }) {
  const [data,    setData]    = useState<EspnSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const fetched               = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true

    fetch(summaryUrl(game.league, game.external_id))
      .then(r => r.json() as Promise<EspnSummaryResponse>)
      .then(d  => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [game.league, game.external_id])

  const players = data?.boxscore?.players ?? []
  const teams   = data?.boxscore?.teams
  const hasData = players.length > 0

  return (
    <div className="border-t border-gray-700 bg-gray-900 px-4 pt-4 pb-5">
      <div className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Box Score</span>
      </div>

      {loading && (
        <div className="py-8 text-center text-gray-600 text-xs animate-pulse">Loading box score…</div>
      )}
      {error && (
        <div className="py-8 text-center text-gray-600 text-xs">Box score unavailable</div>
      )}
      {!loading && !error && !hasData && (
        <div className="py-8 text-center text-gray-600 text-xs">
          {game.status === 'scheduled' ? "Game hasn't started yet" : 'Box score unavailable'}
        </div>
      )}

      {hasData && (
        <>
          {(game.league === 'NBA' || game.league === 'NCAAB') && (
            <BasketballBox players={players} league={game.league} />
          )}
          {game.league === 'NFL' && (
            <NflBox players={players} teams={teams} />
          )}
          {game.league === 'MLB' && (
            <MlbBox players={players} />
          )}
        </>
      )}
    </div>
  )
}
