class Story {
  final String id;
  final String headline;
  final String? aiSummary;
  final String league;
  final List<String> teamTags;
  final DateTime publishedAt;
  final bool isHot;
  final String? imageUrl;
  final String? articleUrl;

  const Story({
    required this.id,
    required this.headline,
    this.aiSummary,
    required this.league,
    required this.teamTags,
    required this.publishedAt,
    required this.isHot,
    this.imageUrl,
    this.articleUrl,
  });

  factory Story.fromJson(Map<String, dynamic> json) {
    return Story(
      id: json['id'] as String,
      headline: json['headline'] as String,
      aiSummary: json['ai_summary'] as String?,
      league: json['league'] as String,
      teamTags: List<String>.from(json['team_tags'] as List? ?? []),
      publishedAt: DateTime.parse(json['published_at'] as String),
      isHot: json['is_hot'] as bool? ?? false,
      imageUrl: json['image_url'] as String?,
      articleUrl: json['article_url'] as String?,
    );
  }
}
