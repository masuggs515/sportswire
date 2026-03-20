'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { FavoriteTeam } from '@/lib/types'
import teamsData from '@/lib/teams.json'

const ALL_TEAMS = teamsData as Array<{
  league: 'NFL' | 'NBA' | 'MLB'
  name: string
  abbr: string
  espnId: number
  logo: string
}>

const LEAGUES: Array<'NFL' | 'NBA' | 'MLB'> = ['NFL', 'NBA', 'MLB']

interface OnboardingOverlayProps {
  onDone: () => void
}

function TeamCard({
  team,
  selected,
  onToggle,
  atMax,
}: {
  team: typeof ALL_TEAMS[number]
  selected: boolean
  onToggle: () => void
  atMax: boolean
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      onClick={onToggle}
      disabled={!selected && atMax}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : atMax
          ? 'border-gray-800 bg-gray-900 opacity-40 cursor-not-allowed'
          : 'border-gray-800 bg-gray-900 hover:border-gray-600'
      }`}
    >
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className="w-10 h-10 relative">
        {!imgError ? (
          <Image
            src={team.logo}
            alt={team.name}
            fill
            className="object-contain"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">
            {team.abbr}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-300 leading-tight">{team.name}</span>
    </button>
  )
}

export default function OnboardingOverlay({ onDone }: OnboardingOverlayProps) {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([])
  const [maxWarning, setMaxWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggle = (team: typeof ALL_TEAMS[number]) => {
    const existing = favorites.find(f => f.abbr === team.abbr && f.league === team.league)
    if (existing) {
      setFavorites(prev => prev.filter(f => !(f.abbr === team.abbr && f.league === team.league)))
      setMaxWarning(null)
      return
    }
    const leagueCount = favorites.filter(f => f.league === team.league).length
    if (leagueCount >= 2) {
      setMaxWarning(team.league)
      setTimeout(() => setMaxWarning(null), 2000)
      return
    }
    setFavorites(prev => [...prev, { league: team.league, espnId: team.espnId, name: team.name, abbr: team.abbr }])
  }

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, favorite_teams: favorites },
        { onConflict: 'user_id' }
      )
    }
    onDone()
  }

  const skip = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_preferences').upsert(
        { user_id: user.id, favorite_teams: [] },
        { onConflict: 'user_id' }
      )
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Pick your favorite teams</h1>
          <p className="text-gray-500 text-sm mt-0.5">Personalizes your feed and scores. Change anytime.</p>
        </div>
        <button onClick={skip} className="text-gray-500 hover:text-gray-300 text-sm">
          Skip
        </button>
      </div>

      {/* Team grids */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {LEAGUES.map(league => {
          const teams = ALL_TEAMS.filter(t => t.league === league)
          const leagueCount = favorites.filter(f => f.league === league).length
          const atMax = leagueCount >= 2
          return (
            <div key={league}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{league}</h2>
                {atMax && (
                  <span className={`text-xs transition-colors ${maxWarning === league ? 'text-amber-400' : 'text-gray-600'}`}>
                    Max 2 selected
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {teams.map(team => (
                  <TeamCard
                    key={`${team.league}-${team.abbr}`}
                    team={team}
                    selected={favorites.some(f => f.abbr === team.abbr && f.league === team.league)}
                    onToggle={() => toggle(team)}
                    atMax={atMax && !favorites.some(f => f.abbr === team.abbr && f.league === team.league)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0">
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : `Done${favorites.length > 0 ? ` (${favorites.length} selected)` : ''}`}
        </button>
      </div>
    </div>
  )
}
