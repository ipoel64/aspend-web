import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String channelIdDefault = 'aspend_reminder_channel_custom_v6';
  static const String channelIdChime = 'aspend_reminder_channel_chime_v6';
  static const String channelIdSystem = 'aspend_reminder_channel_system_v6';

  static const String channelDesc =
      'Pengingat harian untuk membuat laporan RHK bersama Asisten Pendamping';

  static const String prefHourKey = 'notification_hour';
  static const String prefMinuteKey = 'notification_minute';
  static const String prefEnabledKey = 'notification_enabled';
  static const String prefSoundTypeKey = 'notification_sound_type';
  static const String _prefLastTriggeredKey = 'notification_last_triggered_date';

  static const int defaultHour = 16;
  static const int defaultMinute = 5;

  bool _isInitialized = false;
  Timer? _foregroundTimer;

  String getChannelIdForSound(String soundType) {
    if (soundType == 'chime') return channelIdChime;
    if (soundType == 'system') return channelIdSystem;
    return channelIdDefault;
  }

  void _configureLocalTimeZone() {
    tz.initializeTimeZones();
    try {
      final offsetHours = DateTime.now().timeZoneOffset.inHours;
      String locationName = 'Asia/Jakarta';
      if (offsetHours == 8) {
        locationName = 'Asia/Makassar';
      } else if (offsetHours == 9) {
        locationName = 'Asia/Jayapura';
      }
      tz.setLocalLocation(tz.getLocation(locationName));
    } catch (_) {
      try {
        tz.setLocalLocation(tz.getLocation('Asia/Jakarta'));
      } catch (_) {}
    }
  }

  Future<void> init() async {
    _configureLocalTimeZone();

    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
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
        navigatorKey.currentState?.pushNamed('/jarvis');
      },
    );

    _isInitialized = true;

    await _setupNotificationChannels();
    await scheduleDailyNotification();
    _startForegroundWatcher();

    // Minta izin notifikasi setelah Activity siap (post-frame) agar tidak terjadi
    // NullPointerException atau lock permissionRequestProgress saat main() berjalan.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await requestPermissions(requestExactAlarm: false);
    });
  }

  void _startForegroundWatcher() {
    _foregroundTimer?.cancel();
    _foregroundTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final isEnabled = prefs.getBool(prefEnabledKey) ?? true;
        if (!isEnabled) return;

        final scheduledHour = prefs.getInt(prefHourKey) ?? defaultHour;
        final scheduledMinute = prefs.getInt(prefMinuteKey) ?? defaultMinute;
        final now = DateTime.now();

        if (now.hour == scheduledHour && now.minute == scheduledMinute) {
          final todayStamp =
              '${now.year}-${now.month}-${now.day}-$scheduledHour:$scheduledMinute';
          final lastTriggered = prefs.getString(_prefLastTriggeredKey);
          if (lastTriggered != todayStamp) {
            await prefs.setString(_prefLastTriggeredKey, todayStamp);
            final soundType = prefs.getString(prefSoundTypeKey) ?? 'default';
            await _showDirectNotification(
              id: now.weekday, // ID yang sama dengan alarm terjadwal hari ini
              title: 'Pengingat Laporan RHK 🤖',
              body:
                  'Waktunya membuat laporan RHK hari ini bersama Asisten Pintar. Ketuk untuk membuka.',
              soundType: soundType,
            );
          }
        }
      } catch (e) {
        debugPrint('Foreground notification check error: $e');
      }
    });
  }

  Future<void> _setupNotificationChannels() async {
    final androidImplementation =
        flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImplementation == null) return;

    // 1. Channel Default (Suara Pengingat Aspend / Jarvis Reminder)
    try {
      const AndroidNotificationChannel defaultChannel =
          AndroidNotificationChannel(
        channelIdDefault,
        'Pengingat Laporan RHK (Suara Aspend)',
        description: channelDesc,
        importance: Importance.max,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('jarvis_reminder'),
        enableVibration: true,
      );
      await androidImplementation.createNotificationChannel(defaultChannel);
    } catch (e) {
      debugPrint('Failed creating defaultChannel: $e');
    }

    // 2. Channel Chime (Suara Lonceng Lembut)
    try {
      const AndroidNotificationChannel chimeChannel =
          AndroidNotificationChannel(
        channelIdChime,
        'Pengingat Laporan RHK (Nada Lonceng)',
        description: channelDesc,
        importance: Importance.max,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('confirm_chime'),
        enableVibration: true,
      );
      await androidImplementation.createNotificationChannel(chimeChannel);
    } catch (e) {
      debugPrint('Failed creating chimeChannel: $e');
    }

    // 3. Channel System (Suara Standar HP)
    try {
      const AndroidNotificationChannel systemChannel =
          AndroidNotificationChannel(
        channelIdSystem,
        'Pengingat Laporan RHK (Suara Sistem HP)',
        description: channelDesc,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );
      await androidImplementation.createNotificationChannel(systemChannel);
    } catch (e) {
      debugPrint('Failed creating systemChannel: $e');
    }
  }

  /// Request runtime permissions for Android 13+ (POST_NOTIFICATIONS)
  /// and optionally Android 12+ (EXACT_ALARM)
  Future<bool> requestPermissions({bool requestExactAlarm = false}) async {
    final androidImplementation =
        flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImplementation == null) return true;

    bool granted = true;
    try {
      final enabled = await androidImplementation.areNotificationsEnabled();
      if (enabled == true) {
        granted = true;
      } else {
        final reqResult =
            await androidImplementation.requestNotificationsPermission();
        granted = reqResult ?? true;
      }
    } catch (e) {
      debugPrint('requestNotificationsPermission error: $e');
      try {
        granted =
            (await androidImplementation.areNotificationsEnabled()) ?? true;
      } catch (_) {}
    }

    if (requestExactAlarm) {
      try {
        final canExact =
            await androidImplementation.canScheduleExactNotifications();
        if (canExact == false) {
          await androidImplementation.requestExactAlarmsPermission();
        }
      } catch (e) {
        debugPrint('requestExactAlarmsPermission error: $e');
      }
    }

    return granted;
  }

  NotificationDetails _buildNotificationDetails(String soundType) {
    final targetChannelId = getChannelIdForSound(soundType);

    AndroidNotificationSound? androidSound;
    String channelName = 'Pengingat Laporan RHK (Suara Aspend)';
    if (soundType == 'chime') {
      androidSound = const RawResourceAndroidNotificationSound('confirm_chime');
      channelName = 'Pengingat Laporan RHK (Nada Lonceng)';
    } else if (soundType == 'system') {
      androidSound = null;
      channelName = 'Pengingat Laporan RHK (Suara Sistem HP)';
    } else {
      androidSound =
          const RawResourceAndroidNotificationSound('jarvis_reminder');
    }

    final androidDetails = AndroidNotificationDetails(
      targetChannelId,
      channelName,
      channelDescription: channelDesc,
      importance: Importance.max,
      priority: Priority.max,
      icon: '@mipmap/ic_launcher',
      sound: androidSound,
      playSound: true,
      enableVibration: true,
      visibility: NotificationVisibility.public,
    );

    return NotificationDetails(android: androidDetails);
  }

  Future<void> _showDirectNotification({
    required int id,
    required String title,
    required String body,
    required String soundType,
  }) async {
    if (!_isInitialized) {
      await init();
    } else {
      await _setupNotificationChannels();
    }

    try {
      final details = _buildNotificationDetails(soundType);
      await flutterLocalNotificationsPlugin.show(
        id,
        title,
        body,
        details,
        payload: 'jarvis',
      );
    } catch (e) {
      debugPrint('Primary show notification failed ($e), falling back to system sound');
      final fallbackDetails = _buildNotificationDetails('system');
      await flutterLocalNotificationsPlugin.show(
        id,
        title,
        body,
        fallbackDetails,
        payload: 'jarvis',
      );
    }
  }

  Future<void> showTestNotification({String? soundType}) async {
    final actualSoundType = soundType ?? await getSoundType();
    await _showDirectNotification(
      id: 999,
      title: 'Pengingat Laporan RHK 🤖 (Asisten Pintar)',
      body:
          'Waktunya membuat laporan RHK bersama Asisten Pintar! Ketuk untuk memulai.',
      soundType: actualSoundType,
    );
  }

  Future<void> scheduleDailyNotification({
    int? hour,
    int? minute,
    bool? enabled,
    String? soundType,
  }) async {
    _configureLocalTimeZone();
    await _setupNotificationChannels();

    final prefs = await SharedPreferences.getInstance();

    if (hour != null && minute != null) {
      await prefs.setInt(prefHourKey, hour);
      await prefs.setInt(prefMinuteKey, minute);
      // Reset penanda agar apabila user mengatur ulang jam ke menit berikutnya di hari yang sama, tetap berbunyi
      await prefs.remove(_prefLastTriggeredKey);
    }
    if (enabled != null) {
      await prefs.setBool(prefEnabledKey, enabled);
    }
    if (soundType != null) {
      await prefs.setString(prefSoundTypeKey, soundType);
    }

    final isEnabled = prefs.getBool(prefEnabledKey) ?? true;
    final scheduledHour = prefs.getInt(prefHourKey) ?? defaultHour;
    final scheduledMinute = prefs.getInt(prefMinuteKey) ?? defaultMinute;
    final currentSoundType = prefs.getString(prefSoundTypeKey) ?? 'default';

    // Cancel existing scheduled alarms (IDs 1..7)
    for (int id = 1; id <= 7; id++) {
      try {
        await flutterLocalNotificationsPlugin.cancel(id);
      } catch (_) {}
    }

    if (!isEnabled) {
      return;
    }

    final details = _buildNotificationDetails(currentSoundType);
    final fallbackDetails = _buildNotificationDetails('system');

    // Jadwalkan untuk Senin s/d Jumat (1..5), serta tambahkan hari ini jika user
    // menguji pengingat di hari Sabtu/Minggu (6..7)
    final now = tz.TZDateTime.now(tz.local);
    final daysToSchedule = <int>{1, 2, 3, 4, 5};
    if (now.weekday == 6 || now.weekday == 7) {
      daysToSchedule.add(now.weekday);
    }

    for (final int weekday in daysToSchedule) {
      final scheduledDate =
          _nextInstanceOfWeekdayTime(weekday, scheduledHour, scheduledMinute);
      await _scheduleSingleAlarm(
        id: weekday,
        scheduledDate: scheduledDate,
        details: details,
        fallbackDetails: fallbackDetails,
      );
    }
  }

  Future<void> _scheduleSingleAlarm({
    required int id,
    required tz.TZDateTime scheduledDate,
    required NotificationDetails details,
    required NotificationDetails fallbackDetails,
  }) async {
    const title = 'Pengingat Laporan RHK 🤖';
    const body =
        'Waktunya membuat laporan RHK hari ini bersama Asisten Pintar. Ketuk untuk membuka.';

    // 1. Prioritas utama: alarmClock (tidak pernah ditunda oleh penghemat baterai/Doze)
    try {
      await flutterLocalNotificationsPlugin.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        details,
        payload: 'jarvis',
        androidScheduleMode: AndroidScheduleMode.alarmClock,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
      );
      return;
    } catch (e) {
      debugPrint('alarmClock schedule failed for day $id: $e');
    }

    // 2. Fallback kedua: exactAllowWhileIdle
    try {
      await flutterLocalNotificationsPlugin.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        details,
        payload: 'jarvis',
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
      );
      return;
    } catch (e) {
      debugPrint('exactAllowWhileIdle failed for day $id: $e');
    }

    // 3. Fallback ketiga: inexactAllowWhileIdle
    try {
      await flutterLocalNotificationsPlugin.zonedSchedule(
        id,
        title,
        body,
        scheduledDate,
        details,
        payload: 'jarvis',
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
      );
    } catch (e) {
      debugPrint('inexactAllowWhileIdle with custom sound failed for day $id ($e), using system sound');
      try {
        await flutterLocalNotificationsPlugin.zonedSchedule(
          id,
          title,
          body,
          scheduledDate,
          fallbackDetails,
          payload: 'jarvis',
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
          matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
        );
      } catch (_) {}
    }
  }

  tz.TZDateTime _nextInstanceOfWeekdayTime(int weekday, int hour, int minute) {
    final tz.TZDateTime now = tz.TZDateTime.now(tz.local);
    tz.TZDateTime scheduledDate =
        tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);

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

  Future<String> getSoundType() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(prefSoundTypeKey) ?? 'default';
  }
}
