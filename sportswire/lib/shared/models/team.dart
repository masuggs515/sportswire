class Team {
  final String abbr;
  final String league;
  final String fullName;
  final String? primaryColor;
  final String? accentColor;
  final String? logoUrl;

  const Team({
    required this.abbr,
    required this.league,
    required this.fullName,
    this.primaryColor,
    this.accentColor,
    this.logoUrl,
  });

  factory Team.fromJson(Map<String, dynamic> json) {
    return Team(
      abbr: json['abbr'] as String,
      league: json['league'] as String,
      fullName: json['full_name'] as String,
      primaryColor: json['primary_color'] as String?,
      accentColor: json['accent_color'] as String?,
      logoUrl: json['logo_url'] as String?,
    );
  }
}
