import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fasea/fasea_design_system.dart';

/// iPhone 14/15 portrait — logical px used for all flow goldens.
const Size kGoldenMobileSize = Size(390, 844);
const double kGoldenDevicePixelRatio = 3;

/// Safe-area insets approximating a notched phone in portrait.
const EdgeInsets kGoldenMobilePadding = EdgeInsets.only(top: 47, bottom: 34);

/// Locks the test render surface to [kGoldenMobileSize] so PNGs are phone-shaped.
Future<void> useGoldenMobileSurface(WidgetTester tester) async {
  tester.view.devicePixelRatio = kGoldenDevicePixelRatio;
  tester.view.physicalSize = Size(
    kGoldenMobileSize.width * kGoldenDevicePixelRatio,
    kGoldenMobileSize.height * kGoldenDevicePixelRatio,
  );
  addTearDown(() {
    tester.view.resetDevicePixelRatio();
    tester.view.resetPhysicalSize();
  });
}

MediaQueryData get goldenMobileMediaQuery => const MediaQueryData(
  size: kGoldenMobileSize,
  devicePixelRatio: kGoldenDevicePixelRatio,
  padding: kGoldenMobilePadding,
);

Widget goldenMobileApp(Widget child) => MaterialApp(
  theme: buildFaseaTheme(),
  debugShowCheckedModeBanner: false,
  home: MediaQuery(
    data: goldenMobileMediaQuery,
    child: SizedBox(
      width: kGoldenMobileSize.width,
      height: kGoldenMobileSize.height,
      child: child,
    ),
  ),
);

/// App shell with bottom nav — mobile viewport.
Widget goldenMobileShell(Widget body, {int tab = 0}) => goldenMobileApp(
  Scaffold(
    appBar: AppBar(
      title: const Text('Faséa', style: TextStyle(fontFamily: FaseaFonts.serif)),
    ),
    body: body,
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (_) {},
      destinations: const [
        NavigationDestination(icon: Icon(Icons.calendar_month), label: 'Book'),
        NavigationDestination(
          icon: Icon(Icons.card_membership),
          label: 'Membership',
        ),
        NavigationDestination(icon: Icon(Icons.local_activity), label: 'Events'),
        NavigationDestination(icon: Icon(Icons.person), label: 'Account'),
      ],
    ),
  ),
);

Future<void> expectGoldenMobile(
  WidgetTester tester,
  String goldenPath,
) async {
  await expectLater(
    find.byType(SizedBox).first,
    matchesGoldenFile(goldenPath),
  );
}
