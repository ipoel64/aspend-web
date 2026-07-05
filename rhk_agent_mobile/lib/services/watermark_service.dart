import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:intl/intl.dart';
import 'package:image/image.dart' as img;

/// Utilitas untuk menambahkan Watermark (Waktu & GPS) di atas Foto
class WatermarkService {
  /// Mendapatkan lokasi GPS dan memformat alamatnya secara aman
  static Future<String> getCurrentLocationString() async {
    try {
      // Periksa status izin lokasi
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return "Izin lokasi ditolak";
        }
      }
      if (permission == LocationPermission.deniedForever) {
        return "Izin lokasi ditolak permanen";
      }

      Position? position;
      try {
        bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high,
            timeLimit: const Duration(seconds: 5),
          );
        }
      } catch (e) {
        debugPrint("getCurrentPosition failed: $e");
      }

      if (position == null) {
        try {
          position = await Geolocator.getLastKnownPosition();
        } catch (e) {
          debugPrint("getLastKnownPosition failed: $e");
        }
      }

      if (position == null) {
        return "GPS tidak aktif atau tidak mendapat sinyal";
      }

      String gpsText = "GPS: ${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}";
      
      try {
        // Ambil alamat dari koordinat (reverse geocoding)
        List<Placemark> placemarks = await placemarkFromCoordinates(
          position.latitude,
          position.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          
          List<String> addressParts = [];
          if (p.street != null && p.street!.isNotEmpty) addressParts.add(p.street!);
          if (p.subLocality != null && p.subLocality!.isNotEmpty) addressParts.add(p.subLocality!);
          if (p.locality != null && p.locality!.isNotEmpty) addressParts.add(p.locality!);
          if (p.subAdministrativeArea != null && p.subAdministrativeArea!.isNotEmpty) addressParts.add(p.subAdministrativeArea!);
          
          String address = addressParts.join(', ');
          return "$gpsText\n$address";
        }
      } catch (e) {
        debugPrint("Reverse geocoding error: $e");
      }
      return gpsText;
    } catch (e) {
      debugPrint("Geolocator error: $e");
      return "Gagal mendapatkan lokasi";
    }
  }

  /// Menambahkan watermark tanggal/waktu dan GPS ke foto
  static Future<File> addWatermark(File imageFile, {String? customText}) async {
    try {
      // 1. Baca gambar sebagai bytes
      final Uint8List bytes = await imageFile.readAsBytes();
      
      // 2. Decode gambar ke ui.Image Flutter (downscale ke targetWidth untuk efisiensi RAM)
      final ui.Codec codec = await ui.instantiateImageCodec(bytes, targetWidth: 1024);
      final ui.FrameInfo frameInfo = await codec.getNextFrame();
      final ui.Image originalImage = frameInfo.image;

      final int width = originalImage.width;
      final int height = originalImage.height;

      // 3. Siapkan PictureRecorder dan Canvas
      final ui.PictureRecorder recorder = ui.PictureRecorder();
      final Canvas canvas = Canvas(recorder);

      // Gambar foto asli di Canvas
      final Paint paint = Paint()..filterQuality = ui.FilterQuality.high;
      canvas.drawImage(originalImage, Offset.zero, paint);
      originalImage.dispose(); // Bebaskan memori native original image segera setelah digambar
      codec.dispose(); // Bebaskan codec juga

      // 4. Siapkan teks watermark
      final String timestamp = DateFormat('EEEE, d MMMM yyyy - HH:mm:ss', 'id_ID').format(DateTime.now());
      String locationText = customText ?? await getCurrentLocationString();
      
      final String fullWatermarkText = "WAKTU: $timestamp\n$locationText";

      // 5. Hitung ukuran teks proporsional berdasarkan resolusi foto
      final double padding = width * 0.025; // 2.5% dari lebar foto
      final double fontSize = width * 0.018; // 1.8% dari lebar foto
      final double textHeight = fontSize * 1.35;
      
      // Split teks untuk menggambar baris per baris
      final List<String> lines = fullWatermarkText.split('\n');
      
      // Tentukan lebar box berdasarkan baris terpanjang
      double maxLineWidth = 0;
      for (var line in lines) {
        final textPainter = TextPainter(
          text: TextSpan(
            text: line,
            style: TextStyle(
              color: Colors.white,
              fontSize: fontSize,
              fontWeight: FontWeight.bold,
            ),
          ),
          textDirection: ui.TextDirection.ltr,
        );
        textPainter.layout();
        if (textPainter.width > maxLineWidth) {
          maxLineWidth = textPainter.width;
        }
      }

      final double boxWidth = maxLineWidth + (padding * 2);
      final double boxHeight = (lines.length * textHeight) + (padding * 1.5);
      final double boxX = padding;
      final double boxY = height - boxHeight - padding;

      // Gambar latar belakang kotak gelap semi-transparan (60% opacity)
      final Paint bgPaint = Paint()
        ..color = const Color(0x99000000)
        ..style = PaintingStyle.fill;
      
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(boxX, boxY, boxWidth, boxHeight),
          Radius.circular(width * 0.008), // Sudut melengkung proporsional
        ),
        bgPaint,
      );

      // Gambar teks per baris di atas kotak latar belakang
      double currentY = boxY + padding;
      for (var line in lines) {
        final textPainter = TextPainter(
          text: TextSpan(
            text: line,
            style: TextStyle(
              color: Colors.white,
              fontSize: fontSize,
              fontWeight: FontWeight.bold,
              height: 1.25,
              shadows: const [
                Shadow(
                  offset: Offset(1.0, 1.0),
                  blurRadius: 2.0,
                  color: Colors.black,
                ),
              ],
            ),
          ),
          textDirection: ui.TextDirection.ltr,
        );
        textPainter.layout();
        textPainter.paint(canvas, Offset(boxX + padding, currentY));
        currentY += textHeight;
      }

      // Draw map badge in the bottom-right corner
      final double badgeRadius = width * 0.035;
      final double badgeX = width - padding - (badgeRadius * 2);
      final double badgeY = height - padding - (badgeRadius * 2);

      // Draw circular background
      canvas.drawCircle(
        Offset(badgeX + badgeRadius, badgeY + badgeRadius),
        badgeRadius,
        Paint()
          ..color = const Color(0x99000000)
          ..style = PaintingStyle.fill,
      );

      // Draw map pin icon
      final mapIconPainter = TextPainter(
        text: TextSpan(
          text: String.fromCharCode(Icons.location_on.codePoint),
          style: TextStyle(
            color: const Color(0xFFFFD700), // Gold
            fontSize: badgeRadius * 1.1,
            fontFamily: 'MaterialIcons',
          ),
        ),
        textDirection: ui.TextDirection.ltr,
      );
      mapIconPainter.layout();
      mapIconPainter.paint(
        canvas,
        Offset(
          badgeX + badgeRadius - (mapIconPainter.width / 2),
          badgeY + badgeRadius - (mapIconPainter.height / 2),
        ),
      );

      // 6. Selesaikan rendering dan kompres ke berkas baru
      final ui.Picture picture = recorder.endRecording();
      final ui.Image watermarkedImage = await picture.toImage(width, height);
      picture.dispose(); // Selesai merekam gambar, hapus picture native
      
      // Menggunakan rawRgba untuk meminimalkan beban memori native dari encoding PNG
      final ByteData? byteData = await watermarkedImage.toByteData(
        format: ui.ImageByteFormat.rawRgba,
      );
      watermarkedImage.dispose(); // Bebaskan RAM native gambar hasil render segera

      if (byteData == null) {
        return imageFile;
      }

      // Gunakan package image (pure Dart) untuk membuat JPEG dari raw bytes secara aman
      final img.Image imgImage = img.Image.fromBytes(
        width: width,
        height: height,
        bytes: byteData.buffer,
        order: img.ChannelOrder.rgba,
      );
      
      final Uint8List jpegBytes = Uint8List.fromList(img.encodeJpg(imgImage, quality: 80));
      
      // Simpan di berkas baru dalam folder temporary/cache
      final String originalPath = imageFile.path;
      final int lastSlash = originalPath.lastIndexOf(Platform.isWindows ? '\\' : '/');
      final String directoryPath = originalPath.substring(0, lastSlash);
      final String newPath = "$directoryPath/watermarked_${DateTime.now().millisecondsSinceEpoch}.jpg";
      
      final File newFile = File(newPath);
      await newFile.writeAsBytes(jpegBytes);
      
      // Hapus berkas mentah hasil jepretan kamera untuk menghemat memori
      try {
        if (originalPath.contains('cache') || originalPath.contains('tmp')) {
          await imageFile.delete();
        }
      } catch (_) {}

      return newFile;
    } catch (e) {
      debugPrint("Gagal menambahkan watermark: $e");
      return imageFile; // Kembalikan file asli jika gagal
    }
  }
}
