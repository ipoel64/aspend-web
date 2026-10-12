import 'package:flutter/material.dart';
import '../screens/settings/subscription_screen.dart';
import '../config/app_theme.dart';

class DialogUtils {
  static void showPremiumLimitDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.workspace_premium, color: Color(0xFFFFD700), size: 28),
              const SizedBox(width: 8),
              const Expanded(child: Text('Batas Harian Tercapai')),
            ],
          ),
          content: const Text(
            'Anda telah mencapai batas maksimal pembuatan 3 dokumen PDF (gratis) untuk hari ini. '
            'Silahkan dilanjutkan kembali Besok untuk bisa membuat dokumen PDF (Gratis). '
            'Atau kamu bisa Tingkatkan ke versi Premium untuk mendapatkan akses tanpa batas setiap hari!',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop(); // Tutup dialog
                Navigator.of(context).popUntil(ModalRoute.withName('/home')); // Kembali ke dashboard
              },
              child: Text(
                'Nanti Saja',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.navy,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () {
                Navigator.of(context).pop(); // Tutup dialog
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
                );
              },
              child: const Text('Upgrade Premium'),
            ),
          ],
        );
      },
    );
  }
}
