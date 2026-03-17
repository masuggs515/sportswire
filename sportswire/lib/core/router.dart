import 'package:go_router/go_router.dart';

import '../features/feed/feed_screen.dart';
import '../features/story/story_screen.dart';

final router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const FeedScreen(),
    ),
    GoRoute(
      path: '/story/:id',
      builder: (_, state) => StoryScreen(
        storyId: state.pathParameters['id']!,
      ),
    ),
  ],
);
