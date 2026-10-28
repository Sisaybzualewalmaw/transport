import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';

import 'package:et_trans_passenger/main.dart';

void main() {
  testWidgets('renders sign-in fields and validates required input', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AuthScreen(
          onSignedIn: (token, name, userId) async {},
        ),
      ),
    );

    expect(find.text('Welcome to ET-Trans'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Use 09xxxxxxxx or +2519xxxxxxxx.'), findsOneWidget);
    expect(find.text('Password must contain at least 8 characters.'), findsOneWidget);
  });

  testWidgets('opens the passenger registration form', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AuthScreen(
          onSignedIn: (token, name, userId) async {},
        ),
      ),
    );

    await tester.tap(find.text('New passenger? Create account'));
    await tester.pumpAndSettle();

    expect(find.text('Create passenger account'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(3));
  });
}
