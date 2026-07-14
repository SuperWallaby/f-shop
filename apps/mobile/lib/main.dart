import 'package:dio/dio.dart';
import 'dart:async';
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kDebugMode, kIsWeb, kProfileMode, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_dio.dart';
import 'fasea_design_system.dart';
import 'google_auth.dart';
import 'google_logo_icon.dart';
import 'oauth_web.dart';
import 'push_service.dart';
import 'schedule_screen.dart';
import 'web_auth_callback.dart';

/// Optional compile-time URL: `--dart-define=API_BASE_URL=https://...`
const String _kApiBaseUrlFromDefine = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: '',
);

/// Local Next.js (`yarn dev`). Port from `--dart-define=FASEA_API_PORT=…` / `.env.local`.
const String _kApiPortFromDefine = String.fromEnvironment(
  'FASEA_API_PORT',
  defaultValue: '4819',
);

String _localApiBaseUrl() {
  final port = _kApiPortFromDefine;
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:$port';
  }
  return 'http://localhost:$port';
}

/// Base URL for API calls.
/// - **`--dart-define=API_BASE_URL=...`**: always wins (LAN IP on physical devices, staging, prod…).
/// - **Debug / profile** (`flutter run`, `flutter run --profile`): local Next (`localhost:4819` by default).
/// - **Release** (store builds): production host unless `API_BASE_URL` is set on the build.
///
/// Physical device debugging: use `--dart-define=API_BASE_URL=http://<host-LAN-IP>:4819`.
String resolveApiBaseUrl() {
  final fromDefine = _kApiBaseUrlFromDefine.trim();
  if (fromDefine.isNotEmpty) {
    return fromDefine.replaceAll(RegExp(r'/+$'), '');
  }
  if (kDebugMode || kProfileMode) {
    return _localApiBaseUrl();
  }
  return 'https://fasea.studio';
}

String formatApiError(Object error) {
  final raw = error.toString();
  if (raw.contains('Connection refused') ||
      raw.contains('connection error') ||
      raw.contains('Failed host lookup')) {
    return 'Cannot reach the API at ${resolveApiBaseUrl()}. '
        'Run yarn app (or yarn dev) on your Mac and use the same Wi‑Fi for a physical phone.';
  }
  if (error is DioException) {
    final message = error.message;
    if (message != null && message.isNotEmpty) return message;
  }
  return raw;
}

const studioPhone = '60145403560';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initPushNotifications();
  runApp(const FaseaApp());
}

class FaseaApp extends StatelessWidget {
  const FaseaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Faséa',
      debugShowCheckedModeBanner: false,
      theme: buildFaseaTheme(),
      home: const AppBootstrap(),
    );
  }
}

class AppBootstrap extends StatefulWidget {
  const AppBootstrap({super.key});
  @override
  State<AppBootstrap> createState() => _AppBootstrapState();
}

class _AppBootstrapState extends State<AppBootstrap> {
  ApiClient? api;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final base = resolveApiBaseUrl();
    if (!kIsWeb) {
      await const FlutterSecureStorage().write(
        key: 'fasea_api_base_url',
        value: base,
      );
    }
    final dio = await createApiDio(base);
    if (!mounted) return;
    setState(() => api = ApiClient(dio));
  }

  @override
  Widget build(BuildContext context) {
    final client = api;
    if (client == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return AppSession(api: client);
  }
}

class AppSession extends StatefulWidget {
  const AppSession({super.key, required this.api});
  final ApiClient api;
  @override
  State<AppSession> createState() => _AppSessionState();
}

class _AppSessionState extends State<AppSession> {
  ClientMe? me;
  bool loading = true;
  bool adminAuthed = false;
  String? webAuthError;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final authErrCode = consumeWebAuthCallback();
    if (authErrCode != null) {
      webAuthError = describeWebAuthError(authErrCode);
    }
    await refresh();
  }

  Future<void> refresh() async {
    setState(() => loading = true);
    try {
      final next = await widget.api.me();
      final admin = await widget.api.adminMe().catchError((_) => false);
      if (!mounted) return;
      setState(() {
        me = next;
        adminAuthed = admin;
      });
      if (next.authed) {
        unawaited(
          syncPushTokenWithServer(
            ({required token, required platform}) =>
                widget.api.registerPushToken(token: token, platform: platform),
          ),
        );
      }
    } catch (_) {
      // Keep existing session on network errors — don't force re-login.
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  bool _needsName(ClientMe current) =>
      current.needsName || (current.client?.name ?? '').trim().isEmpty;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final current = me;
    if (current == null || !current.authed) {
      return AuthScreen(
        api: widget.api,
        onAuthed: refresh,
        initialError: webAuthError,
      );
    }
    if (_needsName(current)) {
      return CompleteNameScreen(
        api: widget.api,
        email: current.client?.email,
        onSaved: refresh,
      );
    }
    return FaseaShell(
      api: widget.api,
      me: current,
      adminAuthed: adminAuthed,
      onChanged: refresh,
      onAdminChanged: (v) => setState(() => adminAuthed = v),
    );
  }
}

class FaseaShell extends StatefulWidget {
  const FaseaShell({
    super.key,
    required this.api,
    required this.me,
    required this.adminAuthed,
    required this.onChanged,
    required this.onAdminChanged,
  });
  final ApiClient api;
  final ClientMe me;
  final bool adminAuthed;
  final Future<void> Function() onChanged;
  final ValueChanged<bool> onAdminChanged;
  @override
  State<FaseaShell> createState() => _FaseaShellState();
}

class _FaseaShellState extends State<FaseaShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = [
      BookScreen(api: widget.api, me: widget.me, onChanged: widget.onChanged),
      MembershipScreen(
        api: widget.api,
        me: widget.me,
        onChanged: widget.onChanged,
      ),
      EventsScreen(api: widget.api),
      AccountScreen(
        api: widget.api,
        me: widget.me,
        adminAuthed: widget.adminAuthed,
        onChanged: widget.onChanged,
        onAdminChanged: widget.onAdminChanged,
      ),
      if (widget.adminAuthed) ManageScreen(api: widget.api),
    ];
    final destinations = [
      const NavigationDestination(
        icon: Icon(Icons.calendar_month),
        label: 'Book',
      ),
      const NavigationDestination(
        icon: Icon(Icons.card_membership),
        label: 'Membership',
      ),
      const NavigationDestination(
        icon: Icon(Icons.local_activity),
        label: 'Events',
      ),
      const NavigationDestination(icon: Icon(Icons.person), label: 'Account'),
      if (widget.adminAuthed)
        const NavigationDestination(icon: Icon(Icons.tune), label: 'Manage'),
    ];
    final safeIndex = index.clamp(0, pages.length - 1);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Faséa', style: TextStyle(fontFamily: FaseaFonts.serif)),
        titleSpacing: FaseaSpacing.md,
      ),
      body: pages[safeIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: destinations,
      ),
    );
  }
}

class ApiClient {
  ApiClient(this.dio);
  final Dio dio;

  dynamic _data(Response<dynamic> res) {
    final body = res.data;
    if (body is Map && body['ok'] == true) return body['data'];
    final message = body is Map && body['error'] is Map
        ? (body['error'] as Map)['message']
        : null;
    throw Exception(message ?? 'Request failed');
  }

