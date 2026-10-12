import 'package:google_sign_in/google_sign_in.dart';
import 'package:googleapis/drive/v3.dart' as drive;
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

  Future<auth.AuthClient?> getAuthClient({bool forceRefresh = false}) async {
    try {
      if (forceRefresh || _googleSignIn.currentUser != null) {
        final account = await _googleSignIn.signInSilently();
        if (account != null) {
          // Calling authentication forces native token refresh if expired
          await account.authentication;
        }
      }
      final client = await _googleSignIn.authenticatedClient();
      return client;
    } catch (e) {
      print('Error getting auth client: $e');
      return null;
    }
  }

  /// Mengambil kredensial OAuth2 lengkap (termasuk accessToken data yang valid untuk Android)
  Future<Map<String, dynamic>> getOAuthCredentials({bool forceRefresh = false}) async {
    try {
      final client = await getAuthClient(forceRefresh: forceRefresh);
      final account = _googleSignIn.currentUser;
      final auth = await account?.authentication;

      String? accessToken = client?.credentials.accessToken.data;
      DateTime? expiry = client?.credentials.accessToken.expiry;
      String? refreshToken = client?.credentials.refreshToken;
      String? idToken = auth?.idToken;
      String? serverAuthCode = account?.serverAuthCode ?? auth?.serverAuthCode;

      return {
        'accessToken': accessToken ?? '',
        'idToken': idToken ?? '',
        'serverAuthCode': serverAuthCode ?? '',
        'refreshToken': refreshToken ?? '',
        'expiresAt': expiry != null
            ? (expiry.millisecondsSinceEpoch ~/ 1000)
            : (DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600),
      };
    } catch (e) {
      print('Error getting OAuth credentials: $e');
      return {};
    }
  }
}
