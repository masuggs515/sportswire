# Flutter Agent Spec
**Project:** SportsWire  
**Agent Role:** Flutter specialist — owns all UI, screens, state management, navigation, Supabase SDK integration, and share links.  
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Agent Convention — TODO MAS

Any time you need human input, a decision, a credential, a review, or anything uncertain:

```
// TODO MAS: [clear description of what is needed and why]
```

Never stall silently. At the end of every session, print a consolidated list of every TODO MAS item.

---

## Agent Context

You are a Flutter expert building the mobile client for SportsWire. You own everything the user sees and touches. Your responsibilities:

- All Flutter screens and navigation
- Riverpod state providers
- Supabase SDK reads (queries to content tables)
- Supabase Edge Function calls (`get-story-detail`)
- User preference management (local + optional Supabase sync)
- Share links via go_router deep links
- Mixpanel event tracking calls

You do not write Edge Functions. You do not modify the Supabase schema. You never write directly to `stories`, `games`, or `standings` from Flutter — those are written by Edge Functions only. All reads use the Supabase anon key with RLS enforced.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Flutter | Latest stable | UI framework |
| flutter_riverpod | Latest stable | State management |
| go_router | Latest stable | Navigation + deep links |
| supabase_flutter | Latest stable | Auth, DB reads, Edge Function calls |
| cached_network_image | Latest stable | Team logos |
| mixpanel_flutter | Latest stable | Analytics |
| shared_preferences | Latest stable | Local preference storage |
| intl | Latest stable | Date formatting |
| shimmer | Latest stable | Loading skeletons |
| url_launcher | Latest stable | Open ESPN article links in browser |
| share_plus | Latest stable | Native share sheet |

---

## Project Structure

```
lib/
  main.dart                          # Supabase.initialize(), Mixpanel.init(), app entry
  app.dart                           # MaterialApp.router, GoRouter, theme

  core/
    supabase.dart                    # Supabase client singleton
    router.dart                      # go_router: '/' feed, '/story/:id' deep link
    team_config.dart                 # Team abbr → full name, colors lookup

  features/
    feed/
      feed_screen.dart               # main scrollable feed
      game_ticker.dart               # horizontal scroll of today's games
      story_card.dart                # tweet-like card (headline + ai_summary)
      feed_provider.dart             # Riverpod: queries stories, client-side sort

    story/
      story_screen.dart              # full expanded story view
      ai_analysis_card.dart          # displays ai_analysis from Postgres (instant, no API call)
      score_strip.dart               # recent + upcoming game cards
      standings_table.dart           # mini standings widget
      related_stories.dart           # related story cards
      story_provider.dart            # Riverpod: calls get-story-detail edge fn

    settings/
      settings_sheet.dart            # bottom sheet: follow/unfollow teams
      prefs_provider.dart            # Riverpod: local SharedPrefs + optional Supabase sync

    auth/
      auth_gate.dart                 # decides: show feed or login
      login_screen.dart              # magic link sign-in (optional)

  shared/
    models/
      story.dart                     # Dart model + fromJson
      game.dart
      standing.dart
      team.dart
    widgets/
      team_badge.dart                # color dot + team abbr chip
      shimmer_card.dart              # loading skeleton matching story card shape
```

---

## Supabase Initialisation

```dart
// lib/main.dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY'),
  );
  await Mixpanel.init(
    const String.fromEnvironment('MIXPANEL_TOKEN'),
    trackAutomaticEvents: true,
  );
  runApp(const ProviderScope(child: SportsWireApp()));
}
```

---

## Router

```dart
// lib/core/router.dart
final router = GoRouter(routes: [
  GoRoute(
    path: '/',
    builder: (_, __) => const FeedScreen(),
  ),
  GoRoute(
    path: '/story/:id',
    builder: (_, state) => StoryScreen(
      storyId: state.pathParameters['id']!,
    ),
  ),
]);
```

Deep link setup required in:
- iOS: `ios/Runner/Info.plist` — `CFBundleURLSchemes` + Associated Domains entitlement
- Android: `android/app/src/main/AndroidManifest.xml` — `intent-filter` with `autoVerify="true"`

---

## Feed Screen

### Data query

```dart
// lib/features/feed/feed_provider.dart
final feedProvider = FutureProvider.family<List<Story>, String?>((ref, league) async {
  final followed = ref.read(prefsProvider).followedTeams.toSet();

  var query = Supabase.instance.client
    .from('stories')
    .select('id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url, article_url')
    .order('published_at', ascending: false)
    .limit(50);

  if (league != null) query = query.eq('league', league);

  final stories = (await query).map(Story.fromJson).toList();

  // Client-side sort: my teams first → hot → newest
  stories.sort((a, b) {
    final aF = a.teamTags.any(followed.contains);
    final bF = b.teamTags.any(followed.contains);
    if (aF != bF) return aF ? -1 : 1;
    if (a.isHot != b.isHot) return a.isHot ? -1 : 1;
    return b.publishedAt.compareTo(a.publishedAt);
  });

  return stories;
});
```