  Future<ClientMe> me() async =>
      ClientMe.fromJson(asMap(_data(await dio.get('/api/public/client/me'))));
  Future<ClientMe> emailAuth(String email) async => ClientMe.fromAuthData(
    asMap(
      _data(
        await dio.post(
          '/api/public/client/auth/request',
          data: {'email': email},
        ),
      ),
    ),
  );
  Future<ClientMe> googleAuth(String idToken) async => ClientMe.fromAuthData(
    asMap(
      _data(
        await dio.post(
          '/api/public/client/auth/google/mobile',
          data: {'idToken': idToken},
        ),
      ),
    ),
  );
  Future<ClientMe> recover(String name, String whatsapp) async =>
      ClientMe.fromAuthData(
        asMap(
          _data(
            await dio.post(
              '/api/public/client/auth/recover',
              data: {'name': name, 'whatsapp': whatsapp},
            ),
          ),
        ),
      );
  Future<ClientMe> saveName(String name) async => ClientMe.fromAuthData(
    asMap(
      _data(
        await dio.patch('/api/public/client/profile', data: {'name': name}),
      ),
    ),
  );
  Future<void> logout() => dio.post('/api/public/client/logout');
  Future<List<Plan>> plans() async => asList(
    asMap(_data(await dio.get('/api/public/plans')))['plans'],
  ).map((e) => Plan.fromJson(asMap(e))).toList();
  Future<String> createOrder(String planId) async =>
      asMap(
            asMap(
              _data(
                await dio.post('/api/public/orders', data: {'planId': planId}),
              ),
            )['order'],
          )['whatsappUrl']
          as String;
  Future<List<ClassItem>> items() async => asList(
    asMap(_data(await dio.get('/api/public/items')))['items'],
  ).map((e) => ClassItem.fromJson(asMap(e))).toList();
  Future<PublicScheduleData> schedule({
    required String fromDateKey,
    required String toDateKey,
    String? itemId,
  }) async => PublicScheduleData.fromJson(
    asMap(
      _data(
        await dio.get(
          '/api/public/schedule',
          queryParameters: {
            'fromDateKey': fromDateKey,
            'toDateKey': toDateKey,
            if (itemId != null && itemId.isNotEmpty) 'itemId': itemId,
          },
        ),
      ),
    ),
  );
  Future<List<String>> availableDates(
    String from,
    String to,
    String itemId,
  ) async => asList(
    asMap(
      _data(
        await dio.get(
          '/api/public/available-dates',
          queryParameters: {
            'fromDateKey': from,
            'toDateKey': to,
            'itemId': itemId,
          },
        ),
      ),
    )['dateKeys'],
  ).map((e) => '$e').toList();
  Future<List<Slot>> slots(String dateKey, String itemId) async => asList(
    asMap(
      _data(
        await dio.get(
          '/api/public/slots',
          queryParameters: {'dateKey': dateKey, 'itemId': itemId},
        ),
      ),
    )['slots'],
  ).map((e) => Slot.fromJson(asMap(e))).toList();
  Future<String> book({
    required String slotId,
    required String name,
    required String email,
    required String whatsapp,
  }) async =>
      asMap(
            _data(
              await dio.post(
                '/api/public/bookings',
                data: {
                  'slotId': slotId,
                  'name': name,
                  'email': email,
                  'whatsapp': whatsapp,
                  'consentWhatsapp': true,
                  'marketingOptIn': false,
                },
              ),
            ),
          )['bookingCode']
          as String;
  Future<List<BookingLookup>> lookupBookings({
    String? code,
    String? name,
    String? email,
    String? whatsapp,
  }) async => asList(
    asMap(
      _data(
        await dio.get(
          '/api/public/bookings/lookup',
          queryParameters: {
            if (code?.isNotEmpty == true) 'code': code,
            if (name?.isNotEmpty == true) 'name': name,
            if (email?.isNotEmpty == true) 'email': email,
            if (whatsapp?.isNotEmpty == true) 'whatsapp': whatsapp,
          },
        ),
      ),
    )['items'],
  ).map((e) => BookingLookup.fromJson(asMap(e))).toList();
  Future<List<BookingLookup>> myBookings() async => asList(
    asMap(_data(await dio.get('/api/public/client/bookings')))['items'],
  ).map((e) => BookingLookup.fromJson(asMap(e))).toList();
  Future<void> cancelBooking({
    required String code,
    String? email,
    String? whatsapp,
  }) async => _data(
    await dio.post(
      '/api/public/bookings/cancel',
      data: {
        'code': code,
        if (email?.isNotEmpty == true) 'email': email,
        if (whatsapp?.isNotEmpty == true) 'whatsapp': whatsapp,
      },
    ),
  );
  Future<List<FaseaEvent>> events({bool admin = false}) async => asList(
    asMap(
      _data(await dio.get(admin ? '/api/admin/events' : '/api/public/events')),
    )['events'],
  ).map((e) => FaseaEvent.fromJson(asMap(e))).toList();
  Future<void> createEvent(Map<String, dynamic> body) async =>
      _data(await dio.post('/api/admin/events', data: body));
  Future<void> patchEvent(String id, Map<String, dynamic> body) async =>
      _data(await dio.patch('/api/admin/events/$id', data: body));
  Future<bool> adminMe() async =>
      asMap(_data(await dio.get('/api/admin/me')))['authed'] == true;
  Future<void> adminLogin(String password) async =>
      _data(await dio.post('/api/admin/login', data: {'password': password}));
  Future<List<Plan>> adminPlans() async => asList(
    asMap(_data(await dio.get('/api/admin/plans')))['plans'],
  ).map((e) => Plan.fromJson(asMap(e))).toList();
  Future<void> createPlan(Map<String, dynamic> body) async =>
      _data(await dio.post('/api/admin/plans', data: body));
  Future<void> patchPlan(String id, Map<String, dynamic> body) async =>
      _data(await dio.patch('/api/admin/plans/$id', data: body));
  Future<void> registerPushToken({
    required String token,
    required String platform,
  }) async => _data(
    await dio.post(
      '/api/public/client/push-token',
      data: {'token': token, 'platform': platform},
    ),
  );
  Future<void> unregisterPushToken({String? token}) async => _data(
    await dio.delete(
      '/api/public/client/push-token',
      data: {if (token != null && token.isNotEmpty) 'token': token},
    ),
  );
  Future<void> setPushMarketingOptIn(bool enabled) async => _data(
    await dio.patch(
      '/api/public/client/push-preferences',
      data: {'pushMarketingOptIn': enabled},
    ),
  );
}

Map<String, dynamic> asMap(dynamic value) =>
    Map<String, dynamic>.from(value as Map);
List<dynamic> asList(dynamic value) =>
    List<dynamic>.from(value as List? ?? const []);

class ClientMe {
  ClientMe({required this.authed, this.needsName = false, this.client, this.balance});
  final bool authed;
  final bool needsName;
  final Client? client;
  final Balance? balance;
  factory ClientMe.fromJson(Map<String, dynamic> json) => ClientMe(
    authed: json['authed'] == true,
    needsName: json['needsName'] == true,
    client: json['client'] == null
        ? null
        : Client.fromJson(asMap(json['client'])),
    balance: json['balance'] == null
        ? null
        : Balance.fromJson(asMap(json['balance'])),
  );
  factory ClientMe.fromAuthData(Map<String, dynamic> json) => ClientMe(
    authed: true,
    needsName: json['needsName'] == true,
    client: json['client'] == null
        ? null
        : Client.fromJson(asMap(json['client'])),
    balance: json['balance'] == null
        ? null
        : Balance.fromJson(asMap(json['balance'])),
  );
}

class Client {
  Client.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      name = '${json['name'] ?? ''}',
      email = '${json['email'] ?? ''}',
      whatsapp = '${json['whatsapp'] ?? ''}',
      studentStatus = '${json['studentStatus'] ?? 'none'}',
      pushMarketingOptIn = json['pushMarketingOptIn'] as bool? ?? true;
  final String id, name, email, whatsapp, studentStatus;
  final bool pushMarketingOptIn;
}

class Balance {
  Balance.fromJson(Map<String, dynamic> json)
    : balance = json['balance'] as int? ?? 0,
      expiringCredits = asList(
        json['expiringCredits'],
      ).map((e) => ExpiringCredit.fromJson(asMap(e))).toList();
  final int balance;
  final List<ExpiringCredit> expiringCredits;
}

class ExpiringCredit {
  ExpiringCredit.fromJson(Map<String, dynamic> json)
    : amount = json['amount'] as int? ?? 0,
      expiresAt = DateTime.tryParse('${json['expiresAt']}');
  final int amount;
  final DateTime? expiresAt;
}

