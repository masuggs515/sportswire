import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../shared/analytics.dart';

class UserPrefs {
  final List<String> followedTeams;

  const UserPrefs({this.followedTeams = const []});

  UserPrefs copyWith({List<String>? followedTeams}) {
    return UserPrefs(followedTeams: followedTeams ?? this.followedTeams);
  }
}

class PrefsNotifier extends StateNotifier<UserPrefs> {
  PrefsNotifier() : super(const UserPrefs()) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final teams = prefs.getStringList('followed_teams') ?? [];
    state = UserPrefs(followedTeams: teams);
  }

  Future<void> toggleTeam(String abbr) async {
    final isFollowing = state.followedTeams.contains(abbr);
    final updated = isFollowing
        ? state.followedTeams.where((t) => t != abbr).toList()
        : [...state.followedTeams, abbr];

    state = state.copyWith(followedTeams: updated);
    await _saveLocally(updated);
    await _syncToSupabase(updated);

    if (isFollowing) {
      Analytics.teamUnfollowed(abbr);
    } else {
      Analytics.teamFollowed(abbr, updated);
    }
  }

  Future<void> _saveLocally(List<String> teams) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('followed_teams', teams);
  }

  Future<void> _syncToSupabase(List<String> teams) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    try {
      await Supabase.instance.client.from('user_preferences').upsert({
        'user_id': user.id,
        'followed_teams': teams,
        'updated_at': DateTime.now().toIso8601String(),
      }, onConflict: 'user_id');
    } catch (_) {
      // Non-fatal — local save already succeeded
    }
  }

  Future<void> syncOnLogin() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    try {
      final remote = await Supabase.instance.client
          .from('user_preferences')
          .select('followed_teams')
          .eq('user_id', user.id)
          .maybeSingle();

      if (remote == null) {
        // First login: push local preferences to Supabase
        await _syncToSupabase(state.followedTeams);
      } else {
        // Existing account: pull remote preferences
        final remoteTeams =
            List<String>.from(remote['followed_teams'] as List? ?? []);
        state = UserPrefs(followedTeams: remoteTeams);
        await _saveLocally(remoteTeams);
      }
    } catch (_) {
      // Non-fatal
    }
  }
}

final prefsProvider = StateNotifierProvider<PrefsNotifier, UserPrefs>(
  (_) => PrefsNotifier(),
);
