export interface TeamData {
  fullName: string
  primaryColor: string
  accentColor: string
}

export const NBA_TEAMS: Record<string, TeamData> = {
  ATL: { fullName: 'Atlanta Hawks',          primaryColor: '#E03A3E', accentColor: '#C1D32F' },
  BOS: { fullName: 'Boston Celtics',          primaryColor: '#007A33', accentColor: '#BA9653' },
  BKN: { fullName: 'Brooklyn Nets',           primaryColor: '#000000', accentColor: '#FFFFFF' },
  CHA: { fullName: 'Charlotte Hornets',       primaryColor: '#1D1160', accentColor: '#00788C' },
  CHI: { fullName: 'Chicago Bulls',           primaryColor: '#CE1141', accentColor: '#000000' },
  CLE: { fullName: 'Cleveland Cavaliers',     primaryColor: '#860038', accentColor: '#FDBB30' },
  DAL: { fullName: 'Dallas Mavericks',        primaryColor: '#00538C', accentColor: '#002B5E' },
  DEN: { fullName: 'Denver Nuggets',          primaryColor: '#0E2240', accentColor: '#FEC524' },
  DET: { fullName: 'Detroit Pistons',         primaryColor: '#C8102E', accentColor: '#006BB6' },
  GSW: { fullName: 'Golden State Warriors',   primaryColor: '#1D428A', accentColor: '#FFC72C' },
  HOU: { fullName: 'Houston Rockets',         primaryColor: '#CE1141', accentColor: '#C4CED4' },
  IND: { fullName: 'Indiana Pacers',          primaryColor: '#002D62', accentColor: '#FDBB30' },
  LAC: { fullName: 'LA Clippers',             primaryColor: '#C8102E', accentColor: '#1D428A' },
  LAL: { fullName: 'Los Angeles Lakers',      primaryColor: '#552583', accentColor: '#FDB927' },
  MEM: { fullName: 'Memphis Grizzlies',       primaryColor: '#5D76A9', accentColor: '#12173F' },
  MIA: { fullName: 'Miami Heat',              primaryColor: '#98002E', accentColor: '#F9A01B' },
  MIL: { fullName: 'Milwaukee Bucks',         primaryColor: '#00471B', accentColor: '#EEE1C6' },
  MIN: { fullName: 'Minnesota Timberwolves',  primaryColor: '#0C2340', accentColor: '#236192' },
  NOP: { fullName: 'New Orleans Pelicans',    primaryColor: '#0C2340', accentColor: '#C8102E' },
  NYK: { fullName: 'New York Knicks',         primaryColor: '#006BB6', accentColor: '#F58426' },
  OKC: { fullName: 'Oklahoma City Thunder',   primaryColor: '#007AC1', accentColor: '#EF3B24' },
  ORL: { fullName: 'Orlando Magic',           primaryColor: '#0077C0', accentColor: '#C4CED4' },
  PHI: { fullName: 'Philadelphia 76ers',      primaryColor: '#006BB6', accentColor: '#ED174C' },
  PHX: { fullName: 'Phoenix Suns',            primaryColor: '#1D1160', accentColor: '#E56020' },
  POR: { fullName: 'Portland Trail Blazers',  primaryColor: '#E03A3E', accentColor: '#000000' },
  SAC: { fullName: 'Sacramento Kings',        primaryColor: '#5A2D81', accentColor: '#63727A' },
  SAS: { fullName: 'San Antonio Spurs',       primaryColor: '#C4CED4', accentColor: '#000000' },
  TOR: { fullName: 'Toronto Raptors',         primaryColor: '#CE1141', accentColor: '#000000' },
  UTA: { fullName: 'Utah Jazz',               primaryColor: '#002B5C', accentColor: '#00471B' },
  WAS: { fullName: 'Washington Wizards',      primaryColor: '#002B5C', accentColor: '#E31837' },
}