class Plan {
  Plan.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      code = '${json['code'] ?? ''}',
      title = '${json['title'] ?? ''}',
      cardTitle = '${json['cardTitle'] ?? ''}',
      category = '${json['category'] ?? ''}',
      sortOrder = json['sortOrder'] as int? ?? 0,
      classCount = json['classCount'] as int? ?? 0,
      priceRm = (json['priceRm'] as num?)?.toDouble() ?? 0,
      studentPriceRm = (json['studentPriceRm'] as num?)?.toDouble(),
      validityDays = json['validityDays'] as int? ?? 0,
      active = json['active'] as bool? ?? true;
  final String id, code, title, cardTitle, category;
  final int sortOrder, classCount, validityDays;
  final double priceRm;
  final double? studentPriceRm;
  final bool active;

  /// Short label under each category on booking; falls back to [title].
  String get displayTitle {
    final c = cardTitle.trim();
    return c.isNotEmpty ? c : title;
  }
}

class ClassItem {
  ClassItem.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      name = '${json['name'] ?? ''}',
      description = '${json['description'] ?? ''}';
  final String id, name, description;
}

class Slot {
  Slot.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      dateKey = '${json['dateKey']}',
      startMin = json['startMin'] as int? ?? 0,
      endMin = json['endMin'] as int? ?? 0,
      available = json['available'] as int? ?? 0,
      bookable = json['bookable'] as bool? ?? true,
      isFull = json['isFull'] as bool? ?? true;
  final String id, dateKey;
  final int startMin, endMin, available;
  final bool bookable, isFull;

  bool get isSelectable => bookable && !isFull;
}

class BookingLookup {
  BookingLookup.fromJson(Map<String, dynamic> json)
    : code = '${json['code'] ?? ''}',
      status = '${json['status'] ?? ''}',
      dateKey = '${json['dateKey'] ?? ''}',
      startMin = json['startMin'] as int? ?? 0,
      endMin = json['endMin'] as int? ?? 0,
      className = '${json['className'] ?? ''}';
  final String code, status, dateKey, className;
  final int startMin, endMin;

  String get timeRange =>
      '${timeLabel(startMin)} – ${timeLabel(endMin)}';

  String formattedDate() {
    final parts = dateKey.split('-');
    if (parts.length != 3) return dateKey;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final d = int.tryParse(parts[2]);
    if (y == null || m == null || d == null) return dateKey;
    return DateFormat.yMMMd().format(DateTime(y, m, d));
  }
}

