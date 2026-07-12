import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fasea/fasea_design_system.dart';
import 'package:fasea/main.dart';

import 'golden_mobile.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final noopApi = ApiClient(Dio(BaseOptions(baseUrl: 'http://localhost:4819')));

  final sampleMe = ClientMe(
    authed: true,
    client: Client.fromJson({
      'id': '1',
      'name': 'Minjae Kim',
      'email': 'minjae@fasea.test',
      'whatsapp': '+60123456789',
      'studentStatus': 'verified',
    }),
    balance: Balance.fromJson({
      'balance': 3,
      'expiringCredits': [
        {'amount': 1, 'expiresAt': '2026-08-01T00:00:00.000Z'},
      ],
    }),
  );

  final samplePlan = Plan.fromJson({
    'id': 'p1',
    'code': 'starter',
    'title': 'Starter Pack',
    'cardTitle': '5-Class Pack',
    'category': 'pack',
    'sortOrder': 1,
    'classCount': 5,
    'priceRm': 280,
    'studentPriceRm': 250,
    'validityDays': 60,
    'active': true,
  });

  final sampleEvent = FaseaEvent.fromJson({
    'id': 'e1',
    'title': 'Summer Workshop',
    'summary': 'A calm afternoon session for all levels.',
    'description': 'Details here',
    'startsAt': '2026-07-15T10:00:00.000Z',
    'location': 'Faséa Studio',
    'priceLabel': 'RM 45',
    'active': true,
    'sortOrder': 1,
  });

  Future<void> golden(WidgetTester tester, String name, Widget child) async {
    await useGoldenMobileSurface(tester);
    await tester.pumpWidget(goldenMobileApp(child));
    await tester.pumpAndSettle();
    await expectGoldenMobile(tester, 'goldens/$name.png');
  }

  testWidgets('auth screen', (tester) async {
    await golden(
      tester,
      'auth',
      AuthScreen(api: noopApi, onAuthed: () async {}),
    );
  });

  testWidgets('complete name screen', (tester) async {
    await golden(
      tester,
      'complete_name',
      CompleteNameScreen(api: noopApi, onSaved: () async {}),
    );
  });

  testWidgets('account credit card', (tester) async {
    await golden(
      tester,
      'account_credit',
      Scaffold(
        body: ListView(
          padding: const EdgeInsets.all(FaseaSpacing.md),
          children: [AccountCreditCard(me: sampleMe)],
        ),
      ),
    );
  });

  testWidgets('plan tile', (tester) async {
    await golden(
      tester,
      'plan_tile',
      Scaffold(
        body: ListView(
          padding: const EdgeInsets.all(FaseaSpacing.md),
          children: [
            PlanTile(
              plan: samplePlan,
              usableClasses: const ['Group Mat'],
              studentStatus: 'verified',
              onPay: () {},
            ),
          ],
        ),
      ),
    );
  });

  testWidgets('event card', (tester) async {
    await golden(
      tester,
      'event_card',
      Scaffold(
        body: ListView(
          padding: const EdgeInsets.all(FaseaSpacing.md),
          children: [EventCard(event: sampleEvent)],
        ),
      ),
    );
  });

  testWidgets('account screen', (tester) async {
    await golden(
      tester,
      'account',
      AccountScreen(
        api: noopApi,
        me: sampleMe,
        adminAuthed: false,
        onChanged: () async {},
        onAdminChanged: (_) {},
      ),
    );
  });

  testWidgets('manage segmented', (tester) async {
    await golden(
      tester,
      'manage_header',
      Scaffold(
        body: ListView(
          padding: const EdgeInsets.all(FaseaSpacing.md),
          children: [
            Text('Manage', style: buildFaseaTheme().textTheme.headlineMedium),
            const SizedBox(height: FaseaSpacing.sm),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('Plans')),
                ButtonSegment(value: false, label: Text('Events')),
              ],
              selected: const {true},
              onSelectionChanged: (_) {},
            ),
          ],
        ),
      ),
    );
  });
}
