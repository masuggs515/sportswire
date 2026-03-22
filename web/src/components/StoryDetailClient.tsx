'use client'

import Link from 'next/link'
import { StoryDetail, Game, Standing } from '@/lib/types'
import TeamBadge from './TeamBadge'
import { getTeamColor } from '@/lib/teamConfig'

interface Props {
  detail: StoryDetail
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatGameTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    month: 'short', day: 'numeric',
  })
}

function ScoreCard({ game, league }: { game: Game; league: string }) {
  const homeColor = getTeamColor(game.home_team, league)
  const awayColor = getTeamColor(game.away_team, league)
  const isFinal = game.status === 'final'
  const isLive = game.status === 'in_progress'

  return (
    <div className="flex-shrink-0 bg-gray-800 rounded-xl p-3 w-36 text-center">
      <div className="text-xs text-gray-500 mb-2">
        {isLive ? <span className="text-green-400">{game.period ?? 'LIVE'}</span>
          : isFinal ? 'Final'
          : formatGameTime(game.game_time)}
      </div>
      <div className="space-y-1">
        {[
          { team: game.away_team, score: game.away_score, color: awayColor },
          { team: game.home_team, score: game.home_score, color: homeColor },
        ].map(({ team, score, color }) => (
          <div key={team} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-semibold text-white">{team}</span>
            </div>
            {(isLive || isFinal) && (
              <span className="text-sm font-bold text-white">{score}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StandingsTable({ standings, teamTags, league }: { standings: Standing[]; teamTags: string[]; league: string }) {
  if (standings.length === 0) return null
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-white font-semibold text-sm">{league} Standings</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase">
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">W</th>
            <th className="px-4 py-2 text-right">L</th>
            <th className="px-4 py-2 text-right">PCT</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(s => {
            const isHighlighted = teamTags.includes(s.team_abbr)
            return (
              <tr
                key={s.id}
                className={`border-t border-gray-800 ${isHighlighted ? 'bg-blue-500/10' : ''}`}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getTeamColor(s.team_abbr, league) }}
                    />
                    <span className={`font-medium ${isHighlighted ? 'text-white' : 'text-gray-300'}`}>
                      {s.team_abbr}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{s.wins}</td>
                <td className="px-4 py-2 text-right text-gray-300">{s.losses}</td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {(s.win_pct * 100).toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function copyShareLink(storyId: string) {
  const url = `${window.location.origin}/story/${storyId}`
  navigator.clipboard.writeText(url).catch(() => {})
}

export default function StoryDetailClient({ detail }: Props) {
  const { story, recentGames, upcomingGames, standings, related } = detail
  const primaryTag = story.team_tags[0]
  const accentColor = primaryTag ? getTeamColor(primaryTag, story.league) : '#3B82F6'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Team color top border */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      <div className="px-4 py-6 space-y-6">
        {/* Back nav */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* League + trending badges */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{story.league}</span>
          {story.is_hot && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-semibold">
              TRENDING
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="text-white font-bold text-2xl leading-tight">{story.headline}</h1>

        {/* AI Summary */}
        {story.ai_summary && (
          <p className="text-gray-300 text-base leading-relaxed">{story.ai_summary}</p>
        )}

        {/* Team tags + timestamp */}
        <div className="flex items-center gap-2 flex-wrap">
          {story.team_tags.map(tag => (
            <TeamBadge key={tag} abbr={tag} league={story.league} size="md" />
          ))}
          <span className="text-xs text-gray-500 ml-auto">{formatRelativeTime(story.published_at)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <a
            href={story.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors text-sm"
          >
            Read Full Story →
          </a>
          <button
            onClick={() => copyShareLink(story.id)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
            title="Copy share link"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>

        {/* AI Analysis */}
        {story.ai_analysis && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded" style={{ backgroundColor: accentColor }} />
              <h2 className="text-white font-semibold text-sm uppercase tracking-wide">AI Analysis</h2>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{story.ai_analysis}</p>
          </div>
        )}

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3">Recent Games</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentGames.map(game => (
                <ScoreCard key={game.id} game={game} league={story.league} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Games */}
        {upcomingGames.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3">Upcoming Games</h2>
            <div className="space-y-2">
              {upcomingGames.map(game => (
                <div key={game.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-white">{game.away_team}</span>
                    <span className="text-gray-600">@</span>
                    <span className="font-semibold text-white">{game.home_team}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">{formatGameTime(game.game_time)}</div>
                    {game.home_win_prob !== null && (
                      <div className="text-xs text-gray-600">
                        {Math.round(game.home_win_prob * 100)}% {game.home_team}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standings */}
        {standings.length > 0 && (
          <StandingsTable standings={standings} teamTags={story.team_tags} league={story.league} />
        )}

        {/* Related Stories */}
        {related.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3">Related Stories</h2>
            <div className="space-y-2">
              {related.map(r => (
                <Link key={r.id} href={`/story/${r.id}`}>
                  <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 uppercase">{r.league}</span>
                      {r.is_hot && <span className="text-xs text-orange-400">HOT</span>}
                      <span className="text-xs text-gray-600 ml-auto">{formatRelativeTime(r.published_at)}</span>
                    </div>
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2">{r.headline}</p>
                    <div className="flex gap-1.5 mt-2">
                      {r.team_tags.slice(0, 3).map(tag => (
                        <TeamBadge key={tag} abbr={tag} league={r.league} />
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