class FaseaEvent {
  FaseaEvent.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      title = '${json['title'] ?? ''}',
      summary = '${json['summary'] ?? ''}',
      description = json['description'] as String?,
      imageUrl = json['imageUrl'] as String?,
      startsAt = DateTime.tryParse('${json['startsAt'] ?? ''}'),
      location = json['location'] as String?,
      priceLabel = json['priceLabel'] as String?,
      capacityLabel = json['capacityLabel'] as String?,
      whatsappText = json['whatsappText'] as String?,
      active = json['active'] as bool? ?? true,
      sortOrder = json['sortOrder'] as int? ?? 0;
  final String id, title, summary;
  final String? description,
      imageUrl,
      location,
      priceLabel,
      capacityLabel,
      whatsappText;
  final DateTime? startsAt;
  final bool active;
  final int sortOrder;
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.api,
    required this.onAuthed,
    this.initialError,
  });
  final ApiClient api;
  final Future<void> Function() onAuthed;
  final String? initialError;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController();
  final recoverName = TextEditingController();
  final recoverWhatsapp = TextEditingController();
  bool recover = false, loading = false, googleLoading = false;
  String? error;

  @override
  void initState() {
    super.initState();
    error = widget.initialError;
  }

  Future<void> _startOAuthRedirect(String url) async {
    setState(() {
      googleLoading = true;
      error = null;
    });
    try {
      final uri = Uri.parse(url);
      final launched = await launchUrl(uri, webOnlyWindowName: '_self');
      if (!launched) {
        throw Exception('Could not open sign-in page.');
      }
    } catch (e) {
      if (mounted) setState(() => error = formatApiError(e));
      if (mounted) setState(() => googleLoading = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    if (kIsWeb) {
      await _startOAuthRedirect(googleOAuthStartUrl(resolveApiBaseUrl()));
      return;
    }
    setState(() {
      googleLoading = true;
      error = null;
    });
    try {
      final idToken = await signInWithGoogleIdToken();
      if (idToken == null) return;
      await widget.api.googleAuth(idToken);
      await widget.onAuthed();
    } catch (e) {
      if (mounted) setState(() => error = formatApiError(e));
    } finally {
      if (mounted) setState(() => googleLoading = false);
    }
  }

  Future<void> _signInWithApple() async {
    await _startOAuthRedirect(appleOAuthStartUrl(resolveApiBaseUrl()));
  }

  Future<void> submit() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (recover) {
        await widget.api.recover(recoverName.text, recoverWhatsapp.text);
      } else {
        await widget.api.emailAuth(email.text);
      }
      await widget.onAuthed();
    } catch (e) {
      setState(() => error = formatApiError(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          FaseaSpacing.lg,
          FaseaSpacing.md,
          FaseaSpacing.lg,
          FaseaSpacing.lg,
        ),
        children: [
          const Text(
            'Welcome to',
            style: TextStyle(letterSpacing: 4, color: FaseaColors.primary),
          ),
          const Text(
            'Faséa',
            style: TextStyle(
              fontFamily: FaseaFonts.serif,
              fontSize: 42,
              fontWeight: FontWeight.w700,
              color: FaseaColors.tertiary,
              height: 1.1,
            ),
          ),
          const SizedBox(height: FaseaSpacing.md),
          FaseaCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  recover ? 'Find your account' : 'Start with your email.',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: FaseaSpacing.headlineToSubtitle),
                Text(
                  recover
                      ? 'Use the name and WhatsApp number saved on your account.'
                      : 'If you already have an account we will sign you in; if not, we will create one.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: FaseaColors.secondary,
                  ),
                ),
                const SizedBox(height: FaseaSpacing.md),
                if (!recover) ...[
                  OutlinedButton.icon(
                    onPressed: (loading || googleLoading)
                        ? null
                        : _signInWithGoogle,
                    icon: googleLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const GoogleLogoIcon(size: 20),
                    label: Text(
                      googleLoading ? 'Signing in…' : 'Continue with Google',
                    ),
                  ),
                  if (kIsWeb) ...[
                    const SizedBox(height: FaseaSpacing.sm),
                    OutlinedButton.icon(
                      onPressed: (loading || googleLoading)
                          ? null
                          : _signInWithApple,
                      icon: const Icon(Icons.apple, size: 20),
                      label: const Text('Continue with Apple'),
                    ),
                  ],
                  const SizedBox(height: FaseaSpacing.md),
                  Text(
                    'or continue with email',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: FaseaColors.secondary,
                    ),
                  ),
                  const SizedBox(height: FaseaSpacing.md),
                ],
                if (!recover)
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      hintText: 'youremail@mail.com',
                    ),
                  )
                else ...[
                  TextField(
                    controller: recoverName,
                    decoration: const InputDecoration(labelText: 'Name'),
                  ),
                  const SizedBox(height: FaseaSpacing.betweenFields),
                  TextField(
                    controller: recoverWhatsapp,
                    decoration: const InputDecoration(labelText: 'WhatsApp'),
                  ),
                ],
                if (error != null) ...[
                  const SizedBox(height: FaseaSpacing.betweenFields),
                  Text(error!, style: const TextStyle(color: FaseaColors.error)),
                ],
                const SizedBox(height: FaseaSpacing.md),
                FilledButton(
                  onPressed: loading ? null : submit,
                  child: Text(loading ? 'Please wait…' : 'Continue'),
                ),
                const SizedBox(height: FaseaSpacing.afterPrimaryButton),
                TextButton(
                  onPressed: () => setState(() => recover = !recover),
                  child: Text(recover ? 'Use email instead' : 'Find account'),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class CompleteNameScreen extends StatefulWidget {
  const CompleteNameScreen({
    super.key,
    required this.api,
    required this.onSaved,
    this.email,
  });
  final ApiClient api;
  final Future<void> Function() onSaved;
  final String? email;
  @override
  State<CompleteNameScreen> createState() => _CompleteNameScreenState();
}

class _CompleteNameScreenState extends State<CompleteNameScreen> {
  final name = TextEditingController();
  bool loading = false;
  String? error;

  Future<void> _save() async {
    final trimmed = name.text.trim();
    if (trimmed.isEmpty) {
      setState(() => error = 'Enter your name to continue.');
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await widget.api.saveName(trimmed);
      await widget.onSaved();
    } catch (e) {
      if (mounted) setState(() => error = formatApiError(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    child: Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            FaseaSpacing.lg,
            FaseaSpacing.md,
            FaseaSpacing.lg,
            FaseaSpacing.lg,
          ),
          children: [
            const Text(
              'Almost there',
              style: TextStyle(letterSpacing: 2, color: FaseaColors.primary),
            ),
            Text(
              'Your name',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: FaseaSpacing.afterHeadline),
            FaseaCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'We use this on bookings and messages. Please add it before continuing.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: FaseaColors.secondary,
                    ),
                  ),
                  if ((widget.email ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: FaseaSpacing.sm),
                    Text(
                      'Signed in as ${widget.email}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: FaseaColors.secondary,
                      ),
                    ),
                  ],
                  const SizedBox(height: FaseaSpacing.md),
                  TextField(
                    controller: name,
                    autofocus: true,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _save(),
                    decoration: const InputDecoration(labelText: 'Full name'),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: FaseaSpacing.sm),
                    Text(
                      error!,
                      style: const TextStyle(color: FaseaColors.error),
                    ),
                  ],
                  const SizedBox(height: FaseaSpacing.md),
                  FilledButton(
                    onPressed: loading ? null : _save,
                    child: Text(loading ? 'Saving…' : 'Continue'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class BookScreen extends StatefulWidget {
  const BookScreen({
    super.key,
    required this.api,
    required this.me,
    required this.onChanged,
  });
  final ApiClient api;
  final ClientMe me;
  final Future<void> Function() onChanged;
  @override
  State<BookScreen> createState() => _BookScreenState();
}

enum _BookStep { pick, confirm, success }

class _BookScreenState extends State<BookScreen> {
  List<ClassItem> items = [];
  List<Slot> slots = [];
  List<BookingLookup> upcomingBookings = [];
  Set<String> availableDateKeys = {};
  ClassItem? selectedItem;
  DateTime focused = DateTime.now();
  DateTime? selectedDay;
  String? selectedSlotId;
  String? errorMessage;
  String? successCode;
  _BookStep step = _BookStep.pick;
  bool loading = true;
  bool booking = false;
  late final PageController _pickPageController = PageController();
  int _pickPage = 0;

  @override
  void initState() {
    super.initState();
    _pickPageController.addListener(_syncPickPage);
    if ((widget.me.balance?.balance ?? 0) >= 1) {
      _loadItems();
      _loadUpcoming();
    }
  }

  @override
  void dispose() {
    _pickPageController.removeListener(_syncPickPage);
    _pickPageController.dispose();
    super.dispose();
  }

  void _syncPickPage() {
    final page = _pickPageController.page?.round() ?? 0;
    if (page != _pickPage && mounted) setState(() => _pickPage = page);
  }

  Future<void> _goToPickSlide(int page) async {
    if (!_pickPageController.hasClients) return;
    await _pickPageController.animateToPage(
      page,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOut,
    );
  }

  Slot? get _selectedSlot {
    final id = selectedSlotId;
    if (id == null) return null;
    for (final slot in slots) {
      if (slot.id == id) return slot;
    }
    return null;
  }

  Future<void> _loadItems() async {
    setState(() => loading = true);
    items = await widget.api.items();
    setState(() => loading = false);
  }

  Future<void> _selectClass(ClassItem item) async {
    setState(() {
      selectedItem = item;
      selectedDay = null;
      selectedSlotId = null;
      slots = [];
      availableDateKeys = {};
      errorMessage = null;
    });
    await _loadDates();
    if (mounted) await _goToPickSlide(1);
  }

  Future<void> _selectDay(DateTime day, DateTime focusedDay) async {
    setState(() {
      selectedDay = day;
      focused = focusedDay;
      selectedSlotId = null;
      errorMessage = null;
    });
    await _loadSlots(day);
    if (!mounted) return;
    if (slots.isNotEmpty) {
      await _goToPickSlide(2);
    }
  }

  Future<void> _loadUpcoming() async {
    try {
      final rows = await widget.api.myBookings();
      if (mounted) setState(() => upcomingBookings = rows);
    } catch (_) {
      if (mounted) setState(() => upcomingBookings = []);
    }
  }

  Future<void> _loadDates() async {
    final item = selectedItem;
    if (item == null) return;
    final start = DateTime(focused.year, focused.month, 1);
    final end = DateTime(focused.year, focused.month + 1, 0);
    final keys = await widget.api.availableDates(
      dateKey(start),
      dateKey(end),
      item.id,
    );
    setState(() => availableDateKeys = keys.toSet());
  }

  Future<void> _loadSlots(DateTime day) async {
    final item = selectedItem;
    if (item == null) return;
    final list = await widget.api.slots(dateKey(day), item.id);
    setState(() {
      slots = list;
      selectedSlotId = null;
      errorMessage = null;
    });
  }

  void _goToConfirm() {
    if (selectedSlotId == null || selectedDay == null) return;
    setState(() {
      step = _BookStep.confirm;
      errorMessage = null;
    });
  }

  Future<void> _submit() async {
    final client = widget.me.client;
    final slotId = selectedSlotId;
    if (client == null || slotId == null) return;
    setState(() {
      booking = true;
      errorMessage = null;
    });
    try {
      final code = await widget.api.book(
        slotId: slotId,
        name: client.name,
        email: client.email,
        whatsapp: client.whatsapp.isNotEmpty ? client.whatsapp : '+60123456789',
      );
      await widget.onChanged();
      await _loadUpcoming();
      setState(() {
        successCode = code;
        step = _BookStep.success;
      });
    } catch (e) {
      setState(() => errorMessage = formatApiError(e));
    } finally {
      if (mounted) setState(() => booking = false);
    }
  }

  void _resetAfterSuccess() {
    setState(() {
      step = _BookStep.pick;
      successCode = null;
      selectedItem = null;
      selectedDay = null;
      selectedSlotId = null;
      slots = [];
      availableDateKeys = {};
      errorMessage = null;
      _pickPage = 0;
    });
    if (_pickPageController.hasClients) {
      _pickPageController.jumpToPage(0);
    }
    _loadUpcoming();
  }

  Widget _pickSlideIndicator(BuildContext context) {
    const labels = ['Class', 'Date', 'Time'];
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0) const SizedBox(width: FaseaSpacing.sm),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i == _pickPage
                      ? FaseaColors.primary
                      : FaseaColors.border,
                ),
              ),
              const SizedBox(width: FaseaSpacing.xs),
              Text(
                labels[i],
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: i == _pickPage
                      ? FaseaColors.primary
                      : FaseaColors.secondary,
                  fontWeight:
                      i == _pickPage ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _stepIndicator(BuildContext context) {
    const labels = ['Choose', 'Confirm', 'Done'];
    final index = step.index;
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 1,
                color: i <= index ? FaseaColors.primary : FaseaColors.border,
              ),
            ),
          Column(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: i <= index
                    ? FaseaColors.primary
                    : FaseaColors.border,
                child: Text(
                  '${i + 1}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: i <= index
                        ? FaseaColors.onPrimary
                        : FaseaColors.secondary,
                  ),
                ),
              ),
              const SizedBox(height: FaseaSpacing.xs),
              Text(
                labels[i],
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: i == index
                      ? FaseaColors.primary
                      : FaseaColors.secondary,
                  fontWeight: i == index ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
          if (i < labels.length - 1)
            Expanded(
              child: Container(
                height: 1,
                color: i < index ? FaseaColors.primary : FaseaColors.border,
              ),
            ),
        ],
      ],
    );
  }

  Widget _upcomingSection(BuildContext context) {
    if (upcomingBookings.isEmpty) return const SizedBox.shrink();
    return FaseaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your bookings', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: FaseaSpacing.afterSectionTitle),
          for (var i = 0; i < upcomingBookings.length; i++) ...[
            if (i > 0) ...[
              const SizedBox(height: FaseaSpacing.md),
              const Divider(height: 1),
              const SizedBox(height: FaseaSpacing.md),
            ],
            Builder(
              builder: (context) {
                final b = upcomingBookings[i];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.className,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: FaseaSpacing.xs),
                    Text(
                      '${b.formattedDate()} · ${b.timeRange}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: FaseaSpacing.xs),
                    Text(
                      'Code ${b.code}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: FaseaColors.secondary,
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: FaseaSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: FaseaColors.secondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPickStep(BuildContext context) {
    final slideHeight = MediaQuery.sizeOf(context).height * 0.52;
    return ListView(
      padding: FaseaSpacing.screenPadding(),
      children: [
        Text('Book a class', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: FaseaSpacing.sm),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ScheduleScreen(
                    loadSchedule: ({
                      required fromDateKey,
                      required toDateKey,
                      itemId,
                    }) =>
                        widget.api.schedule(
                          fromDateKey: fromDateKey,
                          toDateKey: toDateKey,
                          itemId: itemId,
                        ),
                  ),
                ),
              );
            },
            icon: const Icon(Icons.calendar_view_month, size: 18),
            label: const Text('View schedule'),
          ),
        ),
        const SizedBox(height: FaseaSpacing.afterHeadline),
        _upcomingSection(context),
        if (upcomingBookings.isNotEmpty)
          const SizedBox(height: FaseaSpacing.betweenSections),
        FaseaCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _stepIndicator(context),
              const SizedBox(height: FaseaSpacing.sm),
              _pickSlideIndicator(context),
              const SizedBox(height: FaseaSpacing.md),
              SizedBox(
                height: slideHeight.clamp(360, 520),
                child: PageView(
                  controller: _pickPageController,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _buildClassSlide(context),
                    _buildDateSlide(context),
                    _buildTimeSlide(context),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildClassSlide(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Text(
          'Choose a class',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: FaseaSpacing.afterSectionTitle),
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: FaseaSpacing.md),
            child: LinearProgressIndicator(),
          )
        else if (items.isEmpty)
          Text(
            'No classes available right now.',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: FaseaSpacing.sm),
              child: Material(
                color: selectedItem?.id == item.id
                    ? FaseaColors.tonalButton.withValues(alpha: 0.45)
                    : FaseaColors.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(FaseaRadii.md),
                  side: const BorderSide(color: FaseaColors.border),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(FaseaRadii.md),
                  onTap: () => _selectClass(item),
                  child: Padding(
                    padding: const EdgeInsets.all(FaseaSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        if (item.description.trim().isNotEmpty) ...[
                          const SizedBox(height: FaseaSpacing.xs),
                          Text(
                            item.description,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildDateSlide(BuildContext context) {
    final item = selectedItem;
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Text('Pick a date', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: FaseaSpacing.xs),
        Text(
          item?.name ?? '',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: FaseaColors.secondary,
          ),
        ),
        const SizedBox(height: FaseaSpacing.sm),
        if (item == null)
          Text(
            'Choose a class first.',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final cell = ((constraints.maxWidth - 8) / 7).clamp(44.0, 56.0);
              return TableCalendar(
                firstDay: DateTime.now(),
                lastDay: DateTime.now().add(const Duration(days: 180)),
                focusedDay: focused,
                rowHeight: cell + 4,
                calendarStyle: buildFaseaCalendarStyle(
                  cellMargin: const EdgeInsets.all(2),
                ),
                headerStyle: buildFaseaCalendarHeaderStyle(),
                daysOfWeekStyle: buildFaseaDaysOfWeekStyle(),
                selectedDayPredicate: (d) =>
                    selectedDay != null && isSameDay(d, selectedDay),
                enabledDayPredicate: (d) =>
                    availableDateKeys.contains(dateKey(d)),
                onPageChanged: (d) async {
                  focused = d;
                  await _loadDates();
                },
                onDaySelected: (d, f) => _selectDay(d, f),
              );
            },
          ),
        if (selectedDay != null && slots.isEmpty) ...[
          const SizedBox(height: FaseaSpacing.sm),
          Text(
            'No sessions scheduled on this date.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ] else if (selectedDay != null &&
            slots.isNotEmpty &&
            slots.every((s) => !s.isSelectable)) ...[
          const SizedBox(height: FaseaSpacing.sm),
          Text(
            'No available class on this date.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        const SizedBox(height: FaseaSpacing.sm),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => _goToPickSlide(0),
            child: const Text('Change class'),
          ),
        ),
      ],
    );
  }

  Widget _buildTimeSlide(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Text(
          'Available times',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: FaseaSpacing.xs),
        Text(
          selectedDay == null
              ? ''
              : '${selectedItem?.name ?? ''} · ${DateFormat.yMMMd().format(selectedDay!)}',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: FaseaColors.secondary,
          ),
        ),
        const SizedBox(height: FaseaSpacing.afterSectionTitle),
        if (slots.isEmpty)
          Text(
            'No sessions scheduled on this date.',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else if (slots.every((s) => !s.isSelectable))
          Text(
            'No available class on this date.',
            style: Theme.of(context).textTheme.bodySmall,
          )
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: FaseaColors.border),
              borderRadius: BorderRadius.circular(FaseaRadii.md),
            ),
            child: Column(
              children: [
                for (var i = 0; i < slots.length; i++) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: FaseaSpacing.sm,
                      vertical: FaseaSpacing.xs,
                    ),
                    child: ListTile(
                      key: Key('book-slot-${slots[i].id}'),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: FaseaSpacing.md,
                        vertical: FaseaSpacing.sm,
                      ),
                      selected: selectedSlotId == slots[i].id,
                      selectedTileColor:
                          FaseaColors.tonalButton.withValues(alpha: 0.45),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(FaseaRadii.md),
                      ),
                      enabled: slots[i].isSelectable,
                      onTap: slots[i].isSelectable
                          ? () => setState(() => selectedSlotId = slots[i].id)
                          : null,
                      title: Text(
                        '${timeLabel(slots[i].startMin)} - ${timeLabel(slots[i].endMin)}',
                      ),
                      subtitle: Text(
                        spotsLeftLabel(slots[i].available),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      trailing: selectedSlotId == slots[i].id
                          ? const Icon(
                              Icons.check_circle,
                              color: FaseaColors.primary,
                            )
                          : null,
                    ),
                  ),
                  if (i < slots.length - 1)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: FaseaSpacing.md),
                      child: Divider(height: 1),
                    ),
                ],
              ],
            ),
          ),
        if (selectedSlotId != null)
          Padding(
            padding: const EdgeInsets.only(top: FaseaSpacing.sm),
            child: Text(
              'Tap Review to check your selection before booking.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: FaseaColors.secondary,
              ),
            ),
          ),
        const SizedBox(height: FaseaSpacing.md),
        FilledButton(
          onPressed: selectedSlotId == null ? null : _goToConfirm,
          child: const Text('Review booking'),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => _goToPickSlide(1),
            child: const Text('Change date'),
          ),
        ),
      ],
    );
  }

  Widget _buildConfirmStep(BuildContext context) {
    final item = selectedItem;
    final day = selectedDay;
    final slot = _selectedSlot;
    return ListView(
      padding: FaseaSpacing.screenPadding(),
      children: [
        Text('Book a class', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: FaseaSpacing.afterHeadline),
        FaseaCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _stepIndicator(context),
              const SizedBox(height: FaseaSpacing.md),
              Text(
                'Review your booking',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: FaseaSpacing.afterSectionTitle),
              _summaryRow(context, 'Class', item?.name ?? '—'),
              _summaryRow(
                context,
                'Date',
                day == null ? '—' : DateFormat.yMMMd().format(day),
              ),
              if (slot != null)
                _summaryRow(
                  context,
                  'Time',
                  '${timeLabel(slot.startMin)} – ${timeLabel(slot.endMin)}',
                ),
              _summaryRow(
                context,
                'Credits',
                '1 credit · ${widget.me.balance?.balance ?? 0} remaining',
              ),
              const SizedBox(height: FaseaSpacing.sm),
              Text(
                'We will send booking updates to your WhatsApp and email.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: FaseaColors.secondary,
                ),
              ),
              if (errorMessage != null) ...[
                const SizedBox(height: FaseaSpacing.sm),
                Text(
                  errorMessage!,
                  style: const TextStyle(color: FaseaColors.error),
                ),
              ],
              const SizedBox(height: FaseaSpacing.md),
              FilledButton(
                onPressed: booking ? null : _submit,
                style: FaseaButtons.filled(
                  backgroundColor: FaseaColors.primary,
                  foregroundColor: FaseaColors.onPrimary,
                ),
                child: Text(booking ? 'Booking…' : 'Confirm booking'),
              ),
              const SizedBox(height: FaseaSpacing.sm),
              TextButton(
                onPressed: booking
                    ? null
                    : () {
                        setState(() => step = _BookStep.pick);
                        _goToPickSlide(2);
                      },
                child: const Text('Back'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSuccessStep(BuildContext context) {
    return ListView(
      padding: FaseaSpacing.screenPadding(),
      children: [
        Text('Book a class', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: FaseaSpacing.afterHeadline),
        FaseaCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _stepIndicator(context),
              const SizedBox(height: FaseaSpacing.md),
              const Icon(
                Icons.check_circle,
                color: FaseaColors.primary,
                size: 48,
              ),
              const SizedBox(height: FaseaSpacing.md),
              Text(
                "You're booked",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: FaseaSpacing.sm),
              Text(
                'Save this code for check-in or changes.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: FaseaColors.secondary,
                ),
              ),
              const SizedBox(height: FaseaSpacing.md),
              Text(
                successCode ?? '',
                textAlign: TextAlign.center,
                style: FaseaTextStyles.bookingCode,
              ),
              const SizedBox(height: FaseaSpacing.sm),
              Text(
                'Updates will go to your WhatsApp and email.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: FaseaColors.secondary,
                ),
              ),
              const SizedBox(height: FaseaSpacing.md),
              FilledButton(
                onPressed: _resetAfterSuccess,
                child: const Text('Book another class'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if ((widget.me.balance?.balance ?? 0) < 1) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              FaseaSpacing.md,
              FaseaSpacing.md,
              FaseaSpacing.md,
              FaseaSpacing.sm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Book a class',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: FaseaSpacing.headlineToSubtitle),
                Text(
                  'You need credits before choosing a date and time.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: FaseaColors.secondary,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: MembershipScreen(
              api: widget.api,
              me: widget.me,
              onChanged: widget.onChanged,
              embeddedInBook: true,
            ),
          ),
        ],
      );
    }
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return switch (step) {
      _BookStep.pick => _buildPickStep(context),
      _BookStep.confirm => _buildConfirmStep(context),
      _BookStep.success => _buildSuccessStep(context),
    };
  }
}

class MembershipScreen extends StatelessWidget {
  const MembershipScreen({
    super.key,
    required this.api,
    required this.me,
    required this.onChanged,
    this.embeddedInBook = false,
  });
  final ApiClient api;
  final ClientMe me;
  final Future<void> Function() onChanged;
  final bool embeddedInBook;
  @override
  Widget build(BuildContext context) =>
      PlanPurchaseView(
        api: api,
        me: me,
        onChanged: onChanged,
        embeddedInBook: embeddedInBook,
      );
}

class PlanPurchaseView extends StatefulWidget {
  const PlanPurchaseView({
    super.key,
    required this.api,
    required this.me,
    required this.onChanged,
    this.embeddedInBook = false,
  });
  final ApiClient api;
  final ClientMe me;
  final Future<void> Function() onChanged;
  final bool embeddedInBook;
  @override
  State<PlanPurchaseView> createState() => _PlanPurchaseViewState();
}

class _PlanPurchaseViewState extends State<PlanPurchaseView> {
  late final Future<({List<Plan> plans, List<ClassItem> items})> _catalog =
      _loadCatalog();
  String? message;

  Future<({List<Plan> plans, List<ClassItem> items})> _loadCatalog() async {
    final results = await Future.wait([
      widget.api.plans(),
      widget.api.items(),
    ]);
    return (
      plans: results[0] as List<Plan>,
      items: results[1] as List<ClassItem>,
    );
  }

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<({List<Plan> plans, List<ClassItem> items})>(
        future: _catalog,
        builder: (context, snap) {
          final plans = snap.data?.plans ?? [];
          final items = snap.data?.items ?? [];
          final groups = groupPlans(plans);
          return ListView(
            padding: FaseaSpacing.screenPadding(embedded: widget.embeddedInBook),
            children: [
              if (!widget.embeddedInBook) ...[
                Text(
                  'Membership',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: FaseaSpacing.afterHeadline),
              ],
              AccountCreditCard(me: widget.me),
              if (snap.connectionState != ConnectionState.done)
                const LinearProgressIndicator(),
              if (message != null)
                Text(
                  message!,
                  style: const TextStyle(color: FaseaColors.primary),
                ),
              for (final entry in groups.entries) ...[
                Padding(
                  padding: const EdgeInsets.only(
                    top: FaseaSpacing.betweenSections,
                    bottom: FaseaSpacing.afterSectionTitle,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        planGroupTitle(entry.key),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: FaseaSpacing.xs),
                      Text(
                        'Valid for · ${formatUsableClassNames(items, entry.key)}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: FaseaColors.secondary,
                        ),
                      ),
                    ],
                  ),
                ),
                ...entry.value.map(
                  (plan) => PlanTile(
                    plan: plan,
                    usableClasses: planUsableClassNames(items, plan.category),
                    studentStatus: widget.me.client?.studentStatus,
                    onPay: () async {
                      try {
                        final url = await widget.api.createOrder(plan.id);
                        await launchUrl(
                          Uri.parse(url),
                          mode: LaunchMode.externalApplication,
                        );
                        await widget.onChanged();
                      } catch (e) {
                        setState(() => message = e.toString());
                      }
                    },
                  ),
                ),
              ],
            ],
          );
        },
      );
}

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  late Future<List<FaseaEvent>> future = widget.api.events();
  @override
  Widget build(BuildContext context) => FutureBuilder<List<FaseaEvent>>(
    future: future,
    builder: (context, snap) {
      final events = snap.data ?? [];
      return ListView(
        padding: FaseaSpacing.screenPadding(),
        children: [
          Text('Events', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: FaseaSpacing.afterHeadline),
          if (snap.connectionState != ConnectionState.done)
            const LinearProgressIndicator(),
          if (events.isEmpty && snap.connectionState == ConnectionState.done)
            FaseaCard(
              child: Text(
                'No active events yet.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: FaseaColors.secondary,
                ),
              ),
            ),
          ...events.map((event) => EventCard(event: event)),
        ],
      );
    },
  );
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({
    super.key,
    required this.api,
    required this.me,
    required this.adminAuthed,
    required this.onChanged,
    required this.onAdminChanged,
  });
  final ApiClient api;
  final ClientMe me;
  final bool adminAuthed;
  final Future<void> Function() onChanged;
  final ValueChanged<bool> onAdminChanged;
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final code = TextEditingController();
  final name = TextEditingController();
  final email = TextEditingController();
  final whatsapp = TextEditingController();
  final adminPassword = TextEditingController();
  List<BookingLookup> lookup = [];
  String? message;
  @override
  void initState() {
    super.initState();
    name.text = widget.me.client?.name ?? '';
    email.text = widget.me.client?.email ?? '';
    whatsapp.text = widget.me.client?.whatsapp ?? '';
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: FaseaSpacing.screenPadding(),
    children: [
      Text('Account', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: FaseaSpacing.afterHeadline),
      AccountCreditCard(me: widget.me),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Notifications',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: FaseaSpacing.sm),
            Text(
              'Booking confirmations and class reminders are sent to this device when notifications are allowed.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: FaseaColors.secondary,
              ),
            ),
            const SizedBox(height: FaseaSpacing.md),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Promotions & events'),
              subtitle: const Text('Optional studio updates on this device'),
              value: widget.me.client?.pushMarketingOptIn ?? true,
              onChanged: (v) async {
                await widget.api.setPushMarketingOptIn(v);
                await widget.onChanged();
              },
            ),
          ],
        ),
      ),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Booking check',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: FaseaSpacing.md),
            TextField(
              controller: code,
              decoration: const InputDecoration(labelText: 'Booking code'),
            ),
            const SizedBox(height: FaseaSpacing.betweenFields),
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: FaseaSpacing.betweenFields),
            TextField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: FaseaSpacing.betweenFields),
            TextField(
              controller: whatsapp,
              decoration: const InputDecoration(labelText: 'WhatsApp'),
            ),
            const SizedBox(height: FaseaSpacing.betweenFields),
            FilledButton(
              onPressed: () async {
                final rows = await widget.api.lookupBookings(
                  code: code.text,
                  name: name.text,
                  email: email.text,
                  whatsapp: whatsapp.text,
                );
                setState(() => lookup = rows);
              },
              child: const Text('Search'),
            ),
            if (lookup.isNotEmpty) ...[
              const SizedBox(height: FaseaSpacing.md),
              Text(
                'Results',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: FaseaSpacing.xs),
            ],
            ...lookup.map(
              (b) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${b.className} · ${b.code}'),
                subtitle: Text(
                  '${b.dateKey} ${timeLabel(b.startMin)} · ${b.status}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                trailing: b.status == 'confirmed'
                    ? TextButton(
                        onPressed: () async {
                          await widget.api.cancelBooking(
                            code: b.code,
                            email: email.text,
                            whatsapp: whatsapp.text,
                          );
                          setState(() => message = 'Booking cancelled');
                        },
                        child: const Text('Cancel'),
                      )
                    : null,
              ),
            ),
          ],
        ),
      ),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Staff access', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: FaseaSpacing.headlineToSubtitle),
            Text(
              widget.adminAuthed
                  ? 'Manage tab is enabled.'
                  : 'Enter admin password to manage plans/events.',
            ),
            if (!widget.adminAuthed) ...[
              const SizedBox(height: FaseaSpacing.md),
              TextField(
                controller: adminPassword,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Admin password'),
              ),
              const SizedBox(height: FaseaSpacing.betweenFields),
              FilledButton(
                onPressed: () async {
                  await widget.api.adminLogin(adminPassword.text);
                  widget.onAdminChanged(true);
                },
                child: const Text('Unlock Manage'),
              ),
            ],
            const SizedBox(height: FaseaSpacing.afterPrimaryButton),
            TextButton(
              onPressed: () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Sign out?'),
                    content: const Text(
                      'You can sign in again anytime with the same email.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Stay signed in'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Sign out'),
                      ),
                    ],
                  ),
                );
                if (confirmed != true || !context.mounted) return;
                try {
                  await signOutGoogle();
                } catch (_) {}
                await unregisterPushToken(
                  ({token}) => widget.api.unregisterPushToken(token: token),
                );
                await widget.api.logout();
                await widget.onChanged();
              },
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
      if (message != null) Text(message!),
    ],
  );
}

