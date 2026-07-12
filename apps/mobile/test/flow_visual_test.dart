import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fasea/main.dart';
import 'package:table_calendar/table_calendar.dart';

import 'book_flow_previews.dart';
import 'flow_mock_api.dart';
import 'golden_mobile.dart';

void main() {
  final api = FlowMockApi();
  final me = flowSampleMe();
  final meNoCredits = flowSampleMe(balance: 0);

  Future<void> golden(WidgetTester tester, String name, Widget child) async {
    await useGoldenMobileSurface(tester);
    await tester.pumpWidget(goldenMobileApp(child));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    await expectGoldenMobile(tester, 'goldens/flows/$name.png');
  }

  Future<void> goldenShell(WidgetTester tester, String name, Widget body, {int tab = 0}) async {
    await useGoldenMobileSurface(tester);
    await tester.pumpWidget(goldenMobileShell(body, tab: tab));
    await tester.pumpAndSettle(const Duration(seconds: 2));
    await expectGoldenMobile(tester, 'goldens/flows/$name.png');
  }

  group('auth flow', () {
    testWidgets('01 email sign-in', (tester) async {
      await golden(tester, 'auth_01_email', AuthScreen(api: api, onAuthed: () async {}));
    });

    testWidgets('02 recover account', (tester) async {
      await useGoldenMobileSurface(tester);
      await tester.pumpWidget(
        goldenMobileApp(AuthScreen(api: api, onAuthed: () async {})),
      );
      await tester.tap(find.text('Find account'));
      await tester.pumpAndSettle();
      await expectGoldenMobile(tester, 'goldens/flows/auth_02_recover.png');
    });
  });

  group('onboarding flow', () {
    testWidgets('complete name', (tester) async {
      await golden(tester, 'onboarding_name', CompleteNameScreen(api: api, onSaved: () async {}));
    });
  });

  group('book flow', () {
    testWidgets('00 no credits → membership upsell', (tester) async {
      await goldenShell(
        tester,
        'book_00_no_credits',
        BookScreen(api: api, me: meNoCredits, onChanged: () async {}),
        tab: 0,
      );
    });

    testWidgets('01 choose class', (tester) async {
      await goldenShell(
        tester,
        'book_01_calendar',
        BookScreen(api: api, me: me, onChanged: () async {}),
        tab: 0,
      );
    });

    testWidgets('02 class slide to calendar', (tester) async {
      await useGoldenMobileSurface(tester);
      await tester.pumpWidget(
        goldenMobileShell(BookScreen(api: api, me: me, onChanged: () async {}), tab: 0),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
      await tester.tap(find.text('Reformer Private').first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
      await expectGoldenMobile(tester, 'goldens/flows/book_02_slots.png');
    });

    testWidgets('03 slot selected + review', (tester) async {
      await goldenShell(
        tester,
        'book_03_slot_selected',
        bookFlowPreview(
          step: BookFlowPreviewStep.pick,
          pickSlide: BookFlowPreviewPickSlide.time,
          slotSelected: true,
        ),
        tab: 0,
      );
    });

    testWidgets('04 confirm booking', (tester) async {
      await goldenShell(
        tester,
        'book_04_confirm',
        bookFlowPreview(step: BookFlowPreviewStep.confirm),
        tab: 0,
      );
    });

    testWidgets('05 booking success', (tester) async {
      await goldenShell(
        tester,
        'book_05_success',
        bookFlowPreview(step: BookFlowPreviewStep.success),
        tab: 0,
      );
    });
  });

  group('membership flow', () {
    testWidgets('plans list', (tester) async {
      await goldenShell(
        tester,
        'membership_01_plans',
        MembershipScreen(api: api, me: me, onChanged: () async {}),
        tab: 1,
      );
    });
  });

  group('events flow', () {
    testWidgets('events list', (tester) async {
      await goldenShell(
        tester,
        'events_01_list',
        EventsScreen(api: api),
        tab: 2,
      );
    });
  });

  group('account flow', () {
    testWidgets('01 profile + lookup form', (tester) async {
      await goldenShell(
        tester,
        'account_01_form',
        AccountScreen(
          api: api,
          me: me,
          adminAuthed: false,
          onChanged: () async {},
          onAdminChanged: (_) {},
        ),
        tab: 3,
      );
    });

    testWidgets('02 lookup results', (tester) async {
      await goldenShell(
        tester,
        'account_02_lookup',
        accountLookupPreview(),
        tab: 3,
      );
    });
  });

  group('manage flow', () {
    testWidgets('plans admin', (tester) async {
      await goldenShell(tester, 'manage_01_plans', ManageScreen(api: api), tab: 0);
    });
  });
}
