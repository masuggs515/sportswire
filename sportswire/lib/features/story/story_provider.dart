import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// TODO MAS: Phase 3 — implement full story detail payload
// This provider calls the get-story-detail Edge Function once the story screen is built.
final storyDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, storyId) async {
  final response = await Supabase.instance.client.functions.invoke(
    'get-story-detail',
    body: {'storyId': storyId},
  );
  if (response.status != 200) {
    throw Exception('Failed to load story detail');
  }
  return response.data as Map<String, dynamic>;
});
