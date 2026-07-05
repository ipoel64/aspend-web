import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/drive/v3.dart' as drive;
import 'package:googleapis/sheets/v4.dart' as sheets;
import 'package:extension_google_sign_in_as_googleapis_auth/extension_google_sign_in_as_googleapis_auth.dart';
import 'package:googleapis_auth/googleapis_auth.dart' as auth;

class AuthService {
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: '347823247350-cgre13fmjqu5rkuvs3ffqm3238u23shh.apps.googleusercontent.com',
    scopes: [
      'email',
      'profile',
      drive.DriveApi.driveFileScope,
    ],
  );

  GoogleSignInAccount? get currentUser => _googleSignIn.currentUser;

  Future<GoogleSignInAccount?> signIn() async {
    try {
      final account = await _googleSignIn.signIn();
      return account;
    } catch (error) {
      print('Error during sign in: $error');
      return null;
    }
  }

  Future<GoogleSignInAccount?> signInSilently() async {
    try {
      final account = await _googleSignIn.signInSilently();
      return account;
    } catch (error) {
      print('Error during silent sign in: $error');
      return null;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.disconnect();
  }

  Future<bool> isSignedIn() async {
    return await _googleSignIn.isSignedIn();
  }

  Future<auth.AuthClient?> getAuthClient() async {
    try {
      // Coba segarkan token terlebih dahulu agar tidak invalid_token (expired)
      await _googleSignIn.signInSilently();
      final client = await _googleSignIn.authenticatedClient();
      return client;
    } catch (e) {
      print('Error getting auth client: $e');
      return null;
    }
  }
}
