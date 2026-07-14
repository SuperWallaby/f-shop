import 'package:flutter/foundation.dart';

/// OAuth redirect start URLs for Flutter web (same-window navigation).
String googleOAuthStartUrl(String apiBaseUrl) {
  final returnTo = Uri.encodeComponent(Uri.base.origin);
  return '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}'
      '/api/public/client/auth/google?returnTo=$returnTo';
}

String appleOAuthStartUrl(String apiBaseUrl) {
  final returnTo = Uri.encodeComponent(Uri.base.origin);
  return '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}'
      '/api/public/client/auth/apple?returnTo=$returnTo';
}

String? describeWebAuthError(String code) {
  const messages = {
    'google_unconfigured': 'Google sign-in is not configured yet.',
    'apple_unconfigured': 'Apple sign-in is not configured yet.',
    'google_denied': 'Google sign-in was cancelled.',
    'google_state': 'Google sign-in expired. Please try again.',
    'google_token': 'Google sign-in failed. Please try again.',
    'google_email': 'Google did not provide a verified email.',
    'google_account': 'Could not create your account.',
    'apple_denied': 'Apple sign-in was cancelled.',
    'apple_state': 'Apple sign-in expired. Please try again.',
    'apple_token': 'Apple sign-in failed. Please try again.',
    'apple_email_required': 'Apple did not provide an email.',
    'apple_account': 'Could not create your account.',
    'apple_server': 'Apple sign-in failed. Please try again.',
  };
  return messages[code] ?? 'Sign-in failed ($code).';
}

bool get isFlutterWeb => kIsWeb;
