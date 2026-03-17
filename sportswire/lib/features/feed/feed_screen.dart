import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../shared/analytics.dart';
import '../../shared/widgets/shimmer_card.dart';
import '../settings/settings_sheet.dart';
import 'feed_provider.dart';
import 'game_ticker.dart';
import 'story_card.dart';

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _tabs = [
    (label: 'All', league: null as String?),
    (label: 'NBA', league: 'NBA' as String?),
    (label: 'NFL', league: 'NFL' as String?),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        final tab = _tabs[_tabController.index].label.toLowerCase();
        Analytics.tabChanged(tab);
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'SportsWire',
          style: TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.5,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: Colors.white70),
            onPressed: () {
              Analytics.settingsOpened();
              SettingsSheet.show(context);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: _tabs.map((t) => Tab(text: t.label)).toList(),
          indicatorColor: const Color(0xFF4ECDC4),
          indicatorWeight: 2,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white38,
          labelStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: Column(
        children: [
          // Game ticker (always visible, not scoped to league tab)
          const Padding(
            padding: EdgeInsets.only(top: 12, bottom: 8),
            child: GameTicker(),
          ),
          const Divider(color: Colors.white10, height: 1),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: _tabs
                  .map((t) => _FeedList(league: t.league))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedList extends ConsumerWidget {
  final String? league;

  const _FeedList({this.league});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(feedProvider(league));

    return feedAsync.when(
      data: (stories) {
        if (stories.isEmpty) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.sports_basketball,
                    color: Colors.white24, size: 48),
                SizedBox(height: 12),
                Text(
                  'No stories yet',
                  style: TextStyle(color: Colors.white38, fontSize: 14),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          color: const Color(0xFF4ECDC4),
          backgroundColor: const Color(0xFF1A1A2E),
          onRefresh: () async {
            ref.invalidate(feedProvider(league));
            // Wait briefly so the provider reloads
            await Future.delayed(const Duration(milliseconds: 300));
          },
          child: ListView.builder(
            padding: const EdgeInsets.only(top: 8, bottom: 24),
            itemCount: stories.length,
            itemBuilder: (_, i) {
              final story = stories[i];
              return StoryCard(
                story: story,
                onTap: () {
                  Analytics.storyViewed(story, source: 'feed');
                  context.push('/story/${story.id}');
                },
              );
            },
          ),
        );
      },
      loading: () => ListView(
        padding: const EdgeInsets.only(top: 8),
        children: List.generate(5, (_) => const ShimmerCard()),
      ),
      error: (err, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded,
                  color: Colors.white24, size: 48),
              const SizedBox(height: 12),
              const Text(
                'Check your connection and try again',
                style: TextStyle(color: Colors.white54, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => ref.invalidate(feedProvider(league)),
                child: const Text(
                  'Retry',
                  style: TextStyle(color: Color(0xFF4ECDC4)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
