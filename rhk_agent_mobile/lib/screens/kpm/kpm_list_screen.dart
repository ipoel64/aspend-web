import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/app_theme.dart';
import '../../models/kpm_model.dart';
import '../../providers/kpm_provider.dart';
import 'kpm_detail_screen.dart';
import 'kpm_form_screen.dart';

class KpmListScreen extends StatefulWidget {
  const KpmListScreen({super.key});

  @override
  State<KpmListScreen> createState() => _KpmListScreenState();
}

class _KpmListScreenState extends State<KpmListScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String? _selectedKelompok; // null = semua kelompok

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<KpmProvider>().fetchKpmList();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _launchUrl(String urlString) async {
    final Uri url = Uri.parse(urlString);
    try {
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw 'Gagal membuka $urlString';
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal membuka link: $e'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _openWhatsApp(String phone, String name) {
    String formattedPhone = phone.replaceAll(RegExp(r'\D'), '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62${formattedPhone.substring(1)}';
    } else if (formattedPhone.startsWith('8')) {
      formattedPhone = '62$formattedPhone';
    }
    final message = Uri.encodeComponent("Halo Ibu/Bapak $name, saya pendamping PKH...");
    _launchUrl("https://wa.me/$formattedPhone?text=$message");
  }

  List<Color> _getGroupGradient(int index) {
    const gradients = [
      [Color(0xFF0284C7), Color(0xFF0369A1)], // Ocean
      [Color(0xFF7C3AED), Color(0xFF6D28D9)], // Purple
      [Color(0xFF059669), Color(0xFF047857)], // Emerald
      [Color(0xFFD97706), Color(0xFFB45309)], // Amber
      [Color(0xFFDB2777), Color(0xFFBE185D)], // Rose
      [Color(0xFF0D9488), Color(0xFF0F766E)], // Teal
      [Color(0xFF4F46E5), Color(0xFF4338CA)], // Indigo
      [Color(0xFFE11D48), Color(0xFFBE123C)], // Crimson
    ];
    return gradients[index % gradients.length];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text(
          'Data KPM',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Segarkan Data',
            onPressed: () => context.read<KpmProvider>().fetchKpmList(),
          ),
          IconButton(
            icon: const Icon(Icons.person_add_alt_1_rounded),
            tooltip: 'Tambah KPM',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const KpmFormScreen()),
              );
            },
          ),
        ],
      ),
      body: Consumer<KpmProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.kpmList.isEmpty) {
            return const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation(AppColors.navy),
              ),
            );
          }

          if (provider.errorMessage != null && provider.kpmList.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 54, color: Colors.red),
                    const SizedBox(height: 16),
                    Text(
                      provider.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => provider.fetchKpmList(),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.navy,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Coba Lagi'),
                    ),
                  ],
                ),
              ),
            );
          }

          final allKpm = provider.kpmList;

          // Hitung daftar kelompok unik beserta jumlah anggotanya
          final Map<String, List<KpmCaretaker>> groupMap = {};
          final Set<String> desaSet = {};
          for (final k in allKpm) {
            final kelompok = k.namaKelompok.trim().isNotEmpty ? k.namaKelompok.trim() : 'Tanpa Kelompok';
            groupMap.putIfAbsent(kelompok, () => []).add(k);
            if (k.desaKelurahan.trim().isNotEmpty) {
              desaSet.add(k.desaKelurahan.trim());
            }
          }
          final groupNames = groupMap.keys.toList()..sort();

          // Filter daftar KPM:
          // 1. Berdasarkan Kelompok yang sedang dipilih (jika ada)
          // 2. Berdasarkan input pencarian
          List<KpmCaretaker> displayList = allKpm;
          if (_selectedKelompok != null) {
            displayList = displayList.where((k) {
              final kKelompok = k.namaKelompok.trim().isNotEmpty ? k.namaKelompok.trim() : 'Tanpa Kelompok';
              return kKelompok.toLowerCase() == _selectedKelompok!.toLowerCase();
            }).toList();
          }

          if (_searchQuery.trim().isNotEmpty) {
            final q = _searchQuery.toLowerCase().trim();
            displayList = displayList.where((k) {
              return k.nama.toLowerCase().contains(q) ||
                  k.nik.contains(q) ||
                  k.noKk.contains(q) ||
                  k.namaKelompok.toLowerCase().contains(q) ||
                  k.desaKelurahan.toLowerCase().contains(q);
            }).toList();
          }

          return RefreshIndicator(
            color: AppColors.navy,
            onRefresh: () => provider.fetchKpmList(),
            child: CustomScrollView(
              slivers: [
                // ── Bagian Header: Statistik & Pencarian ──
                SliverToBoxAdapter(
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.navy, AppColors.navyDark],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                      borderRadius: BorderRadius.only(
                        bottomLeft: Radius.circular(22),
                        bottomRight: Radius.circular(22),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Statistik Ringkas
                        Row(
                          children: [
                            _buildStatBadge(
                              icon: Icons.people_alt_rounded,
                              label: 'Total KPM',
                              value: '${allKpm.length}',
                              color: AppColors.gold,
                            ),
                            const SizedBox(width: 10),
                            _buildStatBadge(
                              icon: Icons.group_work_rounded,
                              label: 'Kelompok',
                              value: '${groupNames.length}',
                              color: const Color(0xFF38BDF8),
                            ),
                            const SizedBox(width: 10),
                            _buildStatBadge(
                              icon: Icons.location_city_rounded,
                              label: 'Desa/Kel',
                              value: '${desaSet.length}',
                              color: const Color(0xFF4ADE80),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Input Pencarian
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.08),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: TextField(
                            controller: _searchController,
                            onChanged: (val) => setState(() => _searchQuery = val),
                            decoration: InputDecoration(
                              hintText: 'Cari nama KPM, NIK, No KK, atau desa...',
                              hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
                              prefixIcon: const Icon(Icons.search_rounded, color: AppColors.navy, size: 22),
                              suffixIcon: _searchQuery.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(Icons.cancel_rounded, color: Colors.grey, size: 18),
                                      onPressed: () {
                                        _searchController.clear();
                                        setState(() => _searchQuery = '');
                                      },
                                    )
                                  : null,
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Bagian 1: Tampilan Perkelompok dengan Thumbnail Menarik ──
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.auto_awesome_motion_rounded, size: 18, color: AppColors.navy),
                            SizedBox(width: 6),
                            Text(
                              'Kelompok Dampingan',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navyDark,
                              ),
                            ),
                          ],
                        ),
                        if (_selectedKelompok != null)
                          GestureDetector(
                            onTap: () => setState(() => _selectedKelompok = null),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.red.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.close_rounded, size: 13, color: Colors.red),
                                  SizedBox(width: 3),
                                  Text(
                                    'Reset Filter',
                                    style: TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                // Horizontal Carousel Kelompok
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 126,
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      scrollDirection: Axis.horizontal,
                      itemCount: groupNames.length + 1,
                      itemBuilder: (context, idx) {
                        // Kartu 0: "Semua Kelompok"
                        if (idx == 0) {
                          final isSelected = _selectedKelompok == null;
                          return _buildGroupCard(
                            title: 'Semua Kelompok',
                            subtitle: 'Seluruh KPM',
                            count: allKpm.length,
                            isSelected: isSelected,
                            gradient: const [Color(0xFF1E293B), Color(0xFF0F172A)],
                            icon: Icons.all_inclusive_rounded,
                            onTap: () => setState(() => _selectedKelompok = null),
                          );
                        }

                        final gName = groupNames[idx - 1];
                        final members = groupMap[gName] ?? [];
                        final isSelected = _selectedKelompok?.toLowerCase() == gName.toLowerCase();
                        final desa = members.isNotEmpty && members.first.desaKelurahan.isNotEmpty
                            ? members.first.desaKelurahan
                            : 'PKH';
                        final ketua = members.firstWhere(
                          (m) => m.status.toLowerCase() == 'ketua',
                          orElse: () => members.first,
                        );

                        return _buildGroupCard(
                          title: gName,
                          subtitle: desa,
                          ketuaName: ketua.status.toLowerCase() == 'ketua' ? ketua.nama : null,
                          count: members.length,
                          isSelected: isSelected,
                          gradient: _getGroupGradient(idx - 1),
                          icon: Icons.groups_rounded,
                          onTap: () {
                            setState(() {
                              if (_selectedKelompok?.toLowerCase() == gName.toLowerCase()) {
                                _selectedKelompok = null; // Toggle off
                              } else {
                                _selectedKelompok = gName;
                              }
                            });
                          },
                        );
                      },
                    ),
                  ),
                ),

                // ── Bagian 2: Daftar / List Data Nama-Nama KPM Secara Keseluruhan ──
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.badge_rounded, size: 18, color: AppColors.navy),
                            const SizedBox(width: 6),
                            Text(
                              _selectedKelompok == null
                                  ? 'Daftar Seluruh KPM'
                                  : 'Anggota: $_selectedKelompok',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navyDark,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.navy.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${displayList.length} KPM',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppColors.navy,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // List KPM
                if (displayList.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.person_search_rounded, size: 54, color: Colors.grey[300]),
                          const SizedBox(height: 10),
                          Text(
                            _searchQuery.isNotEmpty
                                ? 'Tidak ada KPM yang cocok dengan pencarian'
                                : 'Belum ada data KPM',
                            style: TextStyle(color: Colors.grey[500], fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final kpm = displayList[index];
                          return _buildKpmCardItem(context, kpm, isDark);
                        },
                        childCount: displayList.length,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatBadge({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.15)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 16),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    value,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    label,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroupCard({
    required String title,
    required String subtitle,
    String? ketuaName,
    required int count,
    required bool isSelected,
    required List<Color> gradient,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Container(
      width: 175,
      margin: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isSelected ? gradient : [gradient[0].withOpacity(0.85), gradient[1].withOpacity(0.9)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSelected ? Colors.white : Colors.white.withOpacity(0.2),
                width: isSelected ? 2.5 : 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: isSelected ? gradient[0].withOpacity(0.5) : Colors.black.withOpacity(0.1),
                  blurRadius: isSelected ? 10 : 4,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: Colors.white, size: 18),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$count KPM',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      ketuaName != null ? 'Ketua: $ketuaName' : subtitle,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 10,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKpmCardItem(BuildContext context, KpmCaretaker kpm, bool isDark) {
    final isKetua = kpm.status.trim().toLowerCase() == 'ketua';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isKetua
              ? AppColors.gold.withOpacity(0.6)
              : (isDark ? Colors.white12 : Colors.grey.shade200),
          width: isKetua ? 1.4 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => KpmDetailScreen(kpmId: kpm.kpmId),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Thumbnail / Avatar KPM
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: isKetua ? AppColors.gold.withOpacity(0.2) : AppColors.navy.withOpacity(0.1),
                      backgroundImage: kpm.fotoWajah.isNotEmpty
                          ? NetworkImage('https://drive.google.com/thumbnail?id=${kpm.fotoWajah}&sz=w150')
                          : null,
                      child: kpm.fotoWajah.isEmpty
                          ? Text(
                              kpm.nama.isNotEmpty ? kpm.nama.trim().substring(0, 1).toUpperCase() : 'K',
                              style: TextStyle(
                                color: isKetua ? AppColors.gold : AppColors.navy,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            )
                          : null,
                    ),
                    if (isKetua)
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: AppColors.gold,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.star_rounded, size: 10, color: Colors.white),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                // Informasi KPM
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              kpm.nama,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: isDark ? Colors.white : AppColors.navyDark,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isKetua)
                            Container(
                              margin: const EdgeInsets.only(left: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.gold.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.gold, width: 0.8),
                              ),
                              child: const Text(
                                'Ketua',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Icon(Icons.badge_outlined, size: 12, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            kpm.nik.isNotEmpty ? kpm.nik : 'NIK: -',
                            style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                          ),
                          if (kpm.noKk.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Text('•', style: TextStyle(color: Colors.grey[400], fontSize: 11)),
                            const SizedBox(width: 8),
                            Text(
                              'KK: ${kpm.noKk}',
                              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.location_on_outlined, size: 12, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              '${kpm.namaKelompok.isNotEmpty ? kpm.namaKelompok : "Tanpa Kelompok"} • ${kpm.desaKelurahan.isNotEmpty ? kpm.desaKelurahan : "-"}',
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? const Color(0xFF38BDF8) : const Color(0xFF0284C7),
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Quick Action: WhatsApp & Chevron
                if (kpm.noHp.trim().isNotEmpty && kpm.noHp != '-') ...[
                  IconButton(
                    icon: const Icon(Icons.chat_rounded, color: Color(0xFF22C55E), size: 20),
                    tooltip: 'Hubungi WhatsApp',
                    onPressed: () => _openWhatsApp(kpm.noHp, kpm.nama),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 8),
                ],
                const Icon(Icons.chevron_right_rounded, color: Colors.grey, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
