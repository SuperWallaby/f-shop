import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Loads fonts from [FontManifest.json] so golden screenshots render real text
/// instead of Flutter's default test font (Ahem → black rectangles).
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await _loadPackageFonts();
  await testMain();
}

Future<void> _loadPackageFonts() async {
  final manifestJson = await rootBundle.loadString('FontManifest.json');
  final manifest = json.decode(manifestJson) as List<dynamic>;

  for (final entry in manifest) {
    final map = entry as Map<String, dynamic>;
    final family = map['family'] as String;
    final loader = FontLoader(family);
    for (final font in map['fonts'] as List<dynamic>) {
      final fontMap = font as Map<String, dynamic>;
      loader.addFont(rootBundle.load(fontMap['asset'] as String));
    }
    await loader.load();
  }
}