class ManageScreen extends StatefulWidget {
  const ManageScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<ManageScreen> createState() => _ManageScreenState();
}

class _ManageScreenState extends State<ManageScreen> {
  bool plansMode = true;
  @override
  Widget build(BuildContext context) => ListView(
    padding: FaseaSpacing.screenPadding(),
    children: [
      Text('Manage', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: FaseaSpacing.afterHeadline),
      SegmentedButton<bool>(
        segments: const [
          ButtonSegment(value: true, label: Text('Plans')),
          ButtonSegment(value: false, label: Text('Events')),
        ],
        selected: {plansMode},
        onSelectionChanged: (s) => setState(() => plansMode = s.first),
      ),
      const SizedBox(height: FaseaSpacing.afterSectionTitle),
      plansMode ? ManagePlans(api: widget.api) : ManageEvents(api: widget.api),
    ],
  );
}

class ManagePlans extends StatefulWidget {
  const ManagePlans({super.key, required this.api});
  final ApiClient api;
  @override
  State<ManagePlans> createState() => _ManagePlansState();
}

class _ManagePlansState extends State<ManagePlans> {
  late Future<List<Plan>> future = widget.api.adminPlans();
  @override
  Widget build(BuildContext context) => FutureBuilder<List<Plan>>(
    future: future,
    builder: (context, snap) {
      final plans = snap.data ?? [];
      return Column(
        children: [
          if (snap.connectionState != ConnectionState.done)
            const LinearProgressIndicator(),
          ...plans.map(
            (p) => FaseaCard(
              child: ListTile(
                title: Text(p.title),
                subtitle: Text(
                  '${p.category} · RM ${money(p.priceRm)} · ${p.classCount} credits',
                ),
                trailing: Switch(
                  value: p.active,
                  onChanged: (v) async {
                    await widget.api.patchPlan(p.id, {'active': v});
                    setState(() => future = widget.api.adminPlans());
                  },
                ),
              ),
            ),
          ),
          FilledButton(
            onPressed: () => showPlanDialog(
              context,
              widget.api,
            ).then((_) => setState(() => future = widget.api.adminPlans())),
            child: const Text('Add plan'),
          ),
        ],
      );
    },
  );
}

