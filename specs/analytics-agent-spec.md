# Analytics Agent Spec
**Project:** SportsWire  
**Agent Role:** Analytics specialist — owns all Mixpanel event definitions, property schemas, and PII rules.  
**Document Version:** 1.0  
**Last Updated:** March 2026

---

## Events

All events tracked via `Analytics` class in `lib/shared/analytics.dart`.

| Event | Trigger | Key Properties |
|---|---|---|
| `story_viewed` | User taps story card | story_id, league, teams[], is_hot, source |
| `team_followed` | User follows a team | team, followed_teams[] |
| `team_unfollowed` | User unfollows a team | team |
| `share_link_generated` | User taps Share | story_id |
| `tab_changed` | User taps league tab | tab ('all'/'nba'/'nfl') |
| `settings_opened` | User opens settings sheet | — |
| `deep_link_opened` | App opened via share link | story_id |

## PII Rules

- Never log team names as user-identifiable info — team abbreviations only
- Never log device IDs in Mixpanel
- Never log story headlines — story_id only
- `source` on `story_viewed` distinguishes organic feed views from share link opens — important for measuring virality
