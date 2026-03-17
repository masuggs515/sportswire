class Standing {
  final String id;
  final String league;
  final String? conference;
  final String teamAbbr;
  final String teamName;
  final int wins;
  final int losses;
  final double winPct;
  final int? conferenceRank;

  const Standing({
    required this.id,
    required this.league,
    this.conference,
    required this.teamAbbr,
    required this.teamName,
    required this.wins,
    required this.losses,
    required this.winPct,
    this.conferenceRank,
  });

  factory Standing.fromJson(Map<String, dynamic> json) {
    return Standing(
      id: json['id'] as String,
      league: json['league'] as String,
      conference: json['conference'] as String?,
      teamAbbr: json['team_abbr'] as String,
      teamName: json['team_name'] as String,
      wins: json['wins'] as int? ?? 0,
      losses: json['losses'] as int? ?? 0,
      winPct: (json['win_pct'] as num?)?.toDouble() ?? 0.0,
      conferenceRank: json['conference_rank'] as int?,
    );
  }
}
