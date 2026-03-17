import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../shared/models/game.dart';
import '../../shared/models/story.dart';
import '../settings/prefs_provider.dart';

final feedProvider =
    FutureProvider.family<List<Story>, String?>((ref, league) async {
  final followed = ref.watch(prefsProvider).followedTeams.toSet();

  try {
    var query = Supabase.instance.client
        .from('stories')
        .select(
            'id, headline, ai_summary, league, team_tags, published_at, is_hot, image_url, article_url');

    if (league != null) {
      query = query.eq('league', league);
    }

    final data = await query
        .order('published_at', ascending: false)
        .limit(50);
    final stories = data.map((e) => Story.fromJson(e)).toList();

    // Client-side sort: my teams first → hot → newest
    stories.sort((a, b) {
      final aFollowed = a.teamTags.any(followed.contains);
      final bFollowed = b.teamTags.any(followed.contains);
      if (aFollowed != bFollowed) return aFollowed ? -1 : 1;
      if (a.isHot != b.isHot) return a.isHot ? -1 : 1;
      return b.publishedAt.compareTo(a.publishedAt);
    });

    return stories;
  } catch (e) {
    throw Exception('Failed to load stories: $e');
  }
});

final todayGamesStreamProvider = StreamProvider<List<Game>>((ref) {
  final stream = Supabase.instance.client
      .from('games')
      .stream(primaryKey: ['id'])
      .inFilter('status', ['scheduled', 'in_progress'])
      .order('game_time');

  return stream.map((data) => data.map((e) => Game.fromJson(e)).toList());
});
