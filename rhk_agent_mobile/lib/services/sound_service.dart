import 'package:flutter/services.dart';

/// Service untuk memutar efek suara Asisten Pintar (Intro 10s dan Konfirmasi 1s)
class SoundService {
  static const MethodChannel _channel = MethodChannel('com.aspend.mobile/sound');

  /// Memutar suara pembuka saat Asisten Pintar dibuka (durasi 10 detik, diputar sekali saja)
  static Future<void> playIntroSound() async {
    try {
      await _channel.invokeMethod('playIntroSound');
    } catch (_) {}
  }

  /// Memutar suara konfirmasi jawaban user (durasi 1 detik)
  static Future<void> playConfirmSound() async {
    try {
      await _channel.invokeMethod('playConfirmSound');
    } catch (_) {}
  }

  /// Menghentikan pemutaran suara yang sedang berjalan
  static Future<void> stopSound() async {
    try {
      await _channel.invokeMethod('stopSound');
    } catch (_) {}
  }
}
