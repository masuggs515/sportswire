'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { User } from '@supabase/supabase-js'
import { NBA_TEAMS, NFL_TEAMS } from '@/lib/teamConfig'
import { FavoriteTeam } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import teamsData from '@/lib/teams.json'

const ALL_TEAMS = teamsData as Array<{
  league: 'NFL' | 'NBA' | 'MLB'
  name: string
  abbr: string
  espnId: number
  logo: string
}>

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
}

const STORAGE_KEY = 'sportswire_followed_teams'

export function getFollowedTeams(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveFollowedTeams(teams: string[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
  window.dispatchEvent(new Event('followed-teams-changed'))
}

export default function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const [followed, setFollowed] = useState<string[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([])
  const [favMaxWarning, setFavMaxWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowed(getFollowedTeams())

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u)
      if (u) {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('favorite_teams')
          .eq('user_id', u.id)
          .maybeSingle()
        setFavorites(prefs?.favorite_teams ?? [])
      }
    })
  }, [open])

  // ── Legacy follow (localStorage) ──
  const toggleFollowed = (abbr: string) => {
    setFollowed(prev =>
      prev.includes(abbr) ? prev.filter(t => t !== abbr) : [...prev, abbr]
    )
  }

  // ── Favorite teams (Supabase) ──
  const toggleFavorite = (team: typeof ALL_TEAMS[number]) => {
    const existing = favorites.find(f => f.abbr === team.abbr && f.league === team.league)
    if (existing) {
      setFavorites(prev => prev.filter(f => !(f.abbr === team.abbr && f.league === team.league)))
      return
    }
    const count = favorites.filter(f => f.league === team.league).length
    if (count >= 2) {
      setFavMaxWarning(team.league)
      setTimeout(() => setFavMaxWarning(null), 2000)
      return
    }
    setFavorites(prev => [
      ...prev,
      { league: team.league, espnId: team.espnId, name: team.name, abbr: team.abbr },
    ])
  }

  const save = async () => {
    setSaving(true)
    saveFollowedTeams(followed)

    if (user) {
      const supabase = createClient()
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, favorite_teams: favorites },
        { onConflict: 'user_id' }
      )
      window.dispatchEvent(new Event('favorites-changed'))
    }

    setSaving(false)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-8">
          {/* ── Favorite Teams (logged-in only) ── */}
          {user && (
            <div>
              <h3 className="text-white font-semibold text-sm mb-1">Favorite Teams</h3>
              <p className="text-gray-500 text-xs mb-4">Up to 2 per league. Adds tabs to your feed.</p>
              {(['NFL', 'NBA', 'MLB'] as const).map(league => {
                const teams = ALL_TEAMS.filter(t => t.league === league)
                const count = favorites.filter(f => f.league === league).length
                const atMax = count >= 2
                return (
                  <div key={league} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{league}</span>
                      {atMax && (
                        <span className={`text-xs transition-colors ${favMaxWarning === league ? 'text-amber-400' : 'text-gray-600'}`}>
                          Max 2
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {teams.map(team => {
                        const isFav = favorites.some(f => f.abbr === team.abbr && f.league === team.league)
                        const disabled = !isFav && atMax
                        return (
                          <FavTeamBtn
                            key={`${league}-${team.abbr}`}
                            team={team}
                            selected={isFav}
                            disabled={disabled}
                            onToggle={() => toggleFavorite(team)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Follow Teams (localStorage — for everyone) ── */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-1">Follow Teams</h3>
            <p className="text-gray-500 text-xs mb-4">Pins their stories to the top of your feed.</p>
            <TeamGrid label="NBA" teams={NBA_TEAMS} followed={followed} onToggle={toggleFollowed} />
            <TeamGrid label="NFL" teams={NFL_TEAMS} followed={followed} onToggle={toggleFollowed} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-800">
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FavTeamBtn ────────────────────────────────────────────────────────────────

function FavTeamBtn({
  team,
  selected,
  disabled,
  onToggle,
}: {
  team: typeof ALL_TEAMS[number]
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const [imgError, setImgError] = useState(false)
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
        selected
          ? 'border-blue-500 bg-blue-500/10 text-white'
          : disabled
          ? 'border-gray-800 bg-gray-900 opacity-30 cursor-not-allowed text-gray-500'
          : 'border-gray-800 bg-gray-900 hover:border-gray-600 text-gray-400'
      }`}
    >
      <div className="w-7 h-7 relative flex-shrink-0">
        {!imgError ? (
          <Image
            src={team.logo}
            alt={team.abbr}
            fill
            className="object-contain"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
            {team.abbr.slice(0, 2)}
          </div>
        )}
      </div>
      <span className="leading-tight text-center">{team.abbr}</span>
    </button>
  )
}

// ── TeamGrid (legacy follow) ──────────────────────────────────────────────────

function TeamGrid({
  label,
  teams,
  followed,
  onToggle,
}: {
  label: string
  teams: Record<string, { fullName: string; primaryColor: string; accentColor: string }>
  followed: string[]
  onToggle: (abbr: string) => void
}) {
  return (
    <div className="mb-4">
      <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">{label}</h4>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(teams).map(([abbr, data]) => {
          const isFollowed = followed.includes(abbr)
          return (
            <button
              key={abbr}
              onClick={() => onToggle(abbr)}
              className={`rounded-lg py-2 px-1 text-xs font-semibold border transition-all ${
                isFollowed
                  ? 'border-transparent text-white'
                  : 'border-gray-700 text-gray-400 bg-gray-800 hover:border-gray-500'
              }`}
              style={isFollowed ? { backgroundColor: data.primaryColor, color: data.accentColor } : undefined}
            >
              {abbr}
            </button>
          )
        })}
      </div>
    </div>
  )
}
