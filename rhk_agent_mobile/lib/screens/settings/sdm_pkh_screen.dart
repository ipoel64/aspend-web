import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../models/sdm_pkh.dart';
import '../../providers/auth_provider.dart';
import '../../services/sdm_pkh_service.dart';

class SdmPkhScreen extends StatefulWidget {
  const SdmPkhScreen({super.key});

  @override
  State<SdmPkhScreen> createState() => _SdmPkhScreenState();
}

class _SdmPkhScreenState extends State<SdmPkhScreen> {
  final SdmPkhService _service = SdmPkhService.instance;
  List<SdmPkh> _allList = [];
  List<SdmPkh> _filteredList = [];
  bool _isLoading = true;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData({bool forceSync = false}) async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final auth = context.read<AuthProvider>();
      List<SdmPkh> list;
      if (forceSync || (auth.sheetsService != null && auth.spreadsheetId != null)) {
        list = await _service.syncWithSheets(
          sheetsService: auth.sheetsService,
          spreadsheetId: auth.spreadsheetId,
        );
      } else {
        list = await _service.getList();
      }
      if (mounted) {
        setState(() {
          _allList = list;
          _applySearch();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        final list = await _service.getList();
        setState(() {
          _allList = list;
          _applySearch();
          _isLoading = false;
        });
      }
    }
  }

  void _applySearch() {
    if (_searchQuery.trim().isEmpty) {
      _filteredList = List.from(_allList);
    } else {
      final q = _searchQuery.toLowerCase().trim();
      _filteredList = _allList.where((e) {
        return e.nama.toLowerCase().contains(q) || e.nip.toLowerCase().contains(q);
      }).toList();
    }
  }

  Future<void> _showAddEditDialog([SdmPkh? sdm]) async {
    final isEdit = sdm != null;
    final namaController = TextEditingController(text: sdm?.nama ?? '');
    final nipController = TextEditingController(text: sdm?.nip ?? '');
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(
                isEdit ? Icons.edit_rounded : Icons.person_add_rounded,
                color: AppColors.teal,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                isEdit ? 'Edit SDM PKH' : 'Tambah SDM PKH',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ],
          ),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: namaController,
                    decoration: InputDecoration(
                      labelText: 'Nama Lengkap SDM *',
                      hintText: 'Contoh: Ahmad Fauzi, S.Sos',
                      prefixIcon: const Icon(Icons.person_outline_rounded),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Nama tidak boleh kosong' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: nipController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'NIP / No. Identitas Pegawai',
                      hintText: '199001012022031001',
                      prefixIcon: const Icon(Icons.badge_outlined),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.teal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                if (formKey.currentState?.validate() != true) return;
                Navigator.pop(ctx);
                final auth = context.read<AuthProvider>();
                if (isEdit) {
                  await _service.updateSdm(
                    sdm.id,
                    namaController.text,
                    nipController.text,
                    sheetsService: auth.sheetsService,
                    spreadsheetId: auth.spreadsheetId,
                  );
                } else {
                  await _service.addSdm(
                    namaController.text,
                    nipController.text,
                    sheetsService: auth.sheetsService,
                    spreadsheetId: auth.spreadsheetId,
                  );
                }
                _loadData();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(isEdit ? 'Data SDM berhasil diperbarui' : 'SDM PKH berhasil ditambahkan'),
                      backgroundColor: Colors.green[700],
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              child: Text(isEdit ? 'Simpan' : 'Tambah'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _deleteSdm(SdmPkh sdm) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Hapus Data SDM', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('Yakin ingin menghapus ${sdm.nama} dari daftar SDM dampingan?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red[700],
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final auth = context.read<AuthProvider>();
      await _service.deleteSdm(
        sdm.id,
        sheetsService: auth.sheetsService,
        spreadsheetId: auth.spreadsheetId,
      );
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${sdm.nama} berhasil dihapus'),
            backgroundColor: Colors.red[700],
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Data SDM PKH Dampingan',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.sync_rounded),
            tooltip: 'Sinkronisasi dengan Google Sheet / Aspend Web',
            onPressed: () => _loadData(forceSync: true),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.teal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_rounded),
        label: const Text('Tambah SDM'),
        onPressed: () => _showAddEditDialog(),
      ),
      body: Column(
        children: [
          // Search & Action Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: isDark ? Colors.grey[900] : Colors.grey[50],
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Cari Nama atau NIP SDM...',
                    hintStyle: TextStyle(fontSize: 13, color: Colors.grey[500]),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.teal),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchQuery = '';
                                _applySearch();
                              });
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: isDark ? Colors.grey[800] : Colors.white,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[300]!),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[300]!),
                    ),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                      _applySearch();
                    });
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      'Total: ${_allList.length} SDM PKH',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[600],
                      ),
                    ),
                    const Spacer(),
                    InkWell(
                      onTap: () => _loadData(forceSync: true),
                      borderRadius: BorderRadius.circular(8),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.sync_rounded, size: 14, color: AppColors.teal),
                            SizedBox(width: 4),
                            Text(
                              'Sinkron Sheet',
                              style: TextStyle(fontSize: 11, color: AppColors.teal, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Main List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredList.isEmpty
                    ? Center(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: AppColors.teal.withOpacity(0.1),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: AppColors.teal.withOpacity(0.2)),
                                ),
                                child: const Icon(
                                  Icons.people_outline_rounded,
                                  size: 60,
                                  color: AppColors.teal,
                                ),
                              ),
                              const SizedBox(height: 18),
                              Text(
                                _searchQuery.isNotEmpty
                                    ? 'Tidak ada SDM yang cocok dengan pencarian'
                                    : 'Belum Ada Data SDM PKH Dampingan',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _searchQuery.isNotEmpty
                                    ? 'Coba gunakan kata kunci pencarian yang lain'
                                    : 'Tambahkan data SDM PKH dampingan atau sinkronkan dengan database Aspend Web untuk memudahkan pemilihan pendamping saat laporan supervisi P2K2.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                              ),
                              if (_searchQuery.isEmpty) ...[
                                const SizedBox(height: 20),
                                ElevatedButton.icon(
                                  icon: const Icon(Icons.person_add_rounded),
                                  label: const Text('Tambah SDM Pertama'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.teal,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  onPressed: () => _showAddEditDialog(),
                                ),
                              ],
                            ],
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 80),
                        itemCount: _filteredList.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = _filteredList[index];
                          return Card(
                            elevation: 0.8,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(color: Colors.grey.withOpacity(0.18)),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: AppColors.teal.withOpacity(0.12),
                                    child: Text(
                                      item.nama.isNotEmpty ? item.nama[0].toUpperCase() : '?',
                                      style: const TextStyle(
                                        color: AppColors.teal,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.nama,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14.5,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Icon(Icons.badge_outlined, size: 14, color: Colors.grey[600]),
                                            const SizedBox(width: 4),
                                            Text(
                                              item.nip.isNotEmpty ? 'NIP. ${item.nip}' : 'NIP: Belum diisi',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 20, color: AppColors.navy),
                                    tooltip: 'Edit',
                                    onPressed: () => _showAddEditDialog(item),
                                  ),
                                  IconButton(
                                    icon: Icon(Icons.delete_outline_rounded, size: 20, color: Colors.red[600]),
                                    tooltip: 'Hapus',
                                    onPressed: () => _deleteSdm(item),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
