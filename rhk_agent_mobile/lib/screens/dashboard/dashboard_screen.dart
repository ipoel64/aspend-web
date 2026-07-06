import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:marquee/marquee.dart';
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

/// Dashboard Screen — Statistik + Riwayat Laporan + Filter
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final TextEditingController _searchController = TextEditingController();
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
    _searchController.dispose();
    super.dispose();
  }

  void _resetFilters() {
    setState(() {
      _searchController.clear();
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
      body: RefreshIndicator(
        color: AppColors.navy,
        onRefresh: () => context.read<ReportProvider>().loadReports(),
        child: CustomScrollView(
          slivers: [
            // App Bar
            SliverAppBar(
              expandedHeight: 140,
              floating: false,
              pinned: true,
              backgroundColor: AppColors.navy,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.navyDark, AppColors.navy],
                    ),
                  ),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
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
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Selamat Datang',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.white.withOpacity(0.7),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      auth.userProfile?.nama.isNotEmpty == true
                                          ? auth.userProfile!.nama
                                          : (auth.currentUser?.displayName ?? 'Pengguna'),
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              // Google Drive Folder Link
                              IconButton(
                                onPressed: _openGoogleDriveFolder,
                                icon: const Icon(Icons.folder_shared_rounded, color: Colors.white),
                                tooltip: 'Folder Penyimpanan Drive',
                              ),
                              // Notification / Refresh
                              IconButton(
                                onPressed: () => context.read<ReportProvider>().loadReports(),
                                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                              ),
                              // Settings Gear Icon
                              IconButton(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => const SettingsScreen()),
                                  );
                                },
                                icon: const Icon(Icons.settings_rounded, color: Colors.white),
                                tooltip: 'Pengaturan',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                titlePadding: const EdgeInsets.only(left: 20, bottom: 14),
                title: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'RHK',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: SizedBox(
                          height: 16,
                          child: Marquee(
                            text: 'Hasil laporan ini juga dapat dilihat di web (laptop) melalui link : aspend-web.vercel.app',
                            style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 11, fontWeight: FontWeight.w500),
                            scrollAxis: Axis.horizontal,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            blankSpace: 40.0,
                            velocity: 25.0,
                            pauseAfterRound: const Duration(seconds: 2),
                            startPadding: 10.0,
                            accelerationDuration: const Duration(seconds: 1),
                            accelerationCurve: Curves.linear,
                            decelerationDuration: const Duration(milliseconds: 500),
                            decelerationCurve: Curves.easeOut,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                  ],
                ),
              ),
            ),

            // Content
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Stat Cards
                    _buildStatCards(),
                    const SizedBox(height: 20),

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
                          builder: (_, rp, __) => Text(
                            '${rp.filteredReports.length} laporan',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey[500],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
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
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Divider(
                                        color: AppColors.navy.withOpacity(0.3),
                                        thickness: 1,
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 12),
                                      child: Text(
                                        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(parseReportDate(report.tanggal)),
                                        style: TextStyle(
                                          color: AppColors.navy.withOpacity(0.7),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Divider(
                                        color: AppColors.navy.withOpacity(0.3),
                                        thickness: 1,
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
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
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

  Widget _buildFilterSection() {
    final uniqueJenis = getUniqueJenisRHK();

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
          // Search bar
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Cari laporan...',
              hintStyle: TextStyle(color: Colors.grey[400], fontSize: 14),
              prefixIcon: Icon(Icons.search_rounded, color: Colors.grey[400]),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 20),
                      onPressed: () {
                        _searchController.clear();
                        context.read<ReportProvider>().setSearchTerm('');
                      },
                    )
                  : null,
              filled: true,
              fillColor: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (value) {
              context.read<ReportProvider>().setSearchTerm(value);
            },
          ),
          const SizedBox(height: 10),

          // Filter dropdowns row 1
          Row(
            children: [
              // Jenis RHK filter
              Expanded(
                child: _buildFilterDropdown(
                  value: _filterJenis,
                  hint: 'Jenis RHK',
                  items: uniqueJenis.map((j) => DropdownMenuItem(
                    value: j['id'] as String,
                    child: Text(j['id'] as String, style: const TextStyle(fontSize: 13)),
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
              const SizedBox(width: 8),

              // Reset button
              InkWell(
                onTap: _resetFilters,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.refresh_rounded, size: 20, color: Colors.grey[500]),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          
          // Filter row 2
          Row(
            children: [
              // Date filter
              Expanded(
                child: _buildDatePicker(),
              ),
              const SizedBox(width: 8),

              // Month filter
              Expanded(
                child: _buildMonthPicker(),
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
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? AppColors.bgDark : AppColors.bgLight,
        borderRadius: BorderRadius.circular(10),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(hint, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
          isExpanded: true,
          icon: Icon(Icons.keyboard_arrow_down, size: 18, color: Colors.grey[500]),
          style: const TextStyle(fontSize: 13, color: AppColors.navyDark),
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
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
                  fontSize: 12,
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
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
                  fontSize: 12,
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

  void _editReport(Report report) {
    Navigator.pushNamed(context, '/create-report', arguments: report);
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
