'use client'

import Link from 'next/link'
import { Story } from '@/lib/types'
import { getTeamColor, getTeamName } from '@/lib/teamConfig'
import TeamBadge from './TeamBadge'

interface StoryCardProps {
  story: Story
  followed: string[]
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function StoryCard({ story, followed }: StoryCardProps) {
  const isFollowed = story.team_tags.some(t => followed.includes(t))
  const primaryTag = story.team_tags[0]
  const accentColor = primaryTag ? getTeamColor(primaryTag, story.league) : '#3B82F6'

  return (
    <Link href={`/?view=story&id=${story.id}`} className="block">
      <article
        className={`bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all ${
          !isFollowed ? 'opacity-75' : ''
        }`}
      >
        {/* Team color accent stripe */}
        <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {story.league}
            </span>
            {story.is_hot && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-semibold">
                HOT
              </span>
            )}
            <span className="text-xs text-gray-600 ml-auto">
              {formatRelativeTime(story.published_at)}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-white font-semibold text-base leading-snug mb-2 line-clamp-2">
            {story.headline}
          </h2>

          {/* AI Summary */}
          {story.ai_summary && (
            <p className="text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">
              {story.ai_summary}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 flex-wrap">
            {story.team_tags.slice(0, 3).map(tag => (
              <TeamBadge key={tag} abbr={tag} league={story.league} />
            ))}
            {primaryTag && (
              <span className="text-xs text-gray-500 ml-auto">
                {getTeamName(primaryTag, story.league)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