export const NFL_TEAMS: Record<string, TeamData> = {
  ARI: { fullName: 'Arizona Cardinals',       primaryColor: '#97233F', accentColor: '#000000' },
  ATL: { fullName: 'Atlanta Falcons',         primaryColor: '#A71930', accentColor: '#000000' },
  BAL: { fullName: 'Baltimore Ravens',        primaryColor: '#241773', accentColor: '#9E7C0C' },
  BUF: { fullName: 'Buffalo Bills',           primaryColor: '#00338D', accentColor: '#C60C30' },
  CAR: { fullName: 'Carolina Panthers',       primaryColor: '#0085CA', accentColor: '#101820' },
  CHI: { fullName: 'Chicago Bears',           primaryColor: '#0B162A', accentColor: '#C83803' },
  CIN: { fullName: 'Cincinnati Bengals',      primaryColor: '#FB4F14', accentColor: '#000000' },
  CLE: { fullName: 'Cleveland Browns',        primaryColor: '#311D00', accentColor: '#FF3C00' },
  DAL: { fullName: 'Dallas Cowboys',          primaryColor: '#003594', accentColor: '#869397' },
  DEN: { fullName: 'Denver Broncos',          primaryColor: '#FB4F14', accentColor: '#002244' },
  DET: { fullName: 'Detroit Lions',           primaryColor: '#0076B6', accentColor: '#B0B7BC' },
  GB:  { fullName: 'Green Bay Packers',       primaryColor: '#203731', accentColor: '#FFB612' },
  HOU: { fullName: 'Houston Texans',          primaryColor: '#03202F', accentColor: '#A71930' },
  IND: { fullName: 'Indianapolis Colts',      primaryColor: '#002C5F', accentColor: '#A2AAAD' },
  JAX: { fullName: 'Jacksonville Jaguars',    primaryColor: '#101820', accentColor: '#D7A22A' },
  KC:  { fullName: 'Kansas City Chiefs',      primaryColor: '#E31837', accentColor: '#FFB81C' },
  LAC: { fullName: 'Los Angeles Chargers',    primaryColor: '#0080C6', accentColor: '#FFC20E' },
  LAR: { fullName: 'Los Angeles Rams',        primaryColor: '#003594', accentColor: '#FFA300' },
  LV:  { fullName: 'Las Vegas Raiders',       primaryColor: '#000000', accentColor: '#A5ACAF' },
  MIA: { fullName: 'Miami Dolphins',          primaryColor: '#008E97', accentColor: '#FC4C02' },
  MIN: { fullName: 'Minnesota Vikings',       primaryColor: '#4F2683', accentColor: '#FFC62F' },
  NE:  { fullName: 'New England Patriots',    primaryColor: '#002244', accentColor: '#C60C30' },
  NO:  { fullName: 'New Orleans Saints',      primaryColor: '#D3BC8D', accentColor: '#101820' },
  NYG: { fullName: 'New York Giants',         primaryColor: '#0B2265', accentColor: '#A71930' },
  NYJ: { fullName: 'New York Jets',           primaryColor: '#125740', accentColor: '#000000' },
  PHI: { fullName: 'Philadelphia Eagles',     primaryColor: '#004C54', accentColor: '#A5ACAF' },
  PIT: { fullName: 'Pittsburgh Steelers',     primaryColor: '#FFB612', accentColor: '#101820' },
  SEA: { fullName: 'Seattle Seahawks',        primaryColor: '#002244', accentColor: '#69BE28' },
  SF:  { fullName: 'San Francisco 49ers',     primaryColor: '#AA0000', accentColor: '#B3995D' },
  TB:  { fullName: 'Tampa Bay Buccaneers',    primaryColor: '#D50A0A', accentColor: '#FF7900' },
  TEN: { fullName: 'Tennessee Titans',        primaryColor: '#0C2340', accentColor: '#4B92DB' },
  WAS: { fullName: 'Washington Commanders',   primaryColor: '#5A1414', accentColor: '#FFB612' },
}

export function getTeam(abbr: string, league: string): TeamData | undefined {
  if (league === 'NBA') return NBA_TEAMS[abbr]
  if (league === 'NFL') return NFL_TEAMS[abbr]
  return NBA_TEAMS[abbr] ?? NFL_TEAMS[abbr]
}

export function getTeamColor(abbr: string, league: string): string {
  return getTeam(abbr, league)?.primaryColor ?? '#6B7280'
}

export function getTeamName(abbr: string, league: string): string {
  return getTeam(abbr, league)?.fullName ?? abbr
}

export const ALL_LEAGUES = ['NBA', 'NFL', 'NCAAB'] as const
export type League = typeof ALL_LEAGUES[number]

export function getTeamsByLeague(league: 'NBA' | 'NFL'): Record<string, TeamData> {
  return league === 'NBA' ? NBA_TEAMS : NFL_TEAMS
}
