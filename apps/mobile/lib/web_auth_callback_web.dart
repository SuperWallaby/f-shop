// ignore_for_file: avoid_web_libraries_in_flutter

import 'dart:html' as html;

String? consumeWebAuthCallback() {
  final uri = Uri.parse(html.window.location.href);
  final err = uri.queryParameters['authErr'];
  final ok = uri.queryParameters['authOk'];
  if (err == null && ok == null) return null;

  clearWebAuthQueryParams();

  if (err != null && err.isNotEmpty) return err;
  return null;
}

void clearWebAuthQueryParams() {
  final uri = Uri.parse(html.window.location.href);
  if (!uri.queryParameters.containsKey('authErr') &&
      !uri.queryParameters.containsKey('authOk')) {
    return;
  }
  final clean = uri.replace(queryParameters: {});
  html.window.history.replaceState(null, '', clean.toString());
}
