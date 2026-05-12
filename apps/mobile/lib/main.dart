import 'dart:io' show Platform;

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart' show kDebugMode, kProfileMode;
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:url_launcher/url_launcher.dart';

/// Optional compile-time URL: `--dart-define=API_BASE_URL=https://...`
const String _kApiBaseUrlFromDefine = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: '',
);

/// Local Next.js (`yarn dev`, default port 3000). Android emulator → host loopback.
String _localApiBaseUrl() {
  if (Platform.isAndroid) return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

/// Base URL for API calls.
/// - **`--dart-define=API_BASE_URL=...`**: always wins (LAN IP on physical devices, staging, prod…).
/// - **Debug / profile** (`flutter run`, `flutter run --profile`): local Next (browser `localhost:3000`).
/// - **Release** (store builds): production host unless `API_BASE_URL` is set on the build.
///
/// Physical device debugging: use `--dart-define=API_BASE_URL=http://<host-LAN-IP>:3000`.
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

const studioPhone = '60145403560';

void main() => runApp(const FaseaApp());

class FaseaApp extends StatelessWidget {
  const FaseaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Faséa',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFAF8F6),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFA66A4A),
          primary: const Color(0xFFA66A4A),
          surface: Colors.white,
        ),
      ),
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
    final dir = await getApplicationSupportDirectory();
    final jar = PersistCookieJar(
      storage: FileStorage('${dir.path}/cookies'),
      ignoreExpires: true,
    );
    final base = resolveApiBaseUrl();
    await const FlutterSecureStorage().write(
      key: 'fasea_api_base_url',
      value: base,
    );
    final dio = Dio(BaseOptions(baseUrl: base));
    dio.interceptors.add(CookieManager(jar));
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

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() => loading = true);
    try {
      final next = await widget.api.me();
      final admin = await widget.api.adminMe().catchError((_) => false);
      setState(() {
        me = next;
        adminAuthed = admin;
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final current = me;
    if (current == null || !current.authed) {
      return AuthScreen(api: widget.api, onAuthed: refresh);
    }
    if ((current.client?.name ?? '').trim().isEmpty) {
      return CompleteNameScreen(api: widget.api, onSaved: refresh);
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
        title: const Text('Faséa', style: TextStyle(fontFamily: 'serif')),
        backgroundColor: const Color(0xFFFAF8F6),
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
}

Map<String, dynamic> asMap(dynamic value) =>
    Map<String, dynamic>.from(value as Map);
List<dynamic> asList(dynamic value) =>
    List<dynamic>.from(value as List? ?? const []);

class ClientMe {
  ClientMe({required this.authed, this.client, this.balance});
  final bool authed;
  final Client? client;
  final Balance? balance;
  factory ClientMe.fromJson(Map<String, dynamic> json) => ClientMe(
    authed: json['authed'] == true,
    client: json['client'] == null
        ? null
        : Client.fromJson(asMap(json['client'])),
    balance: json['balance'] == null
        ? null
        : Balance.fromJson(asMap(json['balance'])),
  );
  factory ClientMe.fromAuthData(Map<String, dynamic> json) => ClientMe(
    authed: true,
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
      studentStatus = '${json['studentStatus'] ?? 'none'}';
  final String id, name, email, whatsapp, studentStatus;
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
      isFull = json['isFull'] as bool? ?? true;
  final String id, dateKey;
  final int startMin, endMin, available;
  final bool isFull;
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
  const AuthScreen({super.key, required this.api, required this.onAuthed});
  final ApiClient api;
  final Future<void> Function() onAuthed;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController();
  final recoverName = TextEditingController();
  final recoverWhatsapp = TextEditingController();
  bool recover = false, loading = false;
  String? error;
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
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 32),
          const Text(
            'Welcome to',
            style: TextStyle(letterSpacing: 4, color: Color(0xFFA66A4A)),
          ),
          const Text(
            'Faséa',
            style: TextStyle(
              fontFamily: 'serif',
              fontSize: 42,
              fontWeight: FontWeight.w700,
            ),
          ),
          FaseaCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  recover ? 'Find your account' : 'Start with your email.',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  recover
                      ? 'Use the name and WhatsApp number saved on your account.'
                      : 'If you already have an account we will sign you in; if not, we will create one.',
                ),
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
                  TextField(
                    controller: recoverWhatsapp,
                    decoration: const InputDecoration(labelText: 'WhatsApp'),
                  ),
                ],
                if (error != null)
                  Text(error!, style: const TextStyle(color: Colors.red)),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: loading ? null : submit,
                  child: Text(loading ? 'Please wait…' : 'Continue'),
                ),
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
  });
  final ApiClient api;
  final Future<void> Function() onSaved;
  @override
  State<CompleteNameScreen> createState() => _CompleteNameScreenState();
}

