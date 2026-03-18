'use client'

import { getTeam } from '@/lib/teamConfig'

interface TeamBadgeProps {
  abbr: string
  league: string
  size?: 'sm' | 'md'
}

export default function TeamBadge({ abbr, league, size = 'sm' }: TeamBadgeProps) {
  const team = getTeam(abbr, league)
  const bg = team?.primaryColor ?? '#6B7280'
  const text = team?.accentColor ?? '#FFFFFF'

  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'

  return (
    <span
      className={`inline-block rounded font-semibold tracking-wide ${padding}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {abbr}
    </span>
  )
}
