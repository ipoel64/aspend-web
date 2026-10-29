import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import 'qr_web_login_screen.dart';

class LinkedDevicesScreen extends StatefulWidget {
  const LinkedDevicesScreen({super.key});

  @override
  State<LinkedDevicesScreen> createState() => _LinkedDevicesScreenState();
}

class _LinkedDevicesScreenState extends State<LinkedDevicesScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _activeSessions = [];

  @override
  void initState() {
    super.initState();
    _loadActiveSessions();
  }

  Future<void> _loadActiveSessions() async {
    setState(() {
      _isLoading = true;
    });

    final auth = context.read<AuthProvider>();
    if (auth.sheetsService == null || auth.spreadsheetId == null) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _activeSessions = [];
        });
      }
      return;
    }

    try {
      final rows = await auth.sheetsService!.getAllRows(
        auth.spreadsheetId!,
        'Web_Sessions',
      );

      final List<Map<String, dynamic>> sessions = [];
      if (rows.isNotEmpty) {
        for (int i = 0; i < rows.length; i++) {
          final row = rows[i];
          if (row.length > 4 && row[4]?.toString().toUpperCase() == 'AUTHORIZED') {
            final sessionId = row[0]?.toString() ?? '';
            final email = row.length > 1 ? row[1]?.toString() ?? '' : '';
            final nama = row.length > 2 ? row[2]?.toString() ?? '' : '';
            final createdAtStr = row.length > 5 ? row[5]?.toString() ?? '' : '';
            final deviceInfo = row.length > 6 ? row[6]?.toString() ?? 'Browser Web (Desktop)' : 'Browser Web (Desktop)';

            sessions.add({
              'sessionId': sessionId,
              'email': email,
              'nama': nama,
              'createdAt': createdAtStr,
              'deviceInfo': deviceInfo,
            });
          }
        }
      }

      // Urutkan dari yang paling baru
      sessions.sort((a, b) {
        final dateA = DateTime.tryParse(a['createdAt'] ?? '') ?? DateTime(2000);
        final dateB = DateTime.tryParse(b['createdAt'] ?? '') ?? DateTime(2000);
        return dateB.compareTo(dateA);
      });

      if (mounted) {
        setState(() {
          _activeSessions = sessions;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading Web_Sessions: $e');
      if (mounted) {
        setState(() {
          _activeSessions = [];
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _logoutSingleSession(Map<String, dynamic> session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: Colors.red),
            SizedBox(width: 8),
            Text('Keluar dari Perangkat?'),
          ],
        ),
        content: Text(
          'Sesi browser web ini (${session['deviceInfo']}) akan segera ditutup dan keluar secara otomatis.',
          style: const TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final auth = context.read<AuthProvider>();
    final sessionId = session['sessionId'] as String;

    // Show loading indicator
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.teal)),
    );

    try {
      // 1. Update row in Google Sheets
      if (auth.sheetsService != null && auth.spreadsheetId != null) {
        try {
          final rowIndex = await auth.sheetsService!.findRowByValue(
            auth.spreadsheetId!,
            'Web_Sessions',
            0,
            sessionId,
          );
          final currentRow = await auth.sheetsService!.getRowByValue(
            auth.spreadsheetId!,
            'Web_Sessions',
            0,
            sessionId,
          );
          if (currentRow != null && rowIndex > 0) {
            final updatedRow = List<dynamic>.from(currentRow);
            if (updatedRow.length > 4) {
              updatedRow[4] = 'LOGGED_OUT';
            }
            await auth.sheetsService!.updateRow(
              auth.spreadsheetId!,
              'Web_Sessions',
              rowIndex,
              updatedRow,
            );
          }
        } catch (e) {
          debugPrint('Update Web_Sessions row error: $e');
        }
      }

      // 2. Broadcast logout via Cloud Relay ntfy.sh
      try {
        await http.post(
          Uri.parse('https://ntfy.sh/aspend_qr_${Uri.encodeComponent(sessionId)}'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'action': 'LOGOUT',
            'sessionId': sessionId,
            'status': 'LOGGED_OUT',
          }),
        ).timeout(const Duration(seconds: 4));
      } catch (_) {}

      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sesi perangkat web berhasil dikeluarkan.'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
        _loadActiveSessions();
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mengeluarkan sesi: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _logoutAllSessions() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.power_settings_new_rounded, color: Colors.red),
            SizedBox(width: 8),
            Text('Keluar Semua Perangkat?'),
          ],
        ),
        content: const Text(
          'Semua sesi Aspend Web yang sedang aktif di komputer / laptop Anda akan dikeluarkan seketika.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Keluar Semua'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final auth = context.read<AuthProvider>();

    // Show loading indicator
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.teal)),
    );

    try {
      // 1. Update all active rows in Google Sheets
      if (auth.sheetsService != null && auth.spreadsheetId != null) {
        for (var sess in _activeSessions) {
          final sId = sess['sessionId'] as String;
          try {
            final rowIndex = await auth.sheetsService!.findRowByValue(
              auth.spreadsheetId!,
              'Web_Sessions',
              0,
              sId,
            );
            final currentRow = await auth.sheetsService!.getRowByValue(
              auth.spreadsheetId!,
              'Web_Sessions',
              0,
              sId,
            );
            if (currentRow != null && rowIndex > 0) {
              final updatedRow = List<dynamic>.from(currentRow);
              if (updatedRow.length > 4) {
                updatedRow[4] = 'LOGGED_OUT';
              }
              await auth.sheetsService!.updateRow(
                auth.spreadsheetId!,
                'Web_Sessions',
                rowIndex,
                updatedRow,
              );
            }
          } catch (_) {}
        }
      }

      // 2. Broadcast logout to all individual sessions via cloud relay
      for (var sess in _activeSessions) {
        final sId = sess['sessionId'] as String;
        try {
          http.post(
            Uri.parse('https://ntfy.sh/aspend_qr_${Uri.encodeComponent(sId)}'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'action': 'LOGOUT', 'sessionId': sId, 'status': 'LOGGED_OUT'}),
          ).timeout(const Duration(seconds: 3)).then((_) {}, onError: (_) {});
        } catch (_) {}
      }

      // 3. Broadcast to user channel
      final email = auth.currentUser?.email ?? '';
      if (email.isNotEmpty) {
        final userTopic = 'aspend_user_${email.replaceAll('@', '_').replaceAll('.', '_')}';
        try {
          http.post(
            Uri.parse('https://ntfy.sh/$userTopic'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'action': 'LOGOUT_ALL', 'email': email}),
          ).timeout(const Duration(seconds: 3)).then((_) {}, onError: (_) {});
        } catch (_) {}
      }

      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Semua sesi perangkat web berhasil dikeluarkan.'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
        _loadActiveSessions();
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mengeluarkan sesi: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String _formatSessionDate(String? isoString) {
    if (isoString == null || isoString.isEmpty) return 'Waktu tidak diketahui';
    try {
      final dt = DateTime.parse(isoString).toLocal();
      return DateFormat('d MMM yyyy, HH:mm', 'id_ID').format(dt);
    } catch (_) {
      return isoString;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 0,
        title: Text(
          'Perangkat Web Tertaut',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : AppColors.navyDark,
          ),
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? Colors.white : AppColors.navyDark,
            size: 20,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: Icon(
              Icons.refresh_rounded,
              color: isDark ? Colors.white : AppColors.navyDark,
            ),
            tooltip: 'Segarkan Daftar',
            onPressed: _loadActiveSessions,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.teal))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Hero Card: Panduan & Tombol Tautkan Perangkat Baru
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark
                            ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
                            : [AppColors.navyDark, AppColors.navy],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.12),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.laptop_chromebook_rounded,
                            size: 36,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'Gunakan Aspend di Web',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Buka aspend-web.vercel.app di komputer / laptop Anda, lalu pindai kode QR untuk login secara otomatis.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 12.5,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const QrWebLoginScreen(),
                                ),
                              ).then((_) => _loadActiveSessions());
                            },
                            icon: const Icon(Icons.qr_code_scanner_rounded, size: 20),
                            label: const Text(
                              'Tautkan Perangkat Baru',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.teal,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Header Bagian Status Perangkat Web
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.devices_rounded,
                            size: 18,
                            color: isDark ? const Color(0xFF38BDF8) : AppColors.teal,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Status Perangkat Web',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : AppColors.navyDark,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _activeSessions.isNotEmpty
                              ? Colors.green.withOpacity(0.15)
                              : Colors.grey.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _activeSessions.isNotEmpty
                                ? Colors.green.withOpacity(0.3)
                                : Colors.transparent,
                          ),
                        ),
                        child: Text(
                          '${_activeSessions.length} Aktif',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _activeSessions.isNotEmpty
                                ? (isDark ? Colors.greenAccent : Colors.green.shade800)
                                : Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Daftar Sesi Web Aktif
                  if (_activeSessions.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark ? Colors.white10 : Colors.grey.withOpacity(0.2),
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: isDark ? Colors.white.withOpacity(0.05) : Colors.grey.shade100,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.phonelink_off_rounded,
                              size: 40,
                              color: isDark ? Colors.grey[500] : Colors.grey[400],
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Belum Ada Perangkat Web Aktif',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : AppColors.navyDark,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Anda belum login di Aspend Web pada perangkat komputer manapun.\nKetuk tombol "Tautkan Perangkat Baru" di atas untuk memindai barcode.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _activeSessions.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final sess = _activeSessions[index];
                        final rawSid = sess['sessionId'] as String;
                        final displaySid = rawSid.length > 20
                            ? '${rawSid.substring(0, 10)}...${rawSid.substring(rawSid.length - 6)}'
                            : rawSid;

                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E293B) : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isDark ? Colors.white12 : Colors.grey.withOpacity(0.25),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColors.teal.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(
                                      Icons.laptop_chromebook_rounded,
                                      color: AppColors.teal,
                                      size: 24,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                sess['deviceInfo'] ?? 'Google Chrome (Komputer)',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.bold,
                                                  color: isDark ? Colors.white : AppColors.navyDark,
                                                ),
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.green.withOpacity(0.15),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  CircleAvatar(
                                                    radius: 3,
                                                    backgroundColor: Colors.green,
                                                  ),
                                                  SizedBox(width: 4),
                                                  Text(
                                                    'Aktif',
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.bold,
                                                      color: Colors.green,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Ditautkan: ${_formatSessionDate(sess['createdAt'])}',
                                          style: TextStyle(
                                            fontSize: 11.5,
                                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Sesi ID: $displaySid',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontFamily: 'monospace',
                                            color: isDark ? Colors.grey[500] : Colors.grey[500],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Divider(height: 1),
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton.icon(
                                  onPressed: () => _logoutSingleSession(sess),
                                  icon: const Icon(Icons.logout_rounded, size: 16, color: Colors.red),
                                  label: const Text(
                                    'Keluar dari Browser Ini',
                                    style: TextStyle(
                                      color: Colors.red,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12.5,
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 16),

                    // Tombol Keluar dari Semua Perangkat
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _logoutAllSessions,
                        icon: const Icon(Icons.power_settings_new_rounded, size: 18, color: Colors.red),
                        label: const Text(
                          'Keluar dari Semua Perangkat Web',
                          style: TextStyle(
                            color: Colors.red,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.red, width: 1.2),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