class ManageEvents extends StatefulWidget {
  const ManageEvents({super.key, required this.api});
  final ApiClient api;
  @override
  State<ManageEvents> createState() => _ManageEventsState();
}

class _ManageEventsState extends State<ManageEvents> {
  late Future<List<FaseaEvent>> future = widget.api.events(admin: true);
  @override
  Widget build(BuildContext context) => FutureBuilder<List<FaseaEvent>>(
    future: future,
    builder: (context, snap) {
      final events = snap.data ?? [];
      return Column(
        children: [
          if (snap.connectionState != ConnectionState.done)
            const LinearProgressIndicator(),
          ...events.map(
            (e) => FaseaCard(
              child: ListTile(
                title: Text(e.title),
                subtitle: Text(e.summary),
                trailing: Switch(
                  value: e.active,
                  onChanged: (v) async {
                    await widget.api.patchEvent(e.id, {'active': v});
                    setState(() => future = widget.api.events(admin: true));
                  },
                ),
              ),
            ),
          ),
          FilledButton(
            onPressed: () => showEventDialog(context, widget.api).then(
              (_) => setState(() => future = widget.api.events(admin: true)),
            ),
            child: const Text('Add event'),
          ),
        ],
      );
    },
  );
}

class FaseaCard extends StatelessWidget {
  const FaseaCard({super.key, required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: FaseaSpacing.sm),
    elevation: 0,
    clipBehavior: onTap != null ? Clip.antiAlias : Clip.none,
    color: FaseaColors.surface.withValues(alpha: .75),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(FaseaRadii.lg),
      side: const BorderSide(color: FaseaColors.border),
    ),
    child: onTap == null
        ? Padding(
            padding: const EdgeInsets.all(FaseaSpacing.gutter),
            child: child,
          )
        : InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(FaseaSpacing.gutter),
              child: child,
            ),
          ),
  );
}

