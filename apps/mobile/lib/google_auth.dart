import 'package:google_sign_in/google_sign_in.dart';

/// Web OAuth client from Firebase / Google Cloud — required on Android for `idToken`.
const googleWebClientId =
    '1087823396336-juu2k20ste2mr5m6cgmbis3otrv4ou86.apps.googleusercontent.com';

final GoogleSignIn faseaGoogleSignIn = GoogleSignIn(
  scopes: const ['email', 'profile'],
  serverClientId: googleWebClientId,
);

/// Returns Google ID token, or `null` if the user cancelled.
Future<String?> signInWithGoogleIdToken() async {
  final account = await faseaGoogleSignIn.signIn();
  if (account == null) return null;
  final auth = await account.authentication;
  final token = auth.idToken;
  if (token == null || token.isEmpty) {
    throw Exception('Google did not return an ID token.');
  }
  return token;
}

Future<void> signOutGoogle() async {
  await faseaGoogleSignIn.signOut();
}
