import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
  
  static const String prefHourKey = 'notification_hour';
  static const String prefMinuteKey = 'notification_minute';
  static const String prefEnabledKey = 'notification_enabled';
  static const int defaultHour = 16;
  static const int defaultMinute = 5;

  Future<void> init() async {
    tz.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation('Asia/Jakarta'));
    } catch (_) {}

    const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
    
    // For iOS if needed later
    const DarwinInitializationSettings initializationSettingsIOS = DarwinInitializationSettings(
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );
    
    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );
    
    await flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap -> Buka Asisten Pintar
        navigatorKey.currentState?.pushNamed('/jarvis');
      },
    );

    // Create Notification Channel for Android 8.0+ & Request permissions for Android 13+
    final androidImplementation = flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidImplementation != null) {
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'daily_reminder_channel_v3',
        'Pengingat Harian Asisten Pintar',
        description: 'Pengingat harian untuk membuat laporan RHK bersama Asisten Pintar',
        importance: Importance.max,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('jarvis_reminder'),
        enableVibration: true,
      );
      await androidImplementation.createNotificationChannel(channel);
      await androidImplementation.requestNotificationsPermission();
      try {
        await androidImplementation.requestExactAlarmsPermission();
      } catch (_) {}
    }

    // Schedule notification based on saved preference or default
    await scheduleDailyNotification();
  }

  /// Request runtime permissions for Android 13+ (POST_NOTIFICATIONS) and Android 12+ (EXACT_ALARM)
  Future<bool?> requestPermissions() async {
    final androidImplementation = flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (androidImplementation != null) {
      final granted = await androidImplementation.requestNotificationsPermission();
      try {
        await androidImplementation.requestExactAlarmsPermission();
      } catch (_) {}
      return granted;
    }
    return null;
  }

  Future<void> showTestNotification() async {
    const androidDetails = AndroidNotificationDetails(
      'daily_reminder_channel_v3',
      'Pengingat Harian Asisten Pintar',
      channelDescription: 'Pengingat harian untuk membuat laporan RHK bersama Asisten Pintar',
      importance: Importance.max,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
      sound: RawResourceAndroidNotificationSound('jarvis_reminder'),
      playSound: true,
      enableVibration: true,
    );

    final details = const NotificationDetails(android: androidDetails);
    await flutterLocalNotificationsPlugin.show(
      999,
      'Pengingat Laporan RHK 🤖 (Asisten Pintar)',
      'Waktunya membuat laporan RHK bersama Asisten Pintar! Ketuk untuk memulai.',
      details,
      payload: 'jarvis',
    );
  }

  Future<void> scheduleDailyNotification({int? hour, int? minute, bool? enabled}) async {
    final prefs = await SharedPreferences.getInstance();
    
    // Save new configuration if provided
    if (hour != null && minute != null) {
      await prefs.setInt(prefHourKey, hour);
      await prefs.setInt(prefMinuteKey, minute);
    }
    if (enabled != null) {
      await prefs.setBool(prefEnabledKey, enabled);
    }
    
    // Get configuration from prefs
    final isEnabled = prefs.getBool(prefEnabledKey) ?? true;
    final scheduledHour = prefs.getInt(prefHourKey) ?? defaultHour;
    final scheduledMinute = prefs.getInt(prefMinuteKey) ?? defaultMinute;

    // Cancel existing scheduled notifications
    await flutterLocalNotificationsPlugin.cancelAll();

    if (!isEnabled) {
      return; // Do not schedule any new notifications if disabled
    }

    const androidDetails = AndroidNotificationDetails(
      'daily_reminder_channel_v3',
      'Pengingat Harian Asisten Pintar',
      channelDescription: 'Pengingat harian untuk membuat laporan RHK bersama Asisten Pintar',
      importance: Importance.max,
      priority: Priority.max,
      icon: '@mipmap/ic_launcher',
      sound: RawResourceAndroidNotificationSound('jarvis_reminder'),
      playSound: true,
      enableVibration: true,
      visibility: NotificationVisibility.public,
    );

    final details = const NotificationDetails(android: androidDetails);

    // Schedule for Monday to Friday (1 to 5)
    for (int i = 1; i <= 5; i++) {
      final scheduledDate = _nextInstanceOfWeekdayTime(i, scheduledHour, scheduledMinute);
      try {
        await flutterLocalNotificationsPlugin.zonedSchedule(
          i, // Unique ID per day
          'Pengingat Laporan RHK 🤖',
          'Waktunya membuat laporan RHK hari ini bersama Asisten Pintar.',
          scheduledDate,
          details,
          payload: 'jarvis',
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
          matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
        );
      } catch (e) {
        // Fallback to inexact if exact is not permitted
        await flutterLocalNotificationsPlugin.zonedSchedule(
          i,
          'Pengingat Laporan RHK 🤖',
          'Waktunya membuat laporan RHK hari ini bersama Asisten Pintar.',
          scheduledDate,
          details,
          payload: 'jarvis',
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
          matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
        );
      }
    }
  }

  tz.TZDateTime _nextInstanceOfWeekdayTime(int weekday, int hour, int minute) {
    final tz.TZDateTime now = tz.TZDateTime.now(tz.local);
    tz.TZDateTime scheduledDate = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    
    while (scheduledDate.weekday != weekday || scheduledDate.isBefore(now)) {
      scheduledDate = scheduledDate.add(const Duration(days: 1));
    }
    return scheduledDate;
  }

  Future<Map<String, int>> getScheduledTime() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'hour': prefs.getInt(prefHourKey) ?? defaultHour,
      'minute': prefs.getInt(prefMinuteKey) ?? defaultMinute,
    };
  }

  Future<bool> isNotificationEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(prefEnabledKey) ?? true;
  }
}
