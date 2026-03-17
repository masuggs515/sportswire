class Game {
  final String id;
  final String league;
  final String homeTeam;
  final String awayTeam;
  final int homeScore;
  final int awayScore;
  final String status;
  final DateTime? gameTime;
  final String? period;
  final double? homeWinProb;

  const Game({
    required this.id,
    required this.league,
    required this.homeTeam,
    required this.awayTeam,
    required this.homeScore,
    required this.awayScore,
    required this.status,
    this.gameTime,
    this.period,
    this.homeWinProb,
  });

  factory Game.fromJson(Map<String, dynamic> json) {
    return Game(
      id: json['id'] as String,
      league: json['league'] as String,
      homeTeam: json['home_team'] as String,
      awayTeam: json['away_team'] as String,
      homeScore: json['home_score'] as int? ?? 0,
      awayScore: json['away_score'] as int? ?? 0,
      status: json['status'] as String? ?? 'scheduled',
      gameTime: json['game_time'] != null
          ? DateTime.parse(json['game_time'] as String)
          : null,
      period: json['period'] as String?,
      homeWinProb: (json['home_win_prob'] as num?)?.toDouble(),
    );
  }

  bool get isLive => status == 'in_progress';
  bool get isFinal => status == 'final';
  bool get isScheduled => status == 'scheduled';
}
