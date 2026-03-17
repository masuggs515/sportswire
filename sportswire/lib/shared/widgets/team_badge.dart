import 'package:flutter/material.dart';

import '../../core/team_config.dart';

class TeamBadge extends StatelessWidget {
  final String abbr;
  final String league;

  const TeamBadge({super.key, required this.abbr, required this.league});

  @override
  Widget build(BuildContext context) {
    final teamData = TeamConfig.forTeam(abbr, league);
    final primary = teamData?.primaryColor ?? Colors.grey;
    final accent = teamData?.accentColor ?? Colors.grey[400]!;

    // Teams with very dark primary colors (e.g. BKN black, LV Raiders black,
    // NO Saints near-black) are invisible on the dark card background.
    // Fall back to accent color when primary luminance is below threshold.
    final color = primary.computeLuminance() < 0.06 ? accent : primary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.55), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            abbr,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
