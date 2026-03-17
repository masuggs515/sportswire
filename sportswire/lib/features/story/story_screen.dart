import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/analytics.dart';
import 'story_provider.dart';

// TODO MAS: Phase 3 — build full story screen layout per flutter-agent-spec.md
// Layout: back button, team header, AI analysis card, score strip,
// upcoming games, standings table, related stories, "Read Full Story" button.
class StoryScreen extends ConsumerWidget {
  final String storyId;

  const StoryScreen({super.key, required this.storyId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(storyDetailProvider(storyId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        actions: [
          detailAsync.whenData((data) {
            final story = data['story'] as Map<String, dynamic>?;
            if (story == null) return const SizedBox.shrink();
            return IconButton(
              icon: const Icon(Icons.share_rounded, color: Colors.white70),
              onPressed: () {
                final url = 'https://sportswire.app/story/$storyId';
                Share.share('${story['headline']}\n\n$url');
                Analytics.shareLink(storyId);
              },
            );
          }).value ??
              const SizedBox.shrink(),
        ],
      ),
      body: detailAsync.when(
        data: (data) {
          final story = data['story'] as Map<String, dynamic>?;
          if (story == null) {
            return const Center(
              child: Text('Story not found',
                  style: TextStyle(color: Colors.white54)),
            );
          }

          final articleUrl = story['article_url'] as String?;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  story['headline'] as String? ?? '',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 12),
                if (story['ai_summary'] != null) ...[
                  Text(
                    story['ai_summary'] as String,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 15,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (story['ai_analysis'] != null) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'AI ANALYSIS',
                          style: TextStyle(
                            color: Color(0xFF4ECDC4),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          story['ai_analysis'] as String,
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                // TODO MAS: Phase 3 — add score_strip, standings_table, related_stories widgets
                if (articleUrl != null && articleUrl.isNotEmpty)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => _openArticle(articleUrl),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white24),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: const Text('Read Full Story on ESPN →'),
                    ),
                  ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Could not load story',
                  style: TextStyle(color: Colors.white54)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(storyDetailProvider(storyId)),
                child: const Text('Retry',
                    style: TextStyle(color: Color(0xFF4ECDC4))),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openArticle(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