### Game ticker (today's scores)

```dart
// Real-time stream from games table — updates live without polling
final liveGamesStream = Supabase.instance.client
  .from('games')
  .stream(primaryKey: ['id'])
  .inFilter('status', ['scheduled', 'in_progress'])
  .order('game_time');
```

### League tabs
Three tabs: All / NBA / NFL. Tapping a tab passes the league string to `feedProvider`. All passes `null`.

### Story card
Displays: team color accent stripe, league badge, team name, timestamp, headline, ai_summary, team tags, "FULL STORY →" hint. Hot stories show a 🔥 badge. Followed-team stories appear at full opacity; others at 72% opacity.

---

## Story Screen

### Data fetch

```dart
// lib/features/story/story_provider.dart
final storyDetailProvider = FutureProvider.family<StoryDetail, String>((ref, storyId) async {
  final response = await Supabase.instance.client.functions.invoke(
    'get-story-detail',
    body: {'storyId': storyId},
  );
  if (response.status != 200) throw Exception('Failed to load story');
  return StoryDetail.fromJson(response.data);
});
```

### Layout (top to bottom)
1. Back button + team name header + Share button
2. Team color top border
3. League badge + TRENDING badge if hot
4. Headline (large)
5. AI summary paragraph
6. Team tags + timestamp
7. AI Analysis card — displays `ai_analysis` text directly from Postgres. No loading state needed (always cached).
8. Recent Games strip — horizontal scroll of score mini-cards
9. Upcoming Games — list of scheduled games with win probability
10. Standings table — top 10 for this league, current team highlighted
11. Related Stories — up to 4 cards, tappable to navigate to that story

### Share button
```dart
void _share(Story story) {
  final url = 'https://sportswire.app/story/${story.id}';
  Share.share('${story.headline}\n\n$url');
  Analytics.shareLink(story.id);
}
```

### "Read Full Story" button
Opens `story.articleUrl` via `url_launcher`. Never load ESPN inside the app — always open in browser. Required by ESPN RSS ToS.

---

## Settings Sheet

Bottom sheet (not a full screen). Shows:

- NBA teams grid — toggle each team followed/unfollowed
- NFL teams grid — toggle each team followed/unfollowed
- "Save & Close" button

```dart
// lib/features/settings/prefs_provider.dart
class PrefsNotifier extends StateNotifier<UserPrefs> {
  // On change: save to SharedPreferences immediately
  // If user is logged in: also upsert to Supabase user_preferences table
  Future<void> toggleTeam(String abbr) async {
    final updated = state.followedTeams.contains(abbr)
      ? state.followedTeams.where((t) => t != abbr).toList()
      : [...state.followedTeams, abbr];
    state = state.copyWith(followedTeams: updated);
    await _saveLocally(updated);
    await _syncToSupabase(updated); // no-op if not logged in
  }
}
```

---

## Auth (Optional Login)

Auth is optional. The app works fully without login using device-local preferences.

When user chooses to sign in (magic link via Supabase Auth):
1. Save current local preferences before login
2. After login: check if account has existing preferences in Supabase
3. If yes: pull remote preferences to local (account takes precedence)
4. If no: push local preferences to Supabase (first login)

```dart
// lib/features/auth/auth_gate.dart
// Listens to Supabase auth state changes
// On sign-in event: call PrefsNotifier.syncOnLogin()
// On sign-out event: clear Supabase sync, keep local preferences
```

---

## Mixpanel Events

```dart
// lib/shared/analytics.dart
class Analytics {
  static late Mixpanel _mp;

  static void storyViewed(Story s, {required String source}) =>
    _mp.track('story_viewed', properties: {
      'story_id': s.id,
      'league':   s.league,
      'teams':    s.teamTags,
      'is_hot':   s.isHot,
      'source':   source,  // 'feed' | 'share_link' | 'related'
    });

  static void teamFollowed(String team, List<String> allTeams) {
    _mp.track('team_followed', properties: {'team': team});
    _mp.getPeople().set('followed_teams', allTeams);
  }

  static void teamUnfollowed(String team) =>
    _mp.track('team_unfollowed', properties: {'team': team});

  static void shareLink(String storyId) =>
    _mp.track('share_link_generated', properties: {'story_id': storyId});

  static void tabChanged(String tab) =>
    _mp.track('tab_changed', properties: {'tab': tab}); // 'all' | 'nba' | 'nfl'

  static void settingsOpened() =>
    _mp.track('settings_opened');
}
```

---

## Team Config

