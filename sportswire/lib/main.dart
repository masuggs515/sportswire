import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mixpanel_flutter/mixpanel_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'shared/analytics.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY'),
  );

  final mixpanel = await Mixpanel.init(
    const String.fromEnvironment('MIXPANEL_TOKEN'),
    trackAutomaticEvents: true,
  );
  Analytics.init(mixpanel);

  runApp(const ProviderScope(child: SportsWireApp()));
}
