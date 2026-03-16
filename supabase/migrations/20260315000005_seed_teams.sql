-- ─────────────────────────────────────────────────────────────────────────────
-- SportsWire — Migration 005: Seed Teams
-- All 30 NBA teams + all 32 NFL teams.
-- Colors sourced from official brand guidelines.
-- logo_url populated later via TheSportsDB enrichment (not at seed time).
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix: NBA and NFL share 13 abbreviations (ATL, CHI, CLE, DAL, DEN, DET, HOU,
-- IND, LAC, MIA, MIN, PHI, WAS). The PK must be (abbr, league), not just abbr.
-- Migration 001 created abbr as the sole PK — correcting that here before seeding.
ALTER TABLE teams DROP CONSTRAINT teams_pkey;
ALTER TABLE teams ADD PRIMARY KEY (abbr, league);

-- ── NBA Teams (30) ────────────────────────────────────────────────────────────
INSERT INTO teams (abbr, league, full_name, city, conference, division, primary_color, accent_color) VALUES
  ('ATL', 'NBA', 'Atlanta Hawks',              'Atlanta',       'Eastern', 'Southeast', '#E03A3E', '#C1D32F'),
  ('BOS', 'NBA', 'Boston Celtics',             'Boston',        'Eastern', 'Atlantic',  '#007A33', '#BA9653'),
  ('BKN', 'NBA', 'Brooklyn Nets',              'Brooklyn',      'Eastern', 'Atlantic',  '#000000', '#FFFFFF'),
  ('CHA', 'NBA', 'Charlotte Hornets',          'Charlotte',     'Eastern', 'Southeast', '#1D1160', '#00788C'),
  ('CHI', 'NBA', 'Chicago Bulls',              'Chicago',       'Eastern', 'Central',   '#CE1141', '#000000'),
  ('CLE', 'NBA', 'Cleveland Cavaliers',        'Cleveland',     'Eastern', 'Central',   '#860038', '#FDBB30'),
  ('DAL', 'NBA', 'Dallas Mavericks',           'Dallas',        'Western', 'Southwest', '#00538C', '#002B5E'),
  ('DEN', 'NBA', 'Denver Nuggets',             'Denver',        'Western', 'Northwest', '#0E2240', '#FEC524'),
  ('DET', 'NBA', 'Detroit Pistons',            'Detroit',       'Eastern', 'Central',   '#C8102E', '#006BB6'),
  ('GSW', 'NBA', 'Golden State Warriors',      'San Francisco', 'Western', 'Pacific',   '#1D428A', '#FFC72C'),
  ('HOU', 'NBA', 'Houston Rockets',            'Houston',       'Western', 'Southwest', '#CE1141', '#C4CED4'),
  ('IND', 'NBA', 'Indiana Pacers',             'Indianapolis',  'Eastern', 'Central',   '#002D62', '#FDBB30'),
  ('LAC', 'NBA', 'LA Clippers',                'Los Angeles',   'Western', 'Pacific',   '#C8102E', '#1D428A'),
  ('LAL', 'NBA', 'Los Angeles Lakers',         'Los Angeles',   'Western', 'Pacific',   '#552583', '#FDB927'),
  ('MEM', 'NBA', 'Memphis Grizzlies',          'Memphis',       'Western', 'Southwest', '#5D76A9', '#12173F'),
  ('MIA', 'NBA', 'Miami Heat',                 'Miami',         'Eastern', 'Southeast', '#98002E', '#F9A01B'),
  ('MIL', 'NBA', 'Milwaukee Bucks',            'Milwaukee',     'Eastern', 'Central',   '#00471B', '#EEE1C6'),
  ('MIN', 'NBA', 'Minnesota Timberwolves',     'Minneapolis',   'Western', 'Northwest', '#0C2340', '#236192'),
  ('NOP', 'NBA', 'New Orleans Pelicans',       'New Orleans',   'Western', 'Southwest', '#0C2340', '#85714D'),
  ('NYK', 'NBA', 'New York Knicks',            'New York',      'Eastern', 'Atlantic',  '#006BB6', '#F58426'),
  ('OKC', 'NBA', 'Oklahoma City Thunder',      'Oklahoma City', 'Western', 'Northwest', '#007AC1', '#EF3B24'),
  ('ORL', 'NBA', 'Orlando Magic',              'Orlando',       'Eastern', 'Southeast', '#0077C0', '#C4CED4'),
  ('PHI', 'NBA', 'Philadelphia 76ers',         'Philadelphia',  'Eastern', 'Atlantic',  '#006BB6', '#ED174C'),
  ('PHX', 'NBA', 'Phoenix Suns',               'Phoenix',       'Western', 'Pacific',   '#1D1160', '#E56020'),
  ('POR', 'NBA', 'Portland Trail Blazers',     'Portland',      'Western', 'Northwest', '#E03A3E', '#000000'),
  ('SAC', 'NBA', 'Sacramento Kings',           'Sacramento',    'Western', 'Pacific',   '#5A2D81', '#63727A'),
  ('SAS', 'NBA', 'San Antonio Spurs',          'San Antonio',   'Western', 'Southwest', '#C4CED4', '#000000'),
  ('TOR', 'NBA', 'Toronto Raptors',            'Toronto',       'Eastern', 'Atlantic',  '#CE1141', '#000000'),
  ('UTA', 'NBA', 'Utah Jazz',                  'Salt Lake City','Western', 'Northwest', '#002B5C', '#00471B'),
  ('WAS', 'NBA', 'Washington Wizards',         'Washington',    'Eastern', 'Southeast', '#002B5C', '#E31837');