class AccountCreditCard extends StatelessWidget {
  const AccountCreditCard({super.key, required this.me});
  final ClientMe me;
  @override
  Widget build(BuildContext context) {
    final balance = me.balance?.balance ?? 0;
    final nextExpiry = balance > 0 && me.balance?.expiringCredits.isNotEmpty == true
        ? me.balance!.expiringCredits.first.expiresAt
        : null;
    return FaseaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            me.client?.name ?? '',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(me.client?.email ?? ''),
          const SizedBox(height: FaseaSpacing.inCardBeforeEmphasis),
          Text(
            '${me.balance?.balance ?? 0} credits',
            style: FaseaTextStyles.credit,
          ),
          const SizedBox(height: FaseaSpacing.headlineToSubtitle),
          Text('Student: ${me.client?.studentStatus ?? 'none'}'),
          if (nextExpiry != null)
            Text('Next expiry: ${DateFormat.yMMMd().format(nextExpiry)}'),
        ],
      ),
    );
  }
}

class PlanTile extends StatelessWidget {
  const PlanTile({
    super.key,
    required this.plan,
    required this.usableClasses,
    required this.studentStatus,
    required this.onPay,
  });
  final Plan plan;
  final List<String> usableClasses;
  final String? studentStatus;
  final VoidCallback onPay;
  @override
  Widget build(BuildContext context) {
    final price = studentStatus == 'verified' && plan.studentPriceRm != null
        ? plan.studentPriceRm!
        : plan.priceRm;
    return FaseaCard(
      onTap: onPay,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(plan.displayTitle, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: FaseaSpacing.xs),
          Text(
            usableClasses.join(' · '),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: FaseaColors.secondary,
            ),
          ),
          const SizedBox(height: FaseaSpacing.xs),
          Text(
            '${plan.classCount} credits · ${plan.validityDays} days',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: FaseaSpacing.md),
          Text(
            'RM ${money(price)}',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 18,
              color: FaseaColors.tertiary,
            ),
          ),
        ],
      ),
    );
  }
}

