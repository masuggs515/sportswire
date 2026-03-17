import 'package:mixpanel_flutter/mixpanel_flutter.dart';

import 'models/story.dart';

class Analytics {
  static late Mixpanel _mp;

  static void init(Mixpanel mp) {
    _mp = mp;
  }

  static void storyViewed(Story s, {required String source}) {
    _mp.track('story_viewed', properties: {
      'story_id': s.id,
      'league': s.league,
      'teams': s.teamTags,
      'is_hot': s.isHot,
      'source': source, // 'feed' | 'share_link' | 'related'
    });
  }

  static void teamFollowed(String team, List<String> allTeams) {
    _mp.track('team_followed', properties: {'team': team});
    _mp.getPeople().set('followed_teams', allTeams);
  }

  static void teamUnfollowed(String team) {
    _mp.track('team_unfollowed', properties: {'team': team});
  }

  static void shareLink(String storyId) {
    _mp.track('share_link_generated', properties: {'story_id': storyId});
  }

  static void tabChanged(String tab) {
    _mp.track('tab_changed', properties: {'tab': tab}); // 'all' | 'nba' | 'nfl'
  }

  static void settingsOpened() {
    _mp.track('settings_opened');
  }

  static void deepLinkOpened(String storyId) {
    _mp.track('deep_link_opened', properties: {'story_id': storyId});
  }
}
