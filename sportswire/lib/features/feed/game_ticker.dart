import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/team_config.dart';
import '../../shared/models/game.dart';
import '../../shared/widgets/shimmer_card.dart';
import 'feed_provider.dart';

class GameTicker extends ConsumerWidget {
  const GameTicker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gamesAsync = ref.watch(todayGamesStreamProvider);

    return SizedBox(
      height: 90,
      child: gamesAsync.when(
        data: (games) {
          if (games.isEmpty) {
            return const Center(
              child: Text(
                'No games today',
                style: TextStyle(color: Colors.white38, fontSize: 12),
              ),
            );
          }
          return ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(left: 12, right: 4),
            itemCount: games.length,
            itemBuilder: (_, i) => _GameTile(game: games[i]),
          );
        },
        loading: () => ListView(
          scrollDirection: Axis.horizontal,
          children: List.generate(
              4, (_) => const ShimmerGameTile()),
        ),
        error: (err, stack) => const Center(
          child: Text(
            'Could not load games',
            style: TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ),
      ),
    );
  }
}

class _GameTile extends StatelessWidget {
  final Game game;

  const _GameTile({required this.game});

  @override
  Widget build(BuildContext context) {
    final homeData = TeamConfig.anyLeague(game.homeTeam);
    final awayData = TeamConfig.anyLeague(game.awayTeam);
    final homeColor = homeData?.primaryColor ?? Colors.grey;
    final awayColor = awayData?.primaryColor ?? Colors.grey;

    return Container(
      width: 148,
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(10),
        border: game.isLive
            ? Border.all(color: Colors.green.withValues(alpha: 0.5), width: 1.5)
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Status row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (game.isLive)
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 4),
                  decoration: const BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                  ),
                ),
              Text(
                _statusLabel(game),
                style: TextStyle(
                  color: game.isLive ? Colors.green : Colors.white38,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Score / matchup
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _TeamScore(
                abbr: game.awayTeam,
                score: game.awayScore,
                color: awayColor,
                showScore: !game.isScheduled,
              ),
              Text(
                game.isScheduled ? 'vs' : '-',
                style: const TextStyle(color: Colors.white38, fontSize: 13),
              ),
              _TeamScore(
                abbr: game.homeTeam,
                score: game.homeScore,
                color: homeColor,
                showScore: !game.isScheduled,
              ),
            ],
          ),
          if (game.isScheduled && game.gameTime != null) ...[
            const SizedBox(height: 4),
            Text(
              DateFormat('h:mm a').format(game.gameTime!.toLocal()),
              style: const TextStyle(color: Colors.white38, fontSize: 10),
            ),
          ],
        ],
      ),
    );
  }

  String _statusLabel(Game game) {
    if (game.isLive) return game.period ?? 'LIVE';
    if (game.isFinal) return 'FINAL';
    return game.league;
  }
}

class _TeamScore extends StatelessWidget {
  final String abbr;
  final int score;
  final Color color;
  final bool showScore;

  const _TeamScore({
    required this.abbr,
    required this.score,
    required this.color,
    required this.showScore,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          abbr,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.bold,
          ),
        ),
        if (showScore)
          Text(
            '$score',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
      ],
    );
  }
}
