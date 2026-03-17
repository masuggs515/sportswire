import 'package:flutter/material.dart';

class TeamData {
  final String fullName;
  final Color primaryColor;
  final Color accentColor;

  const TeamData({
    required this.fullName,
    required this.primaryColor,
    required this.accentColor,
  });
}

class TeamConfig {
  static const Map<String, TeamData> nba = {
    'ATL': TeamData(fullName: 'Atlanta Hawks',          primaryColor: Color(0xFFC1052A), accentColor: Color(0xFFFDB927)),
    'BOS': TeamData(fullName: 'Boston Celtics',         primaryColor: Color(0xFF007A33), accentColor: Color(0xFFBA9653)),
    'BKN': TeamData(fullName: 'Brooklyn Nets',          primaryColor: Color(0xFF000000), accentColor: Color(0xFFFFFFFF)),
    'CHA': TeamData(fullName: 'Charlotte Hornets',      primaryColor: Color(0xFF1D1160), accentColor: Color(0xFF00788C)),
    'CHI': TeamData(fullName: 'Chicago Bulls',          primaryColor: Color(0xFFCE1141), accentColor: Color(0xFF000000)),
    'CLE': TeamData(fullName: 'Cleveland Cavaliers',    primaryColor: Color(0xFF860038), accentColor: Color(0xFFFDBB30)),
    'DAL': TeamData(fullName: 'Dallas Mavericks',       primaryColor: Color(0xFF00538C), accentColor: Color(0xFF002B5E)),
    'DEN': TeamData(fullName: 'Denver Nuggets',         primaryColor: Color(0xFF0E2240), accentColor: Color(0xFFFEC524)),
    'DET': TeamData(fullName: 'Detroit Pistons',        primaryColor: Color(0xFFC8102E), accentColor: Color(0xFF006BB6)),
    'GSW': TeamData(fullName: 'Golden State Warriors',  primaryColor: Color(0xFF1D428A), accentColor: Color(0xFFFFC72C)),
    'HOU': TeamData(fullName: 'Houston Rockets',        primaryColor: Color(0xFFCE1141), accentColor: Color(0xFFC4CED4)),
    'IND': TeamData(fullName: 'Indiana Pacers',         primaryColor: Color(0xFF002D62), accentColor: Color(0xFFFDB927)),
    'LAC': TeamData(fullName: 'LA Clippers',            primaryColor: Color(0xFF1D428A), accentColor: Color(0xFFC8102E)),
    'LAL': TeamData(fullName: 'Los Angeles Lakers',     primaryColor: Color(0xFF552583), accentColor: Color(0xFFFDB927)),
    'MEM': TeamData(fullName: 'Memphis Grizzlies',      primaryColor: Color(0xFF5D76A9), accentColor: Color(0xFF12173F)),
    'MIA': TeamData(fullName: 'Miami Heat',             primaryColor: Color(0xFF98002E), accentColor: Color(0xFFF9A01B)),
    'MIL': TeamData(fullName: 'Milwaukee Bucks',        primaryColor: Color(0xFF00471B), accentColor: Color(0xFFEEE1C6)),
    'MIN': TeamData(fullName: 'Minnesota Timberwolves', primaryColor: Color(0xFF0C2340), accentColor: Color(0xFF236192)),
    'NOP': TeamData(fullName: 'New Orleans Pelicans',   primaryColor: Color(0xFF0C2340), accentColor: Color(0xFFC8102E)),
    'NYK': TeamData(fullName: 'New York Knicks',        primaryColor: Color(0xFF006BB6), accentColor: Color(0xFFF58426)),
    'OKC': TeamData(fullName: 'Oklahoma City Thunder',  primaryColor: Color(0xFF007AC1), accentColor: Color(0xFFEF3B24)),
    'ORL': TeamData(fullName: 'Orlando Magic',          primaryColor: Color(0xFF0077C0), accentColor: Color(0xFFC4CED4)),
    'PHI': TeamData(fullName: 'Philadelphia 76ers',     primaryColor: Color(0xFF006BB6), accentColor: Color(0xFFED174C)),
    'PHX': TeamData(fullName: 'Phoenix Suns',           primaryColor: Color(0xFF1D1160), accentColor: Color(0xFFE56020)),
    'POR': TeamData(fullName: 'Portland Trail Blazers', primaryColor: Color(0xFFE03A3E), accentColor: Color(0xFFBABEBE)),
    'SAC': TeamData(fullName: 'Sacramento Kings',       primaryColor: Color(0xFF5A2D81), accentColor: Color(0xFF63727A)),
    'SAS': TeamData(fullName: 'San Antonio Spurs',      primaryColor: Color(0xFFC4CED4), accentColor: Color(0xFF000000)),
    'TOR': TeamData(fullName: 'Toronto Raptors',        primaryColor: Color(0xFFCE1141), accentColor: Color(0xFF000000)),
    'UTA': TeamData(fullName: 'Utah Jazz',              primaryColor: Color(0xFF002B5C), accentColor: Color(0xFF00471B)),
    'WAS': TeamData(fullName: 'Washington Wizards',     primaryColor: Color(0xFF002B5C), accentColor: Color(0xFFE31837)),
  };