class _CompleteNameScreenState extends State<CompleteNameScreen> {
  final name = TextEditingController();
  bool loading = false;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: FaseaCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Your name', style: Theme.of(context).textTheme.titleLarge),
              const Text('We use this on bookings and messages.'),
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Full name'),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: loading
                    ? null
                    : () async {
                        setState(() => loading = true);
                        await widget.api.saveName(name.text);
                        await widget.onSaved();
                      },
                child: const Text('Continue'),
              ),
            ],
          ),
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

class _BookScreenState extends State<BookScreen> {
  List<ClassItem> items = [];
  List<Slot> slots = [];
  Set<String> availableDateKeys = {};
  ClassItem? selectedItem;
  DateTime focused = DateTime.now();
  DateTime? selectedDay;
  String? selectedSlotId;
  String? message;
  bool loading = true;
  bool booking = false;
  @override
  void initState() {
    super.initState();
    if ((widget.me.balance?.balance ?? 0) >= 1) _loadItems();
  }

  Future<void> _loadItems() async {
    setState(() => loading = true);
    items = await widget.api.items();
    if (items.isNotEmpty) {
      selectedItem = items.first;
      await _loadDates();
    }
    setState(() => loading = false);
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
      slots = list.where((s) => !s.isFull).toList();
      selectedSlotId = null;
    });
  }

  Future<void> _submit() async {
    final client = widget.me.client;
    final slotId = selectedSlotId;
    if (client == null || slotId == null) return;
    setState(() => booking = true);
    try {
      final code = await widget.api.book(
        slotId: slotId,
        name: client.name,
        email: client.email,
        whatsapp: client.whatsapp.isNotEmpty ? client.whatsapp : '+60123456789',
      );
      await widget.onChanged();
      setState(() => message = 'Booking complete. Code: $code');
    } catch (e) {
      setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if ((widget.me.balance?.balance ?? 0) < 1) {
      return MembershipScreen(
        api: widget.api,
        me: widget.me,
        onChanged: widget.onChanged,
      );
    }
    if (loading) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Book a class', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: items
              .map(
                (item) => ChoiceChip(
                  label: Text(item.name),
                  selected: selectedItem?.id == item.id,
                  onSelected: (_) async {
                    setState(() {
                      selectedItem = item;
                      selectedDay = null;
                      slots = [];
                    });
                    await _loadDates();
                  },
                ),
              )
              .toList(),
        ),
        FaseaCard(
          child: TableCalendar(
            firstDay: DateTime.now(),
            lastDay: DateTime.now().add(const Duration(days: 180)),
            focusedDay: focused,
            selectedDayPredicate: (d) =>
                selectedDay != null && isSameDay(d, selectedDay),
            enabledDayPredicate: (d) => availableDateKeys.contains(dateKey(d)),
            onPageChanged: (d) async {
              focused = d;
              await _loadDates();
            },
            onDaySelected: (d, f) async {
              setState(() {
                selectedDay = d;
                focused = f;
              });
              await _loadSlots(d);
            },
          ),
        ),
        ...slots.map(
          (slot) => ListTile(
            selected: selectedSlotId == slot.id,
            selectedTileColor: const Color(0xFFE8DDD4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            onTap: () => setState(() => selectedSlotId = slot.id),
            title: Text(
              '${timeLabel(slot.startMin)} - ${timeLabel(slot.endMin)}',
            ),
            subtitle: Text('${slot.available} spots left'),
            trailing: selectedSlotId == slot.id
                ? const Icon(Icons.check_circle)
                : null,
          ),
        ),
        if (message != null)
          Text(message!, style: const TextStyle(color: Color(0xFFA66A4A))),
        FilledButton(
          onPressed: booking || selectedSlotId == null ? null : _submit,
          child: Text(booking ? 'Submitting…' : 'Submit booking'),
        ),
      ],
    );
  }
}

class MembershipScreen extends StatelessWidget {
  const MembershipScreen({
    super.key,
    required this.api,
    required this.me,
    required this.onChanged,
  });
  final ApiClient api;
  final ClientMe me;
  final Future<void> Function() onChanged;
  @override
  Widget build(BuildContext context) =>
      PlanPurchaseView(api: api, me: me, onChanged: onChanged);
}

class PlanPurchaseView extends StatefulWidget {
  const PlanPurchaseView({
    super.key,
    required this.api,
    required this.me,
    required this.onChanged,
  });
  final ApiClient api;
  final ClientMe me;
  final Future<void> Function() onChanged;
  @override
  State<PlanPurchaseView> createState() => _PlanPurchaseViewState();
}

