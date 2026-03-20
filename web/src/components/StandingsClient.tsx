'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  EspnStandingEntry,
  EspnStandingConference,
  StandingsView,
} from '@/lib/types'

// ─── ESPN standings endpoints ─────────────────────────────────────────────────

const ESPN_STANDINGS_URLS: Record<string, string> = {
  NBA:   'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings',
  NFL:   'https://site.api.espn.com/apis/v2/sports/football/nfl/standings',
  MLB:   'https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings',
  NCAAB: 'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings',
}

// ─── Column definitions per league ───────────────────────────────────────────

interface ColDef { name: string; label: string; align?: 'left' | 'right' }

const NBA_COLS: ColDef[] = [
  { name: 'wins',        label: 'W'    },
  { name: 'losses',      label: 'L'    },
  { name: 'winPercent',  label: 'PCT'  },
  { name: 'gamesBehind', label: 'GB'   },
  { name: 'home',        label: 'Home' },
  { name: 'road',        label: 'Away' },
  { name: 'streak',      label: 'Strk' },
]

const NFL_COLS: ColDef[] = [
  { name: 'wins',             label: 'W'    },
  { name: 'losses',           label: 'L'    },
  { name: 'ties',             label: 'T'    },
  { name: 'winPercent',       label: 'PCT'  },
  { name: 'home',             label: 'Home' },
  { name: 'road',             label: 'Away' },
  { name: 'divisionRecord',   label: 'Div'  },
  { name: 'streak',           label: 'Strk' },
]

const MLB_COLS: ColDef[] = [
  { name: 'wins',        label: 'W'    },
  { name: 'losses',      label: 'L'    },
  { name: 'winPercent',  label: 'PCT'  },
  { name: 'gamesBehind', label: 'GB'   },
  { name: 'home',        label: 'Home' },
  { name: 'road',        label: 'Away' },
  { name: 'streak',      label: 'Strk' },
]

const NCAAB_COLS: ColDef[] = [
  { name: 'wins',              label: 'W'    },
  { name: 'losses',            label: 'L'    },
  { name: 'winPercent',        label: 'PCT'  },
  { name: 'home',              label: 'Home' },
  { name: 'road',              label: 'Away' },
  { name: 'conferenceRecord',  label: 'Conf' },
  { name: 'streak',            label: 'Strk' },
]

const LEAGUE_COLS: Record<string, ColDef[]> = { NBA: NBA_COLS, NFL: NFL_COLS, MLB: MLB_COLS, NCAAB: NCAAB_COLS }

// ─── Parse ESPN response into typed structure ─────────────────────────────────

/* ESPN response shape (simplified):
   { children: [{ name: "Eastern Conference", children: [{ name: "Atlantic", standings: { entries: [...] } }] }] }
   For NCAAB: { children: [{ name: "ACC", standings: { entries: [...] } }] }
*/

interface EspnRawConf {
  name?: string
  children?: EspnRawConf[]
  standings?: { entries?: EspnStandingEntry[] }
}

function parseResponse(data: { children?: EspnRawConf[] }): EspnStandingConference[] {
  const conferences: EspnStandingConference[] = []

  for (const conf of data.children ?? []) {
    const confName: string = conf.name ?? 'Conference'

    // If conf.children exists → has divisions
    if (conf.children && conf.children.length > 0) {
      const divisions = conf.children.map(div => ({
        name:    div.name ?? 'Division',
        entries: (div.standings?.entries ?? []) as EspnStandingEntry[],
      }))
      conferences.push({ name: confName, divisions })
    } else {
      // No divisions (e.g. NCAAB conference)
      const entries = (conf.standings?.entries ?? []) as EspnStandingEntry[]
      conferences.push({ name: confName, divisions: [{ name: confName, entries }] })
    }
  }

  return conferences
}

function getStat(entry: EspnStandingEntry, name: string): string {
  return entry.stats.find(s => s.name === name)?.displayValue ?? '—'
}

// ─── Team logo ────────────────────────────────────────────────────────────────

function TeamLogo({ logo, abbr, color }: { logo?: string; abbr: string; color: string }) {
  const [err, setErr] = useState(false)
  if (!logo || err) {
    return (
      <div
        className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: color ? `#${color}` : '#374151' }}
      >
        {abbr.slice(0, 3)}
      </div>
    )
  }
  return (
    <div className="w-7 h-7 relative flex-shrink-0">
      <Image src={logo} alt={abbr} fill className="object-contain" onError={() => setErr(true)} unoptimized />
    </div>
  )
}

// ─── Standings table ──────────────────────────────────────────────────────────

