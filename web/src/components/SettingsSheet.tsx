'use client'

import { useEffect, useState } from 'react'
import { NBA_TEAMS, NFL_TEAMS } from '@/lib/teamConfig'

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

  // Re-read localStorage whenever the sheet opens
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowed(getFollowedTeams())
  }, [open])

  const toggle = (abbr: string) => {
    setFollowed(prev =>
      prev.includes(abbr) ? prev.filter(t => t !== abbr) : [...prev, abbr]
    )
  }

  const save = () => {
    saveFollowedTeams(followed)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Follow Your Teams</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-6">
          <TeamGrid label="NBA" teams={NBA_TEAMS} followed={followed} onToggle={toggle} />
          <TeamGrid label="NFL" teams={NFL_TEAMS} followed={followed} onToggle={toggle} />
        </div>

        <div className="px-5 py-4 border-t border-gray-800">
          <button
            onClick={save}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}

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
    <div>
      <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">{label}</h3>
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