class _PlanPurchaseViewState extends State<PlanPurchaseView> {
  late Future<List<Plan>> future = widget.api.plans();
  String? message;
  @override
  Widget build(BuildContext context) => FutureBuilder<List<Plan>>(
    future: future,
    builder: (context, snap) {
      final groups = groupPlans(snap.data ?? []);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Membership', style: Theme.of(context).textTheme.headlineMedium),
          AccountCreditCard(me: widget.me),
          if (snap.connectionState != ConnectionState.done)
            const LinearProgressIndicator(),
          if (message != null)
            Text(message!, style: const TextStyle(color: Color(0xFFA66A4A))),
          for (final entry in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.only(top: 20, bottom: 8),
              child: Text(
                planGroupTitle(entry.key),
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            ...entry.value.map(
              (plan) => PlanTile(
                plan: plan,
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
        padding: const EdgeInsets.all(16),
        children: [
          Text('Events', style: Theme.of(context).textTheme.headlineMedium),
          if (snap.connectionState != ConnectionState.done)
            const LinearProgressIndicator(),
          if (events.isEmpty && snap.connectionState == ConnectionState.done)
            const Text('No active events yet.'),
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
    padding: const EdgeInsets.all(16),
    children: [
      Text('Account', style: Theme.of(context).textTheme.headlineMedium),
      AccountCreditCard(me: widget.me),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Booking check',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            TextField(
              controller: code,
              decoration: const InputDecoration(labelText: 'Booking code'),
            ),
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: email,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            TextField(
              controller: whatsapp,
              decoration: const InputDecoration(labelText: 'WhatsApp'),
            ),
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
            ...lookup.map(
              (b) => ListTile(
                title: Text('${b.className} · ${b.code}'),
                subtitle: Text(
                  '${b.dateKey} ${timeLabel(b.startMin)} · ${b.status}',
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
            Text(
              widget.adminAuthed
                  ? 'Manage tab is enabled.'
                  : 'Enter admin password to manage plans/events.',
            ),
            if (!widget.adminAuthed)
              TextField(
                controller: adminPassword,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Admin password'),
              ),
            if (!widget.adminAuthed)
              FilledButton(
                onPressed: () async {
                  await widget.api.adminLogin(adminPassword.text);
                  widget.onAdminChanged(true);
                },
                child: const Text('Unlock Manage'),
              ),
            TextButton(
              onPressed: () async {
                await widget.api.logout();
                await widget.onChanged();
              },
              child: const Text('Log out'),
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
    padding: const EdgeInsets.all(16),
    children: [
      Text('Manage', style: Theme.of(context).textTheme.headlineMedium),
      SegmentedButton<bool>(
        segments: const [
          ButtonSegment(value: true, label: Text('Plans')),
          ButtonSegment(value: false, label: Text('Events')),
        ],
        selected: {plansMode},
        onSelectionChanged: (s) => setState(() => plansMode = s.first),
      ),
      const SizedBox(height: 12),
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
  const FaseaCard({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: 8),
    elevation: 0,
    color: Colors.white.withValues(alpha: .75),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(24),
      side: const BorderSide(color: Color(0xFFE8DDD4)),
    ),
    child: Padding(padding: const EdgeInsets.all(18), child: child),
  );
}

class AccountCreditCard extends StatelessWidget {
  const AccountCreditCard({super.key, required this.me});
  final ClientMe me;
  @override
  Widget build(BuildContext context) {
    final nextExpiry = me.balance?.expiringCredits.isNotEmpty == true
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
          const SizedBox(height: 12),
          Text(
            '${me.balance?.balance ?? 0} credits',
            style: const TextStyle(
              fontFamily: 'serif',
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
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
    required this.studentStatus,
    required this.onPay,
  });
  final Plan plan;
  final String? studentStatus;
  final VoidCallback onPay;
  @override
  Widget build(BuildContext context) {
    final price = studentStatus == 'verified' && plan.studentPriceRm != null
        ? plan.studentPriceRm!
        : plan.priceRm;
    return FaseaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(plan.displayTitle, style: Theme.of(context).textTheme.titleLarge),
          Text('${plan.classCount} credits · ${plan.validityDays} days'),
          Row(
            children: [
              Expanded(
                child: Text(
                  'RM ${money(price)}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              FilledButton(
                onPressed: onPay,
                child: const Text('Pay via WhatsApp'),
              ),
            ],
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (event.imageUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.network(
              event.imageUrl!,
              height: 160,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
        Text(event.title, style: Theme.of(context).textTheme.titleLarge),
        Text(event.summary),
        if (event.startsAt != null)
          Text(DateFormat.yMMMd().add_jm().format(event.startsAt!)),
        if (event.location != null) Text(event.location!),
        if (event.priceLabel != null) Text(event.priceLabel!),
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
                  value: 'reformer_private',
                  child: Text('Reformer Private'),
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
  const order = ['group_mat', 'reformer_private', 'duet', 'reformer_group'];
  final sorted = [...plans]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  return {
    for (final cat in order)
      if (sorted.any((p) => p.category == cat))
        cat: sorted.where((p) => p.category == cat).toList(),
  };
}

String planGroupTitle(String category) => switch (category) {
  'group_mat' => 'Group Mat Class',
  'reformer_private' => 'Reformer Private Class',
  'duet' => 'Duet class',
  'reformer_group' => 'Reformer Group class',
  _ => category,
};
String dateKey(DateTime date) =>
    DateFormat('yyyy-MM-dd').format(DateTime(date.year, date.month, date.day));
String timeLabel(int minutes) =>
    DateFormat.jm().format(DateTime(2024, 1, 1, minutes ~/ 60, minutes % 60));
String money(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(2);
