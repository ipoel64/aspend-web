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
  final Set<String> _expandedDesa = {};
  final Set<String> _expandedKelompok = {};

  @override
  void initState() {
    super.initState();
    // Refresh data saat masuk halaman
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
          ),
        );
      }
    }
  }

  void _openWhatsApp(String phone, String name) {
    // Ubah format nomor hp ke 62
    String formattedPhone = phone.replaceAll(RegExp(r'\D'), '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62${formattedPhone.substring(1)}';
    } else if (formattedPhone.startsWith('8')) {
      formattedPhone = '62$formattedPhone';
    }
    final message = Uri.encodeComponent("Halo Ibu/Bapak $name, saya pendamping PKH...");
    _launchUrl("https://wa.me/$formattedPhone?text=$message");
  }

  void _openGoogleMaps(double lat, double lng, String label) {
    _launchUrl("https://www.google.com/maps/search/?api=1&query=$lat,$lng");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profil KPM PKH'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<KpmProvider>().fetchKpmList(),
          ),
        ],
      ),
      body: Consumer<KpmProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.kpmList.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.errorMessage != null && provider.kpmList.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 16),
                    Text(
                      provider.errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => provider.fetchKpmList(),
                      child: const Text('Coba Lagi'),
                    ),
                  ],
                ),
              ),
            );
          }

          // Filter data berdasarkan query pencarian
          List<KpmCaretaker> filteredList = provider.kpmList;
          if (_searchQuery.isNotEmpty) {
            filteredList = provider.kpmList.where((kpm) {
              final term = _searchQuery.toLowerCase();
              return kpm.nama.toLowerCase().contains(term) ||
                  kpm.nik.contains(term) ||
                  kpm.noKk.contains(term) ||
                  kpm.namaKelompok.toLowerCase().contains(term) ||
                  kpm.desaKelurahan.toLowerCase().contains(term);
            }).toList();
          }

          // Susun pengelompokan desa & kelompok dari list yang difilter
          final Map<String, Map<String, List<KpmCaretaker>>> grouped = {};
          for (final caretaker in filteredList) {
            final desa = caretaker.desaKelurahan.isEmpty ? 'Belum Diatur' : caretaker.desaKelurahan;
            final kelompok = caretaker.namaKelompok.isEmpty ? 'Belum Diatur' : caretaker.namaKelompok;

            if (!grouped.containsKey(desa)) {
              grouped[desa] = {};
            }
            if (!grouped[desa]!.containsKey(kelompok)) {
              grouped[desa]![kelompok] = [];
            }
            grouped[desa]![kelompok]!.add(caretaker);
          }

          return Column(
            children: [
              _buildHeaderShortcuts(),
              _buildSearchBar(),
              Expanded(
                child: filteredList.isEmpty
                    ? const Center(
                        child: Text(
                          'Tidak ada data KPM ditemukan.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : _buildFolderAccordion(grouped, provider),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const KpmFormScreen()),
          );
        },
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildHeaderShortcuts() {
    return Container(
      color: AppColors.navy,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: _buildShortcutButton(
              icon: Icons.search_outlined,
              label: 'Cek Bansos',
              color: AppColors.gold,
              onTap: () => _launchUrl('https://cekbansos.kemensos.go.id/'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildShortcutButton(
              icon: Icons.language_outlined,
              label: 'SIK-NG',
              color: Colors.lightBlue,
              onTap: () => _launchUrl('https://sik.kemensos.go.id/'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShortcutButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.5)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Colors.grey.shade100,
      child: TextField(
        controller: _searchController,
        onChanged: (val) {
          setState(() {
            _searchQuery = val;
          });
        },
        decoration: InputDecoration(
          hintText: 'Cari nama, NIK, KK, atau kelompok...',
          hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
          prefixIcon: const Icon(Icons.search, size: 20),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () {
                    _searchController.clear();
                    setState(() {
                      _searchQuery = '';
                    });
                  },
                )
              : null,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 8),
        ),
      ),
    );
  }

  Widget _buildFolderAccordion(
    Map<String, Map<String, List<KpmCaretaker>>> grouped,
    KpmProvider provider,
  ) {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: grouped.keys.length,
      itemBuilder: (context, index) {
        final desa = grouped.keys.elementAt(index);
        final kelompokMap = grouped[desa]!;
        final isDesaExpanded = _expandedDesa.contains(desa);

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Column(
            children: [
              // Header Desa (Level 1 Folder)
              ListTile(
                leading: Icon(
                  isDesaExpanded ? Icons.folder_open_rounded : Icons.folder_rounded,
                  color: AppColors.gold,
                  size: 28,
                ),
                title: Text(
                  desa,
                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.navyDark),
                ),
                subtitle: Text(
                  '${kelompokMap.keys.length} Kelompok • ${kelompokMap.values.fold<int>(0, (sum, list) => sum + list.length)} KPM',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
                trailing: Icon(
                  isDesaExpanded ? Icons.expand_less : Icons.expand_more,
                  color: AppColors.navy,
                ),
                onTap: () {
                  setState(() {
                    if (isDesaExpanded) {
                      _expandedDesa.remove(desa);
                    } else {
                      _expandedDesa.add(desa);
                    }
                  });
                },
              ),

              // Sub-kelompok List (Level 2 Sub-folders)
              if (isDesaExpanded)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 4.0),
                  child: Column(
                    children: kelompokMap.keys.map((kelompok) {
                      final kpmList = kelompokMap[kelompok]!;
                      final isKelExpanded = _expandedKelompok.contains('$desa-$kelompok');
                      final ketua = provider.getGroupKetua(desa, kelompok);

                      return Card(
                        color: Colors.blueGrey.shade50.withOpacity(0.5),
                        margin: const EdgeInsets.only(bottom: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.blueGrey.shade100, width: 0.5),
                        ),
                        child: Column(
                          children: [
                            // Header Kelompok
                            ListTile(
                              dense: true,
                              leading: const Icon(
                                Icons.group_work_rounded,
                                color: AppColors.navy,
                                size: 20,
                              ),
                              title: Text(
                                kelompok,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                              ),
                              subtitle: Text(
                                'Ketua: ${ketua?.nama ?? "-"} (${kpmList.length} KPM)',
                                style: const TextStyle(fontSize: 11, color: Colors.black54),
                              ),
                              trailing: Icon(
                                isKelExpanded ? Icons.expand_less : Icons.expand_more,
                                size: 18,
                              ),
                              onTap: () {
                                setState(() {
                                  final key = '$desa-$kelompok';
                                  if (isKelExpanded) {
                                    _expandedKelompok.remove(key);
                                  } else {
                                    _expandedKelompok.add(key);
                                  }
                                });
                              },
                            ),

                            // Detail Kelompok (Ketua Info & Koordinat Pertemuan) & Anggota KPM
                            if (isKelExpanded)
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Info Ketua & Kontak
                                    if (ketua != null && ketua.kpmId.isNotEmpty) ...[
                                      _buildGroupActionHeader(ketua),
                                      const SizedBox(height: 8),
                                      const Divider(height: 1),
                                      const SizedBox(height: 8),
                                    ],
                                    // Member List header
                                    const Padding(
                                      padding: EdgeInsets.only(left: 4, bottom: 6),
                                      child: Text(
                                        'ANGGOTA KELOMPOK:',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ),
                                    // List Anggota
                                    ...kpmList.map((kpm) => _buildKpmTile(kpm)),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildGroupActionHeader(KpmCaretaker ketua) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.star, color: Colors.orange, size: 16),
              const SizedBox(width: 4),
              Text(
                'Ketua Kelompok: ${ketua.nama}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Hubungi Ketua via WhatsApp
              TextButton.icon(
                onPressed: ketua.noHp == '-' ? null : () => _openWhatsApp(ketua.noHp, ketua.nama),
                icon: const Icon(Icons.phone_iphone_rounded, size: 16, color: Colors.green),
                label: Text(
                  ketua.noHp,
                  style: const TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.bold),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  backgroundColor: Colors.green.shade50,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              // Titik Koordinat Pertemuan (menggunakan GPS rumah Ketua)
              Consumer<KpmProvider>(
                builder: (context, provider, _) {
                  return FutureBuilder<KpmProfile?>(
                    future: provider.fetchKpmProfileDetails(ketua.kpmId),
                    builder: (context, snapshot) {
                      final lat = snapshot.data?.house.latitude ?? 0.0;
                      final lng = snapshot.data?.house.longitude ?? 0.0;
                      final hasCoords = lat != 0.0 && lng != 0.0;

                      return TextButton.icon(
                        onPressed: !hasCoords
                            ? null
                            : () => _openGoogleMaps(lat, lng, 'Pertemuan Kelompok ${ketua.namaKelompok}'),
                        icon: Icon(Icons.location_on, size: 16, color: hasCoords ? Colors.red : Colors.grey),
                        label: Text(
                          hasCoords ? 'Peta Pertemuan' : 'No GPS',
                          style: TextStyle(
                            fontSize: 12,
                            color: hasCoords ? Colors.red : Colors.grey,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          backgroundColor: hasCoords ? Colors.red.shade50 : Colors.grey.shade100,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      );
                    },
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKpmTile(KpmCaretaker kpm) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      dense: true,
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: AppColors.navy.withOpacity(0.1),
        backgroundImage: kpm.fotoWajah.isNotEmpty
            ? NetworkImage('https://drive.google.com/thumbnail?id=${kpm.fotoWajah}&sz=w100')
            : null,
        child: kpm.fotoWajah.isEmpty
            ? const Icon(Icons.person, size: 18, color: AppColors.navy)
            : null,
      ),
      title: Text(
        kpm.nama,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
      ),
      subtitle: Text(
        'NIK: ${kpm.nik} • ${kpm.pekerjaan}',
        style: const TextStyle(fontSize: 11, color: Colors.grey),
      ),
      trailing: const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.grey),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => KpmDetailScreen(kpmId: kpm.kpmId),
          ),
        );
      },
    );
  }
}
