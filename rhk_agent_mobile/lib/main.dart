import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'config/app_theme.dart';
import 'providers/theme_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/report_provider.dart';
import 'providers/form_provider.dart';
import 'providers/kpm_provider.dart';
import 'providers/pengaduan_provider.dart';
import 'providers/nota_dinas_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/report/create_report_screen.dart';
import 'screens/report/narrative_screen.dart';
import 'screens/settings/subscription_screen.dart';
import 'services/notification_service.dart';
import 'services/ad_service.dart';
import 'services/subscription_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize date formatting for Indonesian locale
  await initializeDateFormatting('id_ID', null);

  // Set status bar style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  // Lock orientation to portrait
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize notification service
  try {
    await NotificationService().init();
  } catch (e) {
    debugPrint('Notification init error: $e');
  }

  // Initialize Subscription Service
  try {
    await SubscriptionService.instance.init();
  } catch (e) {
    debugPrint('Subscription init error: $e');
  }

  // Initialize Google Mobile Ads SDK
  try {
    await AdService.instance.init();
  } catch (e) {
    debugPrint('AdMob init error: $e');
  }

  runApp(const AspendApp());
}

class AspendApp extends StatelessWidget {
  const AspendApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProxyProvider<AuthProvider, ReportProvider>(
          create: (_) => ReportProvider(),
          update: (_, auth, previous) {
            previous?.updateAuth(auth);
            return previous ?? ReportProvider();
          },
        ),
        ChangeNotifierProxyProvider<AuthProvider, FormProvider>(
          create: (_) => FormProvider(),
          update: (_, auth, previous) {
            previous?.updateAuth(auth);
            return previous ?? FormProvider();
          },
        ),
        ChangeNotifierProxyProvider<AuthProvider, KpmProvider>(
          create: (_) => KpmProvider(),
          update: (_, auth, previous) {
            previous?.updateAuth(auth);
            return previous ?? KpmProvider();
          },
        ),
        ChangeNotifierProxyProvider<AuthProvider, PengaduanProvider>(
          create: (_) => PengaduanProvider(),
          update: (_, auth, previous) {
            previous?.updateAuth(auth);
            return previous ?? PengaduanProvider();
          },
        ),
        ChangeNotifierProxyProvider<AuthProvider, NotaDinasProvider>(
          create: (_) => NotaDinasProvider(),
          update: (_, auth, previous) {
            previous?.updateAuth(auth);
            return previous ?? NotaDinasProvider();
          },
        ),
      ],
      child: Builder(
        builder: (context) {
          final themeProvider = context.watch<ThemeProvider>();
          return MaterialApp(
            title: 'Asisten Pendamping (Aspend)',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('id'),
              Locale('id', 'ID'),
              Locale('en'),
              Locale('en', 'US'),
            ],
            initialRoute: '/',
            routes: {
              '/': (context) => const SplashScreen(),
              '/login': (context) => const LoginScreen(),
              '/home': (context) => const HomeScreen(),
              '/create-report': (context) => const CreateReportScreen(),
              '/narrative': (context) => const NarrativeScreen(),
              '/subscription': (context) => const SubscriptionScreen(),
            },
            builder: (context, child) {
              // Daftarkan context ke AdService agar dialog Premium bisa muncul
              AdService.instance.setContext(context);
              return child ?? const SizedBox.shrink();
            },
          );
        }
      ),
    );
  }
}