function StandingsTable({ entries, cols, groupName }: {
  entries: EspnStandingEntry[]
  cols: ColDef[]
  groupName: string
}) {
  if (entries.length === 0) return null

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-4 py-2 border-b border-gray-800">
        {groupName}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-2 font-normal text-gray-500 sticky left-0 bg-gray-950 min-w-40">Team</th>
              {cols.map(c => (
                <th key={c.name} className="text-right px-3 py-2 font-semibold text-gray-400 font-mono whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const logo   = entry.team.logos?.[0]?.href
              const color  = entry.team.color ?? ''
              const abbr   = entry.team.abbreviation
              const note   = entry.note?.text

              return (
                <tr
                  key={entry.team.id ?? i}
                  className="border-b border-gray-800/50 hover:bg-gray-900 transition-colors"
                >
                  <td className="px-4 py-2 sticky left-0 bg-gray-950 hover:bg-gray-900 transition-colors">
                    <div className="flex items-center gap-2">
                      <TeamLogo logo={logo} abbr={abbr} color={color} />
                      <div>
                        <div className="text-gray-200 font-medium">{entry.team.displayName}</div>
                        {note && (
                          <div className="text-gray-600 text-xs">{note}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {cols.map(c => (
                    <td key={c.name} className="text-right px-3 py-2 font-mono tabular-nums text-gray-300">
                      {getStat(entry, c.name)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const LEAGUE_TABS = ['NBA', 'NFL', 'MLB', 'NCAAB'] as const
type LeagueTab = typeof LEAGUE_TABS[number]

const VIEW_OPTS: StandingsView[] = ['Division', 'Conference', 'League']

export default function StandingsClient() {
  const [activeLeague, setActiveLeague] = useState<LeagueTab>('NBA')
  const [activeView,   setActiveView]   = useState<StandingsView>('Division')
  const [data,         setData]         = useState<EspnStandingConference[] | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(false)

  // Simple in-memory cache so switching tabs doesn't re-fetch
  const cache = useRef<Partial<Record<LeagueTab, EspnStandingConference[]>>>({})

  useEffect(() => {
    if (cache.current[activeLeague]) {
      setData(cache.current[activeLeague]!)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)
    setData(null)

    fetch(ESPN_STANDINGS_URLS[activeLeague])
      .then(r => r.json())
      .then(raw => {
        const parsed = parseResponse(raw)
        cache.current[activeLeague] = parsed
        setData(parsed)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [activeLeague])

  const cols = LEAGUE_COLS[activeLeague] ?? NBA_COLS

  // Compute groups based on view mode
  const groups: Array<{ name: string; entries: EspnStandingEntry[] }> = []

  if (data) {
    if (activeView === 'Division') {
      // Show each division as its own group
      for (const conf of data) {
        for (const div of conf.divisions) {
          groups.push({ name: div.name, entries: div.entries })
        }
      }
    } else if (activeView === 'Conference') {
      // Flatten divisions within each conference, sort by winPercent desc
      for (const conf of data) {
        const allEntries = conf.divisions.flatMap(d => d.entries)
        allEntries.sort((a, b) => {
          const wa = a.stats.find(s => s.name === 'winPercent')?.value ?? 0
          const wb = b.stats.find(s => s.name === 'winPercent')?.value ?? 0
          return wb - wa
        })
        groups.push({ name: conf.name, entries: allEntries })
      }
    } else {
      // League view — all teams sorted by winPercent desc
      const allEntries = data.flatMap(c => c.divisions.flatMap(d => d.entries))
      allEntries.sort((a, b) => {
        const wa = a.stats.find(s => s.name === 'winPercent')?.value ?? 0
        const wb = b.stats.find(s => s.name === 'winPercent')?.value ?? 0
        return wb - wa
      })
      groups.push({ name: 'League', entries: allEntries })
    }
  }

  // NCAAB: Division/Conference/League all use "conference" grouping — Division = Conference for college
  const showViewToggle = true // keep always, graceful even if distinction is minimal

  return (
    <div>
      {/* League tabs */}
      <div className="flex border-b border-gray-800 px-4 sticky top-14 z-30 bg-gray-950">
        {LEAGUE_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveLeague(tab)}
            className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeLeague === tab
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* View toggle */}
      {showViewToggle && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          {VIEW_OPTS.map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                activeView === view
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="pb-8">
        {loading && (
          <div className="py-16 text-center">
            <div className="text-gray-600 text-sm animate-pulse">Loading standings…</div>
          </div>
        )}

        {error && (
          <div className="py-16 text-center">
            <div className="text-gray-600 text-sm">Standings unavailable. Try again later.</div>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-gray-600 text-sm">No standings data available.</div>
          </div>
        )}

        {!loading && !error && groups.map(g => (
          <StandingsTable key={g.name} entries={g.entries} cols={cols} groupName={g.name} />
        ))}
      </div>
    </div>
  )
}
