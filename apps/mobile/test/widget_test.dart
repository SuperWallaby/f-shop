import 'package:flutter_test/flutter_test.dart';

import 'package:fasea/main.dart';

void main() {
  testWidgets('Faséa app starts', (WidgetTester tester) async {
    await tester.pumpWidget(const FaseaApp());
    await tester.pump();
    expect(find.byType(AppBootstrap), findsOneWidget);
  });
}