class EventCard extends StatelessWidget {
  const EventCard({super.key, required this.event});
  final FaseaEvent event;
  @override
  Widget build(BuildContext context) => FaseaCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (event.imageUrl != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(FaseaRadii.md),
            child: Image.network(
              event.imageUrl!,
              height: 160,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: FaseaSpacing.sm),
        ],
        Text(event.title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: FaseaSpacing.headlineToSubtitle),
        Text(
          event.summary,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: FaseaColors.secondary,
          ),
        ),
        if (event.startsAt != null) ...[
          const SizedBox(height: FaseaSpacing.sm),
          Text(
            DateFormat.yMMMd().add_jm().format(event.startsAt!),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        if (event.location != null)
          Text(event.location!, style: Theme.of(context).textTheme.bodySmall),
        if (event.priceLabel != null)
          Text(event.priceLabel!, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: FaseaSpacing.md),
        FilledButton(
          onPressed: () {
            final msg = event.whatsappText?.trim().isNotEmpty == true
                ? event.whatsappText!
                : 'Hi Fasea, I would like to ask about ${event.title}.';
            launchUrl(
              Uri.parse(
                'https://wa.me/$studioPhone?text=${Uri.encodeComponent(msg)}',
              ),
              mode: LaunchMode.externalApplication,
            );
          },
          child: const Text('Ask via WhatsApp'),
        ),
      ],
    ),
  );
}

Future<void> showPlanDialog(BuildContext context, ApiClient api) async {
  final code = TextEditingController();
  final title = TextEditingController();
  final price = TextEditingController();
  final credits = TextEditingController(text: '1');
  String category = 'group_mat';
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Add plan'),
      content: SingleChildScrollView(
        child: Column(
          children: [
            TextField(
              controller: code,
              decoration: const InputDecoration(labelText: 'Code'),
            ),
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            DropdownButtonFormField(
              initialValue: category,
              items: const [
                DropdownMenuItem(value: 'group_mat', child: Text('Group Mat')),
                DropdownMenuItem(
                  value: 'mat_private',
                  child: Text('Mat Private'),
                ),
                DropdownMenuItem(
                  value: 'reformer_private',
                  child: Text('Reformer Private'),
                ),
                DropdownMenuItem(
                  value: 'pre_post_reformer',
                  child: Text('Pre & Post Reformer'),
                ),
                DropdownMenuItem(value: 'duet', child: Text('Duet')),
                DropdownMenuItem(
                  value: 'reformer_group',
                  child: Text('Reformer Group'),
                ),
              ],
              onChanged: (v) => category = v ?? category,
            ),
            TextField(
              controller: credits,
              decoration: const InputDecoration(labelText: 'Credits'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: price,
              decoration: const InputDecoration(labelText: 'Price RM'),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () async {
            await api.createPlan({
              'code': code.text,
              'title': title.text,
              'category': category,
              'classCount': int.tryParse(credits.text) ?? 1,
              'priceRm': double.tryParse(price.text) ?? 0,
              'validityDays': 30,
              'active': true,
              'sortOrder': 1000,
            });
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Create'),
        ),
      ],
    ),
  );
}

Future<void> showEventDialog(BuildContext context, ApiClient api) async {
  final title = TextEditingController();
  final summary = TextEditingController();
  final price = TextEditingController();
  await showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Add event'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: title,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          TextField(
            controller: summary,
            decoration: const InputDecoration(labelText: 'Summary'),
          ),
          TextField(
            controller: price,
            decoration: const InputDecoration(labelText: 'Price label'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () async {
            await api.createEvent({
              'title': title.text,
              'summary': summary.text,
              'priceLabel': price.text.isEmpty ? null : price.text,
              'active': true,
              'sortOrder': 1000,
            });
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Create'),
        ),
      ],
    ),
  );
}

Map<String, List<Plan>> groupPlans(List<Plan> plans) {
  const order = [
    'group_mat',
    'mat_private',
    'reformer_private',
    'pre_post_reformer',
    'duet',
    'reformer_group',
  ];
  final sorted = [...plans]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  return {
    for (final cat in order)
      if (sorted.any((p) => p.category == cat))
        cat: sorted.where((p) => p.category == cat).toList(),
  };
}

String planGroupTitle(String category) => switch (category) {
  'group_mat' => 'Group Mat Class',
  'mat_private' => 'Mat Private Class',
  'reformer_private' => 'Reformer Private Class',
  'pre_post_reformer' => 'Pre & Post Reformer Pilates',
  'duet' => 'Duet class',
  'reformer_group' => 'Reformer Group class',
  _ => category,
};

bool classItemMatchesPlanCategory(ClassItem item, String category) {
  final name = item.name.toLowerCase();
  return switch (category) {
    'group_mat' => name.contains('mat') && !name.contains('reformer') && !name.contains('private'),
    'mat_private' => name.contains('mat') && name.contains('private'),
    'reformer_private' =>
      name.contains('private') ||
          (name.contains('reformer') && !name.contains('group') && !name.contains('pre') && !name.contains('post')),
    'pre_post_reformer' =>
      name.contains('pre') || name.contains('post') || name.contains('prenatal') || name.contains('postnatal'),
    'duet' => name.contains('duet'),
    'reformer_group' => name.contains('reformer') && name.contains('group'),
    _ => false,
  };
}

List<String> planUsableClassNames(List<ClassItem> items, String category) {
  final names = items
      .where((item) => classItemMatchesPlanCategory(item, category))
      .map((item) => item.name)
      .toList();
  if (names.isNotEmpty) return names;
  return [planGroupTitle(category)];
}

String formatUsableClassNames(List<ClassItem> items, String category) =>
    planUsableClassNames(items, category).join(', ');
String dateKey(DateTime date) =>
    DateFormat('yyyy-MM-dd').format(DateTime(date.year, date.month, date.day));
String timeLabel(int minutes) =>
    DateFormat.jm().format(DateTime(2024, 1, 1, minutes ~/ 60, minutes % 60));
String money(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(2);
