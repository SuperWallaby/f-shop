import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

typedef PushTokenRegistrar = Future<void> Function({
  required String token,
  required String platform,
});

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

String? _cachedToken;

Future<void> initPushNotifications() async {
  if (kIsWeb) return;
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (_) {
    // Firebase config missing — push disabled.
  }
}

Future<bool> requestPushPermission() async {
  if (kIsWeb) return false;
  try {
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  } catch (_) {
    return false;
  }
}

String _platformLabel() {
  if (kIsWeb) return 'web';
  if (defaultTargetPlatform == TargetPlatform.iOS) return 'ios';
  return 'android';
}

Future<String?> fetchFcmToken() async {
  if (kIsWeb) return null;
  try {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final apns = await FirebaseMessaging.instance.getAPNSToken();
      if (apns == null) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
      }
    }
    _cachedToken = await FirebaseMessaging.instance.getToken();
    return _cachedToken;
  } catch (_) {
    return null;
  }
}

Future<void> syncPushTokenWithServer(PushTokenRegistrar register) async {
  if (kIsWeb) return;
  try {
    final allowed = await requestPushPermission();
    if (!allowed) return;
    final token = await fetchFcmToken();
    if (token == null || token.isEmpty) return;
    await register(token: token, platform: _platformLabel());
    FirebaseMessaging.instance.onTokenRefresh.listen((next) async {
      _cachedToken = next;
      await register(token: next, platform: _platformLabel());
    });
  } catch (_) {
    // best-effort
  }
}

Future<void> unregisterPushToken(
  Future<void> Function({String? token}) unregister,
) async {
  if (kIsWeb) return;
  try {
    final token = _cachedToken ?? await fetchFcmToken();
    await unregister(token: token);
    await FirebaseMessaging.instance.deleteToken();
    _cachedToken = null;
  } catch (_) {
    // ignore
  }
}
