import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'package:url_launcher/url_launcher.dart';
import '../../config/constants.dart';
import '../../config/app_theme.dart';
import '../../config/master_data.dart';
import '../../providers/auth_provider.dart';
import '../../providers/report_provider.dart';
import '../../models/report.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/report_card.dart';
import '../settings/settings_screen.dart';
import '../jarvis/jarvis_assistant_screen.dart';
import '../auth/qr_web_login_screen.dart';
import '../auth/linked_devices_screen.dart';

/// Dashboard Screen — Statistik + Riwayat Laporan + Filter
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {

  String? _filterJenis;
  String? _filterRencanaAksi;
  String? _filterMonth;
  String? _filterDate;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ReportProvider>().loadReports();
    });
  }

  @override
  void dispose() {
    super.dispose();
  }

  void _resetFilters() {
    setState(() {
      _filterJenis = null;
      _filterRencanaAksi = null;
      _filterMonth = null;
      _filterDate = null;
    });
    context.read<ReportProvider>().resetFilters();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Stack(
        children: [
          RefreshIndicator(
            color: AppColors.navy,
            onRefresh: () => context.read<ReportProvider>().loadReports(),
            child: CustomScrollView(
          slivers: [
            // App Bar - Compact & Spacious Header
            // App Bar - Animated Collapsible & Fading Header
            SliverAppBar(
              expandedHeight: MediaQuery.of(context).padding.top + 68.0,
              toolbarHeight: 0,
              floating: true,
              pinned: false,
              snap: true,
              backgroundColor: Colors.transparent,
              elevation: 0,
              flexibleSpace: LayoutBuilder(
                builder: (context, constraints) {
                  final topPadding = MediaQuery.of(context).padding.top;
                  final totalHeaderHeight = topPadding + 68.0;
                  final currentHeight = constraints.biggest.height;
                  final progress = (currentHeight / totalHeaderHeight).clamp(0.0, 1.0);
                  if (progress <= 0.01) {
                    return const SizedBox.shrink();
                  }
                  return Opacity(
                    opacity: progress,
                    child: Container(
                      height: totalHeaderHeight,
                      padding: EdgeInsets.only(
                        top: topPadding + 6,
                        bottom: 8,
                        left: 16,
                        right: 16,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.navyDark.withOpacity(progress),
                            AppColors.navy.withOpacity(progress),
                          ],
                        ),
                        boxShadow: progress > 0.3
                            ? [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.15 * progress),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 44,
                            height: 44,
                            child: CircleAvatar(
                              radius: 22,
                              backgroundColor: AppColors.gold.withOpacity(0.3),
                              child: auth.userProfile?.photoFileId.isNotEmpty == true
                                  ? ClipOval(
                                      child: Image.network(
                                        'https://drive.google.com/thumbnail?id=${auth.userProfile!.photoFileId}&sz=w200',
                                        width: 44,
                                        height: 44,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => _buildDashboardAvatarInitial(auth),
                                      ),
                                    )
                                  : _buildDashboardAvatarInitial(auth),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Selamat Datang',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.white.withOpacity(0.7),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  auth.userProfile?.nama.isNotEmpty == true
                                      ? auth.userProfile!.nama
                                      : (auth.currentUser?.displayName ?? 'Pengguna'),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          // Scan QR / Perangkat Web Tertaut Button
                          IconButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const LinkedDevicesScreen(),
                                ),
                              );
                            },
                            icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 24),
                            tooltip: 'Perangkat Web Tertaut',
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            // Content
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Stat Cards
                    _buildStatCards(),
                    const SizedBox(height: 12),

                    // Filter Section
                    _buildFilterSection(),
                    const SizedBox(height: 16),

                    // Reports Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Riwayat Laporan',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.navyDark,
                          ),
                        ),
                        Consumer<ReportProvider>(
                          builder: (_, rp, __) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.navy.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${rp.filteredReports.length} laporan',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.navy.withOpacity(0.7),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                  ],
                ),
              ),
            ),

            // Reports List
            Consumer<ReportProvider>(
              builder: (context, rp, _) {
                if (rp.isLoading) {
                  return const SliverFillRemaining(
                    child: Center(
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(AppColors.navy),
                      ),
                    ),
                  );
                }

                if (rp.filteredReports.isEmpty) {
                  return SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inbox_rounded, size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 12),
                          Text(
                            'Belum ada laporan',
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.grey[500],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Buat laporan pertama Anda',
                            style: TextStyle(fontSize: 13, color: Colors.grey[400]),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final report = rp.filteredReports[index];
                        
                        DateTime parseReportDate(String dateStr) {
                          final cleaned = dateStr.trim();
                          final parsedIso = DateTime.tryParse(cleaned);
                          if (parsedIso != null) return parsedIso;

                          final formats = [
                            'dd/MM/yyyy',
                            'yyyy-MM-dd',
                            'd MMMM yyyy',
                            'd MMM yyyy',
                            'EEEE, d MMMM yyyy',
                            'dd-MM-yyyy',
                          ];

                          for (var format in formats) {
                            try {
                              return DateFormat(format, 'id_ID').parse(cleaned);
                            } catch (_) {}
                            try {
                              return DateFormat(format, 'en_US').parse(cleaned);
                            } catch (_) {}
                          }

                          try {
                            final cleanedText = cleaned
                                .replaceAll(RegExp(r'\s*-\s*\d{2}:\d{2}\s*(WIB)?'), '')
                                .replaceAll(RegExp(r'•.*'), '')
                                .trim();
                            
                            final parsedFallback = DateTime.tryParse(cleanedText);
                            if (parsedFallback != null) return parsedFallback;
                            
                            for (var format in formats) {
                              try {
                                return DateFormat(format, 'id_ID').parse(cleanedText);
                              } catch (_) {}
                              try {
                                return DateFormat(format, 'en_US').parse(cleanedText);
                              } catch (_) {}
                            }
                          } catch (_) {}

                          return DateTime.fromMillisecondsSinceEpoch(0);
                        }
                        
                        String getDatePart(String dateStr) {
                          final parsed = parseReportDate(dateStr);
                          return '${parsed.year}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
                        }
                        
                        final isFirstOfGroup = index == 0 ||
                            getDatePart(rp.filteredReports[index - 1].tanggal) != getDatePart(report.tanggal);
                        
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (isFirstOfGroup) ...[
                              Padding(
                                padding: const EdgeInsets.only(top: 20, bottom: 12),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Container(
                                        height: 2,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              AppColors.teal.withOpacity(0.0),
                                              AppColors.teal,
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    Container(
                                      margin: const EdgeInsets.symmetric(horizontal: 10),
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                      decoration: BoxDecoration(
                                        gradient: const LinearGradient(
                                          colors: [AppColors.navyDark, AppColors.teal],
                                          begin: Alignment.centerLeft,
                                          end: Alignment.centerRight,
                                        ),
                                        borderRadius: BorderRadius.circular(20),
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppColors.teal.withOpacity(0.35),
                                            blurRadius: 8,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                        border: Border.all(
                                          color: Colors.white.withOpacity(0.25),
                                          width: 1,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            Icons.calendar_month_rounded,
                                            size: 14,
                                            color: Colors.white,
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(parseReportDate(report.tanggal)),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 0.2,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Expanded(
                                      child: Container(
                                        height: 2,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              AppColors.teal,
                                              AppColors.teal.withOpacity(0.0),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: ReportCard(
                                report: report,
                                onDelete: () => _confirmDelete(context, report),
                                onViewPdf: () => _viewPdf(report),
                                onEdit: () => _editReport(report),
                              ),
                            ),
                          ],
                        );
                      },
                      childCount: rp.filteredReports.length,
                    ),
                  ),
                );
              },
            ),

            // Bottom padding
            const SliverToBoxAdapter(child: SizedBox(height: 90)),
          ],
        ),
      ),
      // Floating Asisten Pintar Button on Dashboard (Dapat Digeser-geser)
      const _AsistenPintarFloatingWidget(),
    ],
  ),
);
  }

  Widget _buildStatCards() {
    return Consumer<ReportProvider>(
      builder: (_, rp, __) => Row(
        children: [
          Expanded(
            child: StatCard(
              icon: Icons.assignment_rounded,
              title: 'Total Laporan',
              value: '${rp.stats.total}',
              color: AppColors.navy,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: StatCard(
              icon: Icons.calendar_month_rounded,
              title: 'Bulan Ini',
              value: '${rp.stats.month}',
              color: AppColors.gold,
            ),
          ),
        ],
      ),
    );
  }

  int _getRhkTarget(String key, String jenisSdm) {
    if (jenisSdm == 'TKSK') return 1;
    final num = key.replaceAll(RegExp(r'\D'), '');
    switch (num) {
      case '1': return 1;
      case '2': return 15;
      case '3': return 2;
      case '4': return 2;
      case '5': return 3;
      case '6': return 1;
      case '7': return 1;
      case '8': return 2;
      case '9': return 1;
      default: return 1;
    }
  }

  Color _getRhkColor(String key) {
    final num = key.replaceAll(RegExp(r'\D'), '');
    switch (num) {
      case '1': return const Color(0xFF2563EB); // Blue
      case '2': return const Color(0xFF9333EA); // Purple
      case '3': return const Color(0xFF059669); // Emerald
      case '4': return const Color(0xFFD97706); // Amber
      case '5': return const Color(0xFF0891B2); // Cyan
      case '6': return const Color(0xFF4F46E5); // Indigo
      case '7': return const Color(0xFFDB2777); // Pink
      case '8': return const Color(0xFFE11D48); // Rose
      case '9': return const Color(0xFF0D9488); // Teal
      default: return const Color(0xFF475569);  // Slate
    }
  }

  Widget _buildRhkTargetProgressSection(ReportProvider rp, String jenisSdm) {
    final counts = rp.stats.rhkCountsMonth;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Ambil daftar RHK sesuai jenis SDM (RHK-1 s/d RHK-9 untuk PKH, RHK-1 s/d RHK-6 untuk TKSK)
    final uniqueJenis = getUniqueJenisRHK(jenisSdm);
    final rhkKeys = uniqueJenis.map((e) => e['id'] ?? '').where((id) => id.isNotEmpty).toList();

    int totalTarget = 0;
    int totalCount = 0;
    for (var k in rhkKeys) {
      totalTarget += _getRhkTarget(k, jenisSdm);
      totalCount += counts[k] ?? 0;
    }
    final totalPct = totalTarget > 0 ? ((totalCount / totalTarget) * 100).clamp(0, 100).round() : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header Ringkasan Target Bulan Ini
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(
                  Icons.track_changes_rounded,
                  size: 16,
                  color: isDark ? const Color(0xFF38BDF8) : AppColors.teal,
                ),
                const SizedBox(width: 6),
                Text(
                  'Target RHK Bulan Ini',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : AppColors.navyDark,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: totalCount >= totalTarget
                        ? Colors.green.withOpacity(0.15)
                        : (isDark ? Colors.white10 : Colors.grey.withOpacity(0.12)),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: totalCount >= totalTarget
                          ? Colors.green.withOpacity(0.4)
                          : Colors.transparent,
                    ),
                  ),
                  child: Text(
                    '$totalCount / $totalTarget ($totalPct%)',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: totalCount >= totalTarget
                          ? (isDark ? Colors.greenAccent : Colors.green.shade800)
                          : (isDark ? Colors.grey[300] : Colors.grey[700]),
                    ),
                  ),
                ),
              ],
            ),
            if (_filterJenis != null)
              InkWell(
                onTap: () {
                  setState(() {
                    _filterJenis = null;
                    _filterRencanaAksi = null;
                  });
                  context.read<ReportProvider>().setFilterJenis(null);
                },
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Filter: $_filterJenis',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.teal,
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(Icons.close_rounded, size: 12, color: AppColors.teal),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),

        // Grid 3 Kolom Responsif Kartu Target RHK
        LayoutBuilder(
          builder: (context, constraints) {
            final cardWidth = (constraints.maxWidth - 12) / 3;
            return Wrap(
              spacing: 6,
              runSpacing: 6,
              children: rhkKeys.map((key) {
                final target = _getRhkTarget(key, jenisSdm);
                final count = counts[key] ?? 0;
                final pct = target > 0 ? ((count / target) * 100).clamp(0, 100).round() : 0;
                final isDone = count >= target;
                final isSelected = _filterJenis == key;
                final color = _getRhkColor(key);

                Color cardBg;
                Color borderColor;
                if (isSelected) {
                  cardBg = color.withOpacity(isDark ? 0.25 : 0.12);
                  borderColor = color;
                } else if (isDone) {
                  cardBg = isDark
                      ? const Color(0xFF064E3B).withOpacity(0.35)
                      : const Color(0xFFECFDF5);
                  borderColor = isDark
                      ? Colors.emerald.withOpacity(0.5)
                      : const Color(0xFF6EE7B7);
                } else {
                  cardBg = isDark
                      ? AppColors.bgDark
                      : color.withOpacity(0.04);
                  borderColor = isDark
                      ? Colors.white12
                      : color.withOpacity(0.2);
                }

                return Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        if (_filterJenis == key) {
                          _filterJenis = null;
                          _filterRencanaAksi = null;
                        } else {
                          _filterJenis = key;
                          _filterRencanaAksi = null;
                        }
                      });
                      context.read<ReportProvider>().setFilterJenis(_filterJenis);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: cardWidth,
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: borderColor,
                          width: isSelected ? 2.0 : (isDone ? 1.2 : 0.8),
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: color.withOpacity(0.3),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                )
                              ]
                            : null,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Baris Atas: Label RHK & Ikon Checklist/Filter
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                key.replaceAll('-', ' '),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: isSelected
                                      ? color
                                      : (isDone
                                          ? (isDark ? Colors.emeraldAccent : const Color(0xFF065F46))
                                          : (isDark ? Colors.white : color)),
                                ),
                              ),
                              if (isDone)
                                const Icon(
                                  Icons.check_circle_rounded,
                                  size: 12,
                                  color: Color(0xFF10B981),
                                )
                              else if (isSelected)
                                Icon(
                                  Icons.filter_alt_rounded,
                                  size: 11,
                                  color: color,
                                ),
                            ],
                          ),
                          const SizedBox(height: 3),

                          // Baris Tengah: Jumlah Capaian / Target & Persentase
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              RichText(
                                text: TextSpan(
                                  children: [
                                    TextSpan(
                                      text: '$count',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        color: isDone
                                            ? (isDark ? Colors.emeraldAccent : const Color(0xFF047857))
                                            : (isDark ? Colors.white : Colors.black87),
                                      ),
                                    ),
                                    TextSpan(
                                      text: '/$target',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: isDark ? Colors.grey[500] : Colors.grey[600],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '$pct%',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: isDone
                                      ? (isDark ? Colors.emeraldAccent : const Color(0xFF059669))
                                      : (isDark ? Colors.grey[400] : Colors.grey[600]),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),

                          // Baris Bawah: Mini Linear Progress Bar
                          ClipRRect(
                            borderRadius: BorderRadius.circular(3),
                            child: SizedBox(
                              height: 3.5,
                              child: LinearProgressIndicator(
                                value: (pct / 100).clamp(0.0, 1.0),
                                backgroundColor: isDark
                                    ? Colors.white10
                                    : Colors.black.withOpacity(0.06),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  isDone ? const Color(0xFF10B981) : color,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildFilterSection() {
    final auth = context.read<AuthProvider>();
    final jenisSdm = auth.userProfile?.jenisSdm ?? 'SDM PKH';
    final uniqueJenis = getUniqueJenisRHK(jenisSdm);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(Theme.of(context).brightness == Brightness.dark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Progress Setiap Target RHK (Sesuai Ketentuan Aspend Web & Fungsi Filter Interaktif)
          Consumer<ReportProvider>(
            builder: (context, rp, child) {
              return _buildRhkTargetProgressSection(rp, jenisSdm);
            },
          ),
          const SizedBox(height: 14),
          // Filter row
          Row(
            children: [
              // Jenis RHK filter
              Expanded(
                flex: 3,
                child: _buildFilterDropdown(
                  value: _filterJenis,
                  hint: 'RHK',
                  items: uniqueJenis.map((j) => DropdownMenuItem(
                    value: j['id'] as String,
                    child: Text(j['id'] as String, style: const TextStyle(fontSize: 11)),
                  )).toList(),
                  onChanged: (value) {
                    setState(() {
                      _filterJenis = value;
                      _filterRencanaAksi = null;
                    });
                    context.read<ReportProvider>().setFilterJenis(value);
                  },
                ),
              ),
              const SizedBox(width: 6),
              // Date filter
              Expanded(
                flex: 3,
                child: _buildDatePicker(),
              ),
              const SizedBox(width: 6),
              // Month filter
              Expanded(
                flex: 3,
                child: _buildMonthPicker(),
              ),
              const SizedBox(width: 6),
              // Reset button
              InkWell(
                onTap: _resetFilters,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  height: 32,
                  width: 32,
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(child: Icon(Icons.refresh_rounded, size: 16, color: Colors.grey[500])),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }



  Widget _buildFilterDropdown({
    String? value,
    required String hint,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
        borderRadius: BorderRadius.circular(10),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isDense: true,
          hint: Text(hint, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
          isExpanded: true,
          icon: Icon(Icons.keyboard_arrow_down, size: 16, color: Colors.grey[500]),
          style: const TextStyle(fontSize: 11, color: AppColors.navyDark),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }

  Future<DateTime?> _showMonthYearPicker(BuildContext context, DateTime initialDate) async {
    int selectedYear = initialDate.year;
    int selectedMonth = initialDate.month;
    final now = DateTime.now();

    return await showDialog<DateTime>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: () {
                      setState(() => selectedYear--);
                    },
                  ),
                  Text('$selectedYear', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: selectedYear >= now.year ? null : () {
                      setState(() => selectedYear++);
                    },
                  ),
                ],
              ),
              content: SizedBox(
                width: 300,
                height: 300,
                child: GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    childAspectRatio: 1.5,
                  ),
                  itemCount: 12,
                  itemBuilder: (context, index) {
                    final month = index + 1;
                    final isSelected = month == selectedMonth;
                    final isFuture = selectedYear == now.year && month > now.month;

                    return InkWell(
                      onTap: isFuture
                          ? null
                          : () {
                              setState(() => selectedMonth = month);
                              Navigator.pop(context, DateTime(selectedYear, selectedMonth));
                            },
                      child: Container(
                        margin: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.navy : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          DateFormat('MMM', 'id_ID').format(DateTime(2020, month)),
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : (isFuture ? Colors.grey : AppColors.navyDark),
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildDatePicker() {
    return InkWell(
      onTap: () async {
        final now = DateTime.now();
        final picked = await showDatePicker(
          context: context,
          initialDate: now,
          firstDate: DateTime(2020),
          lastDate: now,
        );
        if (picked != null) {
          final dateStr = DateFormat('yyyy-MM-dd').format(picked);
          setState(() {
            _filterDate = dateStr;
            _filterMonth = null;
          });
          if (mounted) {
            context.read<ReportProvider>().setFilterDate(dateStr);
          }
        }
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _filterDate != null 
                    ? DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(_filterDate!))
                    : 'Tanggal',
                style: TextStyle(
                  fontSize: 11,
                  color: _filterDate != null ? AppColors.navyDark : Colors.grey[500],
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.calendar_month_rounded, size: 16, color: Colors.grey[500]),
          ],
        ),
      ),
    );
  }

  Widget _buildMonthPicker() {
    return InkWell(
      onTap: () async {
        final now = DateTime.now();
        final initial = _filterMonth != null 
            ? DateTime.parse('$_filterMonth-01')
            : now;
            
        final picked = await _showMonthYearPicker(context, initial);
        if (picked != null) {
          final monthStr = DateFormat('yyyy-MM').format(picked);
          setState(() {
            _filterMonth = monthStr;
            _filterDate = null;
          });
          if (mounted) {
            context.read<ReportProvider>().setFilterMonth(monthStr);
          }
        }
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _filterMonth != null
                    ? DateFormat('MMMM yyyy', 'id_ID').format(DateTime.parse('$_filterMonth-01'))
                    : 'Bulan',
                style: TextStyle(
                  fontSize: 11,
                  color: _filterMonth != null ? AppColors.navyDark : Colors.grey[500],
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.date_range_rounded, size: 16, color: Colors.grey[500]),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, Report report) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange),
            SizedBox(width: 8),
            Text('Hapus Laporan'),
          ],
        ),
        content: Text(
          'Yakin ingin menghapus laporan "${report.idRHK} - ${report.rencanaAksi}"?\n\nTindakan ini tidak bisa dibatalkan.',
          style: const TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(ctx);
              context.read<ReportProvider>().deleteReport(report.id);
            },
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _openGoogleDriveFolder() async {
    final auth = context.read<AuthProvider>();
    if (auth.driveService == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Drive belum siap, silakan sign in kembali')),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Mencari folder penyimpanan di Google Drive...'), duration: Duration(seconds: 1)),
    );

    try {
      final folderId = await auth.driveService!.findFolder(AppConstants.driveFolderOutput);
      if (folderId != null) {
        final url = 'https://drive.google.com/drive/folders/$folderId';
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          throw 'Tidak dapat membuka browser untuk link ini';
        }
      } else {
        throw 'Folder penyimpanan "${AppConstants.driveFolderOutput}" tidak ditemukan';
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal membuka folder Drive: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _viewPdf(Report report) async {
    if (report.pdfFileId.isNotEmpty) {
      final url = 'https://drive.google.com/file/d/${report.pdfFileId}/view';
      final uri = Uri.parse(url);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Membuka PDF laporan di browser...'),
          duration: Duration(seconds: 1),
        ),
      );

      try {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          throw 'Tidak dapat membuka browser';
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Gagal membuka PDF: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('PDF belum dibuat untuk laporan ini'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  void _editReport(Report report) async {
    await Navigator.pushNamed(context, '/create-report', arguments: report);
    if (mounted) {
      context.read<ReportProvider>().loadReports();
    }
  }

  Widget _buildDashboardAvatarInitial(AuthProvider auth) {
    final name = auth.userProfile?.nama.trim().isNotEmpty == true
        ? auth.userProfile!.nama
        : (auth.currentUser?.displayName ?? 'U');
    final initial = name.trim().isEmpty ? 'U' : name.trim().substring(0, 1).toUpperCase();
    return Text(
      initial,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppColors.gold,
      ),
    );
  }
}

/// Floating button khusus Asisten Pintar dengan latar icon Aspend (tanpa celah hitam), draggable, dan teks "Asisten Pintar"
class _AsistenPintarFloatingWidget extends StatefulWidget {
  const _AsistenPintarFloatingWidget();

  @override
  State<_AsistenPintarFloatingWidget> createState() => _AsistenPintarFloatingWidgetState();
}

class _AsistenPintarFloatingWidgetState extends State<_AsistenPintarFloatingWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  Offset? _position;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final padding = MediaQuery.of(context).padding;
    const buttonWidth = 72.0;
    const buttonHeight = 72.0;

    // Posisi awal: pojok kanan bawah di atas bottom bar
    final defaultLeft = screenSize.width - buttonWidth - 18;
    final defaultTop = screenSize.height - buttonHeight - 110;

    final currentLeft = _position?.dx ?? defaultLeft;
    final currentTop = _position?.dy ?? defaultTop;

    return Positioned(
      left: currentLeft,
      top: currentTop,
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            final newX = (currentLeft + details.delta.dx).clamp(
              10.0,
              screenSize.width - buttonWidth - 10.0,
            );
            final newTop = (currentTop + details.delta.dy).clamp(
              padding.top + 50.0,
              screenSize.height - buttonHeight - 80.0,
            );
            _position = Offset(newX, newTop);
          });
        },
        onTap: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const JarvisAssistantScreen()),
          );
          if (result != null && result is Map && result['success'] == true && context.mounted) {
            context.read<ReportProvider>().loadReports();
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: const Color(0xFF0F172A),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: const BorderSide(color: Color(0xFF10B981), width: 1.5),
                ),
                title: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 28),
                    SizedBox(width: 10),
                    Text(
                      'Laporan & PDF Selesai!',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Laporan ${result['idRHK'] ?? 'RHK'} berhasil disimpan dan file PDF resmi telah dibuat serta diunggah ke Google Drive.',
                      style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Status: Selesai (File PDF Resmi Terbit)',
                              style: TextStyle(
                                color: Color(0xFF10B981),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                actions: [
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    ),
                    child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          }
        },
        child: AnimatedBuilder(
          animation: _animController,
          builder: (context, child) {
            final glowRadius = 8 + (_animController.value * 8);
            return Container(
              width: buttonWidth,
              height: buttonHeight,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00F0FF).withOpacity(0.4 + (_animController.value * 0.3)),
                    blurRadius: glowRadius,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  // Outer Ring Neon Gradient
                  Container(
                    width: 66,
                    height: 66,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF00F0FF), Color(0xFF0A84FF), Color(0xFFFFD700)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.9),
                        width: 1.5,
                      ),
                    ),
                  ),
                  // Inner Circular Avatar with Zoomed Aspend icon - NO BLACK GAPS
                  Container(
                    width: 60,
                    height: 60,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                    ),
                    child: ClipOval(
                      child: Transform.scale(
                        scale: 1.25, // Zoomed in agar tidak ada celah hitam di pinggirnya
                        child: Image.asset(
                          'assets/images/app_icon.png',
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.auto_awesome,
                            color: Color(0xFF00F0FF),
                            size: 28,
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Pulsing Online Green Dot
                  Positioned(
                    top: 2,
                    right: 4,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: Colors.greenAccent,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.greenAccent.withOpacity(0.8),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

