import 'web_auth_callback_stub.dart'
    if (dart.library.html) 'web_auth_callback_web.dart' as impl;

String? consumeWebAuthCallback() => impl.consumeWebAuthCallback();

void clearWebAuthQueryParams() => impl.clearWebAuthQueryParams();
