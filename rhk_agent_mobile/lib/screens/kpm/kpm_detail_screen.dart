import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/app_theme.dart';
import '../../models/kpm_model.dart';
import '../../providers/kpm_provider.dart';
import 'kpm_form_screen.dart';

class KpmDetailScreen extends StatefulWidget {
  final String kpmId;

  const KpmDetailScreen({super.key, required this.kpmId});

  @override
  State<KpmDetailScreen> createState() => _KpmDetailScreenState();
}

class _KpmDetailScreenState extends State<KpmDetailScreen> {
  KpmProfile? _profile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfileDetails();
  }

  Future<void> _loadProfileDetails() async {
    setState(() => _isLoading = true);
    final details = await context.read<KpmProvider>().fetchKpmProfileDetails(widget.kpmId);
    if (mounted) {
      setState(() {
        _profile = details;
        _isLoading = false;
      });
    }
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus Profil KPM'),
        content: const Text('Apakah Anda yakin ingin menghapus data KPM ini secara permanen dari database?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await context.read<KpmProvider>().deleteKpmProfile(widget.kpmId);
              if (mounted) {
                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Profil KPM berhasil dihapus.'),
                      backgroundColor: Colors.green,
                    ),
                  );
                  Navigator.pop(context); // Kembali ke daftar
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Gagal menghapus KPM: ${context.read<KpmProvider>().errorMessage}'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
  }

  void _openGoogleMaps(double lat, double lng) {
    final url = Uri.parse("https://www.google.com/maps/search/?api=1&query=$lat,$lng");
    launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Memuat Profil...'), backgroundColor: AppColors.navy, foregroundColor: Colors.white),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_profile == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Error'), backgroundColor: AppColors.navy, foregroundColor: Colors.white),
        body: const Center(child: Text('Profil KPM tidak ditemukan atau gagal dimuat.')),
      );
    }

    final caretaker = _profile!.caretaker;

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(caretaker.nama),
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          elevation: 0,
          actions: [
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () async {
                final result = await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => KpmFormScreen(profile: _profile),
                  ),
                );
                if (result == true) {
                  _loadProfileDetails();
                }
              },
            ),
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.redAccent),
              onPressed: _confirmDelete,
            ),
          ],
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: AppColors.gold,
            tabs: [
              Tab(icon: Icon(Icons.person), text: 'Pengurus'),
              Tab(icon: Icon(Icons.family_restroom), text: 'Komponen'),
              Tab(icon: Icon(Icons.home_work), text: 'Rumah & Usaha'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildPengurusTab(),
            _buildKomponenTab(),
            _buildRumahTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildPengurusTab() {
    final c = _profile!.caretaker;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Foto Profil Wajah & Ringkasan Status
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 50,
                  backgroundColor: AppColors.navy.withOpacity(0.1),
                  backgroundImage: c.fotoWajah.isNotEmpty
                      ? NetworkImage('https://drive.google.com/thumbnail?id=${c.fotoWajah}&sz=w300')
                      : null,
                  child: c.fotoWajah.isEmpty
                      ? const Icon(Icons.person, size: 50, color: AppColors.navy)
                      : null,
                ),
                const SizedBox(height: 12),
                Text(
                  c.nama,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                ),
                const SizedBox(height: 4),
                Chip(
                  label: Text(
                    '${c.status} Kelompok ${c.namaKelompok}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                  backgroundColor: c.status == 'Ketua' ? AppColors.gold : AppColors.navy,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Detail Fields
          _buildCardSection('DATA DIRI PENGURUS', [
            _buildDetailRow(Icons.credit_card, 'NIK KTP', c.nik),
            _buildDetailRow(Icons.badge, 'No. Kartu Keluarga', c.noKk),
            _buildDetailRow(Icons.work, 'Pekerjaan', c.pekerjaan),
            _buildDetailRow(Icons.phone, 'No. HP', c.noHp),
            _buildDetailRow(Icons.calendar_today, 'Tahun Dapat Bansos', c.tahunDapatBansos),
          ]),
          const SizedBox(height: 16),

          _buildCardSection('ALAMAT LENGKAP', [
            _buildDetailRow(Icons.location_city, 'Provinsi', c.provinsi),
            _buildDetailRow(Icons.map, 'Kabupaten/Kota', c.kabKota),
            _buildDetailRow(Icons.location_on, 'Kecamatan', c.kecamatan),
            _buildDetailRow(Icons.home, 'Desa/Kelurahan', c.desaKelurahan),
            _buildDetailRow(Icons.explore, 'Lingkungan/RT/RW', c.lingkungan),
          ]),
          const SizedBox(height: 16),

          _buildCardSection('FOTO DOKUMEN', [
            _buildDocumentPhotoRow('Foto KTP', c.fotoKtp),
            const SizedBox(height: 12),
            _buildDocumentPhotoRow('Foto Kartu Keluarga', c.fotoKk),
            const SizedBox(height: 12),
            _buildDocumentPhotoRow('Foto Buku Tabungan', c.fotoBukuTabungan),
            const SizedBox(height: 12),
            _buildDocumentPhotoRow('Foto KKS', c.fotoKks),
          ]),
        ],
      ),
    );
  }

  Widget _buildKomponenTab() {
    final list = _profile!.komponenList;
    if (list.isEmpty) {
      return const Center(
        child: Text(
          'Tidak ada data komponen PKH.',
          style: TextStyle(color: Colors.grey),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final comp = list[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.navy.withOpacity(0.1),
                  child: Icon(
                    comp.jenisKomponen == 'LANSIA'
                        ? Icons.elderly
                        : comp.jenisKomponen == 'BUMIL'
                            ? Icons.pregnant_woman
                            : comp.jenisKomponen == 'USIA DINI'
                                ? Icons.child_care
                                : Icons.school,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        comp.nama,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navyDark),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${comp.hubunganKeluarga} • Jenis Komponen: ${comp.jenisKomponen}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Jenis Kelamin: ${comp.jenisKelamin == "L" ? "Laki-laki" : "Perempuan"}',
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                      if (comp.kelas.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Sekolah: Kelas ${comp.kelas}',
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ],
                      if (comp.posyandu.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Posyandu: ${comp.posyandu}',
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRumahTab() {
    final h = _profile!.house;
    final hasCoords = h.latitude != 0.0 && h.longitude != 0.0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // GPS Coordinates Card
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.location_on, color: Colors.red, size: 28),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TITIK KOORDINAT RUMAH',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          hasCoords ? '${h.latitude}, ${h.longitude}' : 'Koordinat tidak tersedia',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  if (hasCoords)
                    ElevatedButton(
                      onPressed: () => _openGoogleMaps(h.latitude, h.longitude),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red.shade50,
                        foregroundColor: Colors.red,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Buka Peta'),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Business Status Card
          _buildCardSection('STATUS USAHA KPM', [
            _buildDetailRow(Icons.store, 'Punya Usaha?', h.punyaUsaha == 'Y' ? 'Ya, Punya Usaha' : 'Tidak Punya Usaha'),
            if (h.punyaUsaha == 'Y' && h.namaUsaha.isNotEmpty)
              _buildDetailRow(Icons.branding_watermark, 'Nama Usaha', h.namaUsaha),
            if (h.punyaUsaha == 'Y' && h.fotoUsaha.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildDocumentPhotoRow('Foto Usaha KPM', h.fotoUsaha),
            ]
          ]),
          const SizedBox(height: 16),

          // Photos Card
          _buildCardSection('FOTO KONDISI RUMAH', [
            _buildDocumentPhotoRow('Tampak Luar', h.fotoRumahLuar),
            const SizedBox(height: 12),
            _buildDocumentPhotoRow('Tampak Ruang Tamu', h.fotoRumahTamu),
            const SizedBox(height: 12),
            _buildDocumentPhotoRow('Tampak Kamar Mandi', h.fotoKamarMandi),
          ]),
          const SizedBox(height: 16),

          // Complementarity Bansos & Statement Card
          _buildCardSection('KOMPLEMENTARITAS BANSOS & PERNYATAAN', [
            _buildDetailRow(Icons.volunteer_activism, 'Bansos Lain yang Diterima', h.bansosLain.isEmpty ? '-' : h.bansosLain),
            const SizedBox(height: 12),
            const Text(
              'PERNYATAAN KOMITMEN:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Text(
                h.pernyataan.isEmpty ? '-' : h.pernyataan,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                  color: Colors.amber.shade900,
                ),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _buildCardSection(String title, List<Widget> children) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.grey[600], size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
                const SizedBox(height: 2),
                Text(
                  value.isEmpty ? '-' : value,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.navyDark),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentPhotoRow(String label, String fileId) {
    final hasPhoto = fileId.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: hasPhoto
              ? Image.network(
                  'https://drive.google.com/thumbnail?id=$fileId&sz=w600',
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  loadingBuilder: (ctx, child, loadingProgress) {
                    if (loadingProgress == null) return child;
                    return Container(
                      height: 180,
                      color: Colors.grey.shade200,
                      child: const Center(child: CircularProgressIndicator()),
                    );
                  },
                  errorBuilder: (ctx, err, stack) => Container(
                    height: 180,
                    color: Colors.grey.shade300,
                    child: const Center(child: Icon(Icons.broken_image, size: 36, color: Colors.grey)),
                  ),
                )
              : Container(
                  height: 60,
                  width: double.infinity,
                  color: Colors.grey.shade100,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.image_not_supported_outlined, color: Colors.grey, size: 20),
                      SizedBox(width: 8),
                      Text('Foto belum diunggah', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}