```dart
// lib/core/team_config.dart
class TeamConfig {
  static const Map<String, TeamData> nba = {
    'LAL': TeamData(fullName: 'Los Angeles Lakers', primaryColor: Color(0xFF552583), accentColor: Color(0xFFFDB927)),
    'BOS': TeamData(fullName: 'Boston Celtics',     primaryColor: Color(0xFF007A33), accentColor: Color(0xFFBA9653)),
    'GSW': TeamData(fullName: 'Golden State Warriors', primaryColor: Color(0xFF1D428A), accentColor: Color(0xFFFFC72C)),
    'MIA': TeamData(fullName: 'Miami Heat',         primaryColor: Color(0xFF98002E), accentColor: Color(0xFFF9A01B)),
    'NYK': TeamData(fullName: 'New York Knicks',    primaryColor: Color(0xFF006BB6), accentColor: Color(0xFFF58426)),
    'OKC': TeamData(fullName: 'Oklahoma City Thunder', primaryColor: Color(0xFF007AC1), accentColor: Color(0xFFEF3B24)),
    'DEN': TeamData(fullName: 'Denver Nuggets',     primaryColor: Color(0xFF0E2240), accentColor: Color(0xFFFEC524)),
    'MIN': TeamData(fullName: 'Minnesota Timberwolves', primaryColor: Color(0xFF0C2340), accentColor: Color(0xFF236192)),
    'CLE': TeamData(fullName: 'Cleveland Cavaliers', primaryColor: Color(0xFF860038), accentColor: Color(0xFFFDBB30)),
    'DET': TeamData(fullName: 'Detroit Pistons',    primaryColor: Color(0xFFC8102E), accentColor: Color(0xFF006BB6)),
    'SAS': TeamData(fullName: 'San Antonio Spurs',  primaryColor: Color(0xFFC4CED4), accentColor: Color(0xFF000000)),
    'HOU': TeamData(fullName: 'Houston Rockets',    primaryColor: Color(0xFFCE1141), accentColor: Color(0xFFC4CED4)),
    // Add all 30 NBA teams
  };

  static const Map<String, TeamData> nfl = {
    'KC':  TeamData(fullName: 'Kansas City Chiefs',    primaryColor: Color(0xFFE31837), accentColor: Color(0xFFFFB81C)),
    'SF':  TeamData(fullName: 'San Francisco 49ers',   primaryColor: Color(0xFFAA0000), accentColor: Color(0xFFB3995D)),
    'PHI': TeamData(fullName: 'Philadelphia Eagles',   primaryColor: Color(0xFF004C54), accentColor: Color(0xFFA5ACAF)),
    'DAL': TeamData(fullName: 'Dallas Cowboys',        primaryColor: Color(0xFF003594), accentColor: Color(0xFF869397)),
    'BUF': TeamData(fullName: 'Buffalo Bills',         primaryColor: Color(0xFF00338D), accentColor: Color(0xFFC60C30)),
    'BAL': TeamData(fullName: 'Baltimore Ravens',      primaryColor: Color(0xFF241773), accentColor: Color(0xFF9E7C0C)),
    'GB':  TeamData(fullName: 'Green Bay Packers',     primaryColor: Color(0xFF203731), accentColor: Color(0xFFFFB612)),
    'MIA': TeamData(fullName: 'Miami Dolphins',        primaryColor: Color(0xFF008E97), accentColor: Color(0xFFFC4C02)),
    // Add all 32 NFL teams
  };
}
```

---

## Performance Requirements

- Feed cold load: under 1 second on good connection
- Story screen open: under 500ms (single Edge Function call, everything cached)
- AI analysis display: instant (data comes pre-cached from Postgres, no API call at read time)
- Shimmer skeletons shown immediately while data loads — never a blank screen
- Images loaded lazily via `cached_network_image`

---

## Error Handling

- All Supabase calls wrapped in try/catch
- On network error: show friendly message — "Check your connection and try again"
- On story detail load failure: show retry button
- If article_url is missing: hide "Read Full Story" button rather than show broken link
- Never crash — always degrade gracefully

---

## Deliverable Checklist

- [ ] Feed screen showing real stories from Supabase
- [ ] League tabs filtering correctly
- [ ] Game ticker showing real scores
- [ ] Story card correct layout and team color accents
- [ ] Story screen assembled from get-story-detail response
- [ ] AI analysis displayed instantly (no loading state needed)
- [ ] "Read Full Story" opens ESPN URL in browser
- [ ] Share button generates and shares deep link URL
- [ ] Settings sheet: team picker saves preferences
- [ ] Deep link `/story/:id` navigates correctly on cold start
- [ ] Loading skeletons shown during all data fetches
- [ ] Mixpanel events firing: story_viewed, team_followed, share_link_generated, tab_changed
- [ ] App runs on Android without crashes
- [ ] App runs on iOS without crashes
- [ ] flutter analyze clean
- [ ] flutter test passing

---

*This spec is the single source of truth for the Flutter agent. Do not make architectural decisions not covered here without raising a TODO MAS.*