-- ── NFL Teams (32) ────────────────────────────────────────────────────────────
INSERT INTO teams (abbr, league, full_name, city, conference, division, primary_color, accent_color) VALUES
  ('ARI', 'NFL', 'Arizona Cardinals',          'Glendale',       'NFC', 'West',   '#97233F', '#FFB612'),
  ('ATL', 'NFL', 'Atlanta Falcons',            'Atlanta',        'NFC', 'South',  '#A71930', '#000000'),
  ('BAL', 'NFL', 'Baltimore Ravens',           'Baltimore',      'AFC', 'North',  '#241773', '#9E7C0C'),
  ('BUF', 'NFL', 'Buffalo Bills',              'Orchard Park',   'AFC', 'East',   '#00338D', '#C60C30'),
  ('CAR', 'NFL', 'Carolina Panthers',          'Charlotte',      'NFC', 'South',  '#0085CA', '#BFC0BF'),
  ('CHI', 'NFL', 'Chicago Bears',              'Chicago',        'NFC', 'North',  '#0B162A', '#C83803'),
  ('CIN', 'NFL', 'Cincinnati Bengals',         'Cincinnati',     'AFC', 'North',  '#FB4F14', '#000000'),
  ('CLE', 'NFL', 'Cleveland Browns',           'Cleveland',      'AFC', 'North',  '#311D00', '#FF3C00'),
  ('DAL', 'NFL', 'Dallas Cowboys',             'Arlington',      'NFC', 'East',   '#003594', '#869397'),
  ('DEN', 'NFL', 'Denver Broncos',             'Denver',         'AFC', 'West',   '#FB4F14', '#002244'),
  ('DET', 'NFL', 'Detroit Lions',              'Detroit',        'NFC', 'North',  '#0076B6', '#B0B7BC'),
  ('GB',  'NFL', 'Green Bay Packers',          'Green Bay',      'NFC', 'North',  '#203731', '#FFB612'),
  ('HOU', 'NFL', 'Houston Texans',             'Houston',        'AFC', 'South',  '#03202F', '#A71930'),
  ('IND', 'NFL', 'Indianapolis Colts',         'Indianapolis',   'AFC', 'South',  '#002C5F', '#A2AAAD'),
  ('JAX', 'NFL', 'Jacksonville Jaguars',       'Jacksonville',   'AFC', 'South',  '#006778', '#9F792C'),
  ('KC',  'NFL', 'Kansas City Chiefs',         'Kansas City',    'AFC', 'West',   '#E31837', '#FFB81C'),
  ('LAC', 'NFL', 'Los Angeles Chargers',       'Inglewood',      'AFC', 'West',   '#0080C6', '#FFC20E'),
  ('LAR', 'NFL', 'Los Angeles Rams',           'Inglewood',      'NFC', 'West',   '#003594', '#FFA300'),
  ('LV',  'NFL', 'Las Vegas Raiders',          'Las Vegas',      'AFC', 'West',   '#000000', '#A5ACAF'),
  ('MIA', 'NFL', 'Miami Dolphins',             'Miami Gardens',  'AFC', 'East',   '#008E97', '#FC4C02'),
  ('MIN', 'NFL', 'Minnesota Vikings',          'Minneapolis',    'NFC', 'North',  '#4F2683', '#FFC62F'),
  ('NE',  'NFL', 'New England Patriots',       'Foxborough',     'AFC', 'East',   '#002244', '#C60C30'),
  ('NO',  'NFL', 'New Orleans Saints',         'New Orleans',    'NFC', 'South',  '#D3BC8D', '#101820'),
  ('NYG', 'NFL', 'New York Giants',            'East Rutherford','NFC', 'East',   '#0B2265', '#A71930'),
  ('NYJ', 'NFL', 'New York Jets',              'East Rutherford','AFC', 'East',   '#125740', '#000000'),
  ('PHI', 'NFL', 'Philadelphia Eagles',        'Philadelphia',   'NFC', 'East',   '#004C54', '#A5ACAF'),
  ('PIT', 'NFL', 'Pittsburgh Steelers',        'Pittsburgh',     'AFC', 'North',  '#FFB612', '#101820'),
  ('SEA', 'NFL', 'Seattle Seahawks',           'Seattle',        'NFC', 'West',   '#002244', '#69BE28'),
  ('SF',  'NFL', 'San Francisco 49ers',        'Santa Clara',    'NFC', 'West',   '#AA0000', '#B3995D'),
  ('TB',  'NFL', 'Tampa Bay Buccaneers',       'Tampa',          'NFC', 'South',  '#D50A0A', '#FF7900'),
  ('TEN', 'NFL', 'Tennessee Titans',           'Nashville',      'AFC', 'South',  '#0C2340', '#4B92DB'),
  ('WAS', 'NFL', 'Washington Commanders',      'Landover',       'NFC', 'East',   '#773141', '#FFB612');

-- TODO MAS: logo_url is NULL for all teams. After seeding, run the TheSportsDB
-- enrichment pass: for each team, GET https://www.thesportsdb.com/api/v1/json/1/searchteams.php?t={full_name}
-- and UPDATE teams SET logo_url = strTeamBadge WHERE abbr = ?
-- This is a one-time operation. Can be done via a script or manually in the SQL editor.