  static const Map<String, TeamData> nfl = {
    'ARI': TeamData(fullName: 'Arizona Cardinals',      primaryColor: Color(0xFF97233F), accentColor: Color(0xFFFFB612)),
    'ATL': TeamData(fullName: 'Atlanta Falcons',        primaryColor: Color(0xFFA71930), accentColor: Color(0xFFA5ACAF)),
    'BAL': TeamData(fullName: 'Baltimore Ravens',       primaryColor: Color(0xFF241773), accentColor: Color(0xFF9E7C0C)),
    'BUF': TeamData(fullName: 'Buffalo Bills',          primaryColor: Color(0xFF00338D), accentColor: Color(0xFFC60C30)),
    'CAR': TeamData(fullName: 'Carolina Panthers',      primaryColor: Color(0xFF0085CA), accentColor: Color(0xFF101820)),
    'CHI': TeamData(fullName: 'Chicago Bears',          primaryColor: Color(0xFF0B162A), accentColor: Color(0xFFC83803)),
    'CIN': TeamData(fullName: 'Cincinnati Bengals',     primaryColor: Color(0xFFFB4F14), accentColor: Color(0xFF000000)),
    'CLE': TeamData(fullName: 'Cleveland Browns',       primaryColor: Color(0xFF311D00), accentColor: Color(0xFFFF3C00)),
    'DAL': TeamData(fullName: 'Dallas Cowboys',         primaryColor: Color(0xFF003594), accentColor: Color(0xFF869397)),
    'DEN': TeamData(fullName: 'Denver Broncos',         primaryColor: Color(0xFF002244), accentColor: Color(0xFFFC4C02)),
    'DET': TeamData(fullName: 'Detroit Lions',          primaryColor: Color(0xFF0076B6), accentColor: Color(0xFFB0B7BC)),
    'GB':  TeamData(fullName: 'Green Bay Packers',      primaryColor: Color(0xFF203731), accentColor: Color(0xFFFFB612)),
    'HOU': TeamData(fullName: 'Houston Texans',         primaryColor: Color(0xFF03202F), accentColor: Color(0xFFFC4C02)),
    'IND': TeamData(fullName: 'Indianapolis Colts',     primaryColor: Color(0xFF002C5F), accentColor: Color(0xFFA2AAAD)),
    'JAX': TeamData(fullName: 'Jacksonville Jaguars',   primaryColor: Color(0xFF006778), accentColor: Color(0xFF9F792C)),
    'KC':  TeamData(fullName: 'Kansas City Chiefs',     primaryColor: Color(0xFFE31837), accentColor: Color(0xFFFFB81C)),
    'LAC': TeamData(fullName: 'Los Angeles Chargers',   primaryColor: Color(0xFF0080C6), accentColor: Color(0xFFFFC20E)),
    'LAR': TeamData(fullName: 'Los Angeles Rams',       primaryColor: Color(0xFF003594), accentColor: Color(0xFFFFD100)),
    'LV':  TeamData(fullName: 'Las Vegas Raiders',      primaryColor: Color(0xFF000000), accentColor: Color(0xFFA5ACAF)),
    'MIA': TeamData(fullName: 'Miami Dolphins',         primaryColor: Color(0xFF008E97), accentColor: Color(0xFFFC4C02)),
    'MIN': TeamData(fullName: 'Minnesota Vikings',      primaryColor: Color(0xFF4F2683), accentColor: Color(0xFFFFC62F)),
    'NE':  TeamData(fullName: 'New England Patriots',   primaryColor: Color(0xFF002244), accentColor: Color(0xFFC60C30)),
    'NO':  TeamData(fullName: 'New Orleans Saints',     primaryColor: Color(0xFF101820), accentColor: Color(0xFFD3BC8D)),
    'NYG': TeamData(fullName: 'New York Giants',        primaryColor: Color(0xFF0B2265), accentColor: Color(0xFFA71930)),
    'NYJ': TeamData(fullName: 'New York Jets',          primaryColor: Color(0xFF125740), accentColor: Color(0xFFFFFFFF)),
    'PHI': TeamData(fullName: 'Philadelphia Eagles',    primaryColor: Color(0xFF004C54), accentColor: Color(0xFFA5ACAF)),
    'PIT': TeamData(fullName: 'Pittsburgh Steelers',    primaryColor: Color(0xFFFFB612), accentColor: Color(0xFF101820)),
    'SEA': TeamData(fullName: 'Seattle Seahawks',       primaryColor: Color(0xFF002244), accentColor: Color(0xFF69BE28)),
    'SF':  TeamData(fullName: 'San Francisco 49ers',    primaryColor: Color(0xFFAA0000), accentColor: Color(0xFFB3995D)),
    'TB':  TeamData(fullName: 'Tampa Bay Buccaneers',   primaryColor: Color(0xFFD50A0A), accentColor: Color(0xFFFF7900)),
    'TEN': TeamData(fullName: 'Tennessee Titans',       primaryColor: Color(0xFF0C2340), accentColor: Color(0xFF4B92DB)),
    'WAS': TeamData(fullName: 'Washington Commanders',  primaryColor: Color(0xFF5A1414), accentColor: Color(0xFFFFB612)),
  };

  static TeamData? forTeam(String abbr, String league) {
    if (league == 'NBA') return nba[abbr];
    if (league == 'NFL') return nfl[abbr];
    return null;
  }

  static TeamData? anyLeague(String abbr) {
    return nba[abbr] ?? nfl[abbr];
  }

  static List<String> nbaAbbrs() => nba.keys.toList()..sort();
  static List<String> nflAbbrs() => nfl.keys.toList()..sort();
}
