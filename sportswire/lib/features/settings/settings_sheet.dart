import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/team_config.dart';
import 'prefs_provider.dart';

class SettingsSheet extends ConsumerWidget {
  const SettingsSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F0F1A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const SettingsSheet(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(prefsProvider);
    final followed = prefs.followedTeams.toSet();

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollController) {
        return Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  const Text(
                    'Follow Teams',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      'Done',
                      style: TextStyle(color: Color(0xFF4ECDC4)),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _leagueSection(
                    context,
                    ref,
                    label: 'NBA',
                    abbrs: TeamConfig.nbaAbbrs(),
                    followed: followed,
                    league: 'NBA',
                  ),
                  const SizedBox(height: 16),
                  _leagueSection(
                    context,
                    ref,
                    label: 'NFL',
                    abbrs: TeamConfig.nflAbbrs(),
                    followed: followed,
                    league: 'NFL',
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _leagueSection(
    BuildContext context,
    WidgetRef ref, {
    required String label,
    required List<String> abbrs,
    required Set<String> followed,
    required String league,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white54,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 2.8,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemCount: abbrs.length,
          itemBuilder: (_, i) {
            final abbr = abbrs[i];
            final teamData = TeamConfig.forTeam(abbr, league);
            final isFollowed = followed.contains(abbr);
            final color = teamData?.primaryColor ?? Colors.grey;

            return GestureDetector(
              onTap: () {
                ref.read(prefsProvider.notifier).toggleTeam(abbr);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: isFollowed
                      ? color.withValues(alpha: 0.25)
                      : const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isFollowed ? color : Colors.white12,
                    width: isFollowed ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (isFollowed)
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(right: 4),
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                        ),
                      ),
                    Flexible(
                      child: Text(
                        abbr,
                        style: TextStyle(
                          color: isFollowed ? color : Colors.white54,
                          fontSize: 12,
                          fontWeight: isFollowed
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
