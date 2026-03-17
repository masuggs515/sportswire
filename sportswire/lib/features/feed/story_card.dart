import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/team_config.dart';
import '../../shared/models/story.dart';
import '../../shared/widgets/team_badge.dart';
import '../settings/prefs_provider.dart';

class StoryCard extends ConsumerWidget {
  final Story story;
  final VoidCallback onTap;

  const StoryCard({super.key, required this.story, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final followed = ref.watch(prefsProvider).followedTeams.toSet();
    final isFollowedTeam = story.teamTags.any(followed.contains);

    // Pick the first team tag's color as the accent
    Color accentColor = const Color(0xFF4ECDC4);
    if (story.teamTags.isNotEmpty) {
      final teamData = TeamConfig.forTeam(story.teamTags.first, story.league);
      if (teamData != null) {
        accentColor = teamData.primaryColor;
      }
    }

    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: isFollowedTeam || followed.isEmpty ? 1.0 : 0.72,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(12),
            border: isFollowedTeam
                ? Border.all(color: accentColor.withValues(alpha: 0.4), width: 1)
                : null,
          ),
          clipBehavior: Clip.hardEdge,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left accent stripe
                Container(
                  width: 4,
                  color: accentColor,
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // League badge + hot badge + timestamp
                        Row(
                          children: [
                            _LeagueBadge(league: story.league),
                            if (story.isHot) ...[
                              const SizedBox(width: 6),
                              _HotBadge(),
                            ],
                            const Spacer(),
                            Text(
                              _formatTime(story.publishedAt),
                              style: const TextStyle(
                                color: Colors.white38,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        // Headline
                        Text(
                          story.headline,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            height: 1.35,
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (story.aiSummary != null &&
                            story.aiSummary!.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            story.aiSummary!,
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 13,
                              height: 1.4,
                            ),
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        const SizedBox(height: 10),
                        // Team tags + "Full story" hint
                        Row(
                          children: [
                            Wrap(
                              spacing: 5,
                              children: story.teamTags
                                  .take(3)
                                  .map((t) => TeamBadge(
                                      abbr: t, league: story.league))
                                  .toList(),
                            ),
                            const Spacer(),
                            const Text(
                              'FULL STORY →',
                              style: TextStyle(
                                color: Colors.white30,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('MMM d').format(dt);
  }
}

class _LeagueBadge extends StatelessWidget {
  final String league;
  const _LeagueBadge({required this.league});

  @override
  Widget build(BuildContext context) {
    final color =
        league == 'NBA' ? const Color(0xFFC9082A) : const Color(0xFF013369);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.7)),
      ),
      child: Text(
        league,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _HotBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.orange.withValues(alpha: 0.5)),
      ),
      child: const Text(
        '🔥',
        style: TextStyle(fontSize: 10),
      ),
    );
  }
}
