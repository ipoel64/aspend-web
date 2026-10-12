import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/app_theme.dart';
import '../../config/constants.dart';
import '../../config/master_data.dart';
import '../../models/p2k2_data.dart';
import '../../models/report.dart';
import '../../models/sdm_pkh.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';
import '../../providers/report_provider.dart';
import '../../services/sdm_pkh_service.dart';
import '../../services/wilayah_service.dart';
import '../../widgets/loading_overlay.dart';
import '../../utils/string_utils.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:cached_network_image/cached_network_image.dart';

/// Buat Laporan Screen — Form input lengkap
class CreateReportScreen extends StatefulWidget {
  final String? initialJenisRHK;
  final String? initialIdRHK;
  final String? initialRencanaAksi;
  final DateTime? initialDate;
  final String? initialPukul;
  final String? initialLokasi;
  final String? initialPoin;

  const CreateReportScreen({
    super.key,
    this.initialJenisRHK,
    this.initialIdRHK,
    this.initialRencanaAksi,
    this.initialDate,
    this.initialPukul,
    this.initialLokasi,
    this.initialPoin,
  });

  @override
  State<CreateReportScreen> createState() => _CreateReportScreenState();
}

class _CreateReportScreenState extends State<CreateReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _poinController = TextEditingController();
  final _pukukController = TextEditingController();
  final _lokasiNonP2K2Controller = TextEditingController();

  String? _selectedJenisRHK;
  String? _selectedIdRHK;
  String? _selectedRencanaAksi;
  DateTime _selectedDate = DateTime.now();
  final List<XFile> _selectedPhotos = [];
  final List<String> _existingPhotoIds = [];
  Report? _editingReport;
  bool _isInitialized = false;
  bool _isP2K2 = false;

  // Speech to Text
  final stt.SpeechToText _speechToText = stt.SpeechToText();
  bool _isListening = false;
  String _preSpeechText = '';

  // P2K2 fields
  String? _selectedModul;
  String? _selectedSesi;
  final _jumlahKpmController = TextEditingController();
  final _jumlahHadirController = TextEditingController();
  final _namaKelompokController = TextEditingController();
  final _ketuaKelompokController = TextEditingController();
  final _jumlahSakitController = TextEditingController();
  final _jumlahAlpaController = TextEditingController();
  final _jamSelesaiController = TextEditingController();
  final _tempatPelaksanaanController = TextEditingController();
  final _namaPemateriController = TextEditingController();
  final _jabatanPemateriController = TextEditingController();
  bool _isPemateriDiriSendiri = true;

  // Khusus Supervisi Katim P2K2
  final _namaKetuaTimController = TextEditingController();
  final _namaPendampingController = TextEditingController();
  final _nipPendampingController = TextEditingController();
  final _supervisiKelurahanController = TextEditingController();
  List<SdmPkh> _sdmPkhList = [];
  String? _selectedSdmPkhId;
  bool _isManualPendamping = false;
  bool _isManualKelurahan = false;

  String _supervisiProvinsi = '';
  String _supervisiKabupaten = '';
  String _supervisiKecamatan = '';
  String _supervisiKelurahan = '';
  List<WilayahItem> _supervisiProvinces = [];
  List<WilayahItem> _supervisiRegencies = [];
  List<WilayahItem> _supervisiDistricts = [];
  List<WilayahItem> _supervisiVillages = [];
  bool _loadingSupervisiWilayah = false;

  bool _showTanggalInPdf = true;
  bool _showPukulInPdf = true;

  bool get _isKatimSupervisiP2K2 {
    final auth = context.read<AuthProvider>();
    final jabatan = auth.userProfile?.jabatan ?? '';
    final isKatim = jabatan == 'Katim Kab/Kota' || jabatan == 'Katim Provinsi';
    return isKatim && _selectedRencanaAksi == 'Melakukan Supervisi pelaksanaan P2K2 kepada ASN PPPK';
  }

  @override
  void initState() {
    super.initState();
    _initSpeech();
    if (widget.initialJenisRHK != null) {
      _selectedJenisRHK = widget.initialJenisRHK;
      _selectedIdRHK = widget.initialIdRHK;
      _selectedRencanaAksi = widget.initialRencanaAksi;
      if (widget.initialDate != null) _selectedDate = widget.initialDate!;
      if (widget.initialPukul != null && widget.initialPukul!.isNotEmpty) {
        _pukukController.text = widget.initialPukul!;
      }
      if (widget.initialLokasi != null && widget.initialLokasi!.isNotEmpty) {
        _lokasiNonP2K2Controller.text = widget.initialLokasi!;
        _tempatPelaksanaanController.text = widget.initialLokasi!;
      }
      if (widget.initialPoin != null && widget.initialPoin!.isNotEmpty) {
        _poinController.text = widget.initialPoin!;
      }
      if (_selectedJenisRHK != null) {
        _isP2K2 = isP2K2(_selectedJenisRHK!);
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isInitialized) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Report) {
        _editingReport = args;
        _selectedJenisRHK = args.jenisRHK;
        _selectedIdRHK = args.idRHK;
        _selectedRencanaAksi = args.rencanaAksi;
        try {
          _selectedDate = DateTime.parse(args.tanggal);
        } catch (_) {}
        _pukukController.text = args.pukul;
        _poinController.text = args.poinKegiatan;
        _existingPhotoIds.addAll(args.fotoIds);
        _lokasiNonP2K2Controller.text = args.physicalLokasi;
        _showTanggalInPdf = args.showTanggalInPdf;
        _showPukulInPdf = args.showPukulInPdf;
        _isP2K2 = isP2K2(args.jenisRHK);
        if (_isP2K2 && args.p2k2Data != null) {
          _selectedModul = args.p2k2Data!.modul;
          _selectedSesi = args.p2k2Data!.sesi;
          _jumlahKpmController.text = args.p2k2Data!.jumlahKPM;
          _jumlahHadirController.text = args.p2k2Data!.jumlahHadir;
          _jumlahSakitController.text = args.p2k2Data!.jumlahSakit;
          _jumlahAlpaController.text = args.p2k2Data!.jumlahAlpa;
          _namaKelompokController.text = args.p2k2Data!.namaKelompok;
          _ketuaKelompokController.text = args.p2k2Data!.ketuaKelompok;
          _jamSelesaiController.text = args.p2k2Data!.jamSelesai;
          _tempatPelaksanaanController.text = args.p2k2Data!.tempatPelaksanaan;
          _namaPemateriController.text = args.p2k2Data!.namaPemateri;
          _jabatanPemateriController.text = args.p2k2Data!.jabatanPemateri;
          _isPemateriDiriSendiri = args.p2k2Data!.isPemateriDiriSendiri;

          // Supervisi P2K2 data
          _namaKetuaTimController.text = args.p2k2Data!.namaKetuaTim;
          _namaPendampingController.text = args.p2k2Data!.namaPendamping;
          _nipPendampingController.text = args.p2k2Data!.nipPendamping;
          _supervisiProvinsi = args.p2k2Data!.provinsi;
          _supervisiKabupaten = args.p2k2Data!.kabupatenKota;
          _supervisiKecamatan = args.p2k2Data!.kecamatan;
          _supervisiKelurahan = args.p2k2Data!.desaKelurahan;
          _supervisiKelurahanController.text = args.p2k2Data!.desaKelurahan;
        }
        if (_isKatimSupervisiP2K2 || args.p2k2Data?.isSupervisi == true) {
          _initSupervisiData();
        }
      }
      _isInitialized = true;
    }
  }

  void _initSpeech() async {
    await _speechToText.initialize(
      onError: (val) {
        debugPrint('onError: $val');
        if (mounted && _isListening) {
          _preSpeechText = _poinController.text;
          Future.delayed(const Duration(milliseconds: 100), _triggerListen);
        }
      },
      onStatus: (val) {
        debugPrint('onStatus: $val');
        if (val == 'done' || val == 'notListening') {
          if (mounted) {
            if (_isListening) {
              // Jika berhenti karena jeda tapi user belum stop manual, mulai lagi
              _preSpeechText = _poinController.text;
              Future.delayed(const Duration(milliseconds: 100), _triggerListen);
            } else {
              setState(() {
                _isListening = false;
              });
            }
          }
        }
      },
    );
    setState(() {});
  }

  void _startListening() async {
    setState(() {
      _isListening = true;
    });
    _preSpeechText = _poinController.text;
    _triggerListen();
  }

  void _triggerListen() async {
    if (!mounted || !_isListening) return;

    final space = _preSpeechText.isNotEmpty && !_preSpeechText.endsWith(' ') ? ' ' : '';
    
    await _speechToText.listen(
      onResult: (result) {
        if (!_isListening) return;
        setState(() {
          _poinController.text = _preSpeechText + space + result.recognizedWords;
          _poinController.selection = TextSelection.fromPosition(
            TextPosition(offset: _poinController.text.length),
          );
        });
      },
      localeId: 'id_ID',
      partialResults: true,
      listenMode: stt.ListenMode.dictation,
      cancelOnError: false,
    );
  }

  void _stopListening() async {
    setState(() {
      _isListening = false;
    });
    await _speechToText.stop();
  }

  void _showImagePreview(String? url, String? filePath) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(8),
        child: Stack(
          alignment: Alignment.center,
          children: [
            InteractiveViewer(
              panEnabled: true,
              minScale: 0.5,
              maxScale: 4.0,
              child: url != null
                  ? CachedNetworkImage(
                      imageUrl: url,
                      fit: BoxFit.contain,
                      placeholder: (_, __) => const Center(child: CircularProgressIndicator(color: Colors.white)),
                      errorWidget: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white, size: 60),
                    )
                  : Image.file(
                      File(filePath!),
                      fit: BoxFit.contain,
                    ),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 30),
                onPressed: () => Navigator.pop(ctx),
                style: IconButton.styleFrom(backgroundColor: Colors.black54),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showPoinHistory() async {
    if (_selectedIdRHK == null || _selectedIdRHK!.isEmpty) {
      _showError('Silakan pilih Jenis RHK terlebih dahulu');
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final history = prefs.getStringList('poin_history_${_selectedIdRHK}') ?? [];

    if (history.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Belum ada riwayat poin untuk ${_selectedIdRHK}'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      return;
    }

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Riwayat Poin ${_selectedIdRHK}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navyDark,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.clear, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Pilih poin untuk menyalin ke input:',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: history.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) {
                    final item = history[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        item,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13),
                      ),
                      trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                      onTap: () {
                        setState(() {
                          _poinController.text = item;
                        });
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _poinController.dispose();
    _pukukController.dispose();
    _lokasiNonP2K2Controller.dispose();
    _jumlahKpmController.dispose();
    _jumlahHadirController.dispose();
    _namaKelompokController.dispose();
    _ketuaKelompokController.dispose();
    _jumlahSakitController.dispose();
    _jumlahAlpaController.dispose();
    _jamSelesaiController.dispose();
    _tempatPelaksanaanController.dispose();
    _namaPemateriController.dispose();
    _jabatanPemateriController.dispose();
    _namaKetuaTimController.dispose();
    _namaPendampingController.dispose();
    _nipPendampingController.dispose();
    _supervisiKelurahanController.dispose();
    super.dispose();
  }

  Future<void> _initSupervisiData() async {
    final auth = context.read<AuthProvider>();
    final profile = auth.userProfile;
    final jabatan = profile?.jabatan ?? '';

    // Load SDM PKH
    try {
      final sdmList = (auth.sheetsService != null && auth.spreadsheetId != null)
          ? await SdmPkhService.instance.syncWithSheets(
              sheetsService: auth.sheetsService,
              spreadsheetId: auth.spreadsheetId,
            )
          : await SdmPkhService.instance.getList();
      if (mounted) {
        setState(() {
          _sdmPkhList = sdmList;
          if (_namaPendampingController.text.isNotEmpty) {
            final match = sdmList.firstWhere(
              (s) => s.nama.trim().toUpperCase() == _namaPendampingController.text.trim().toUpperCase(),
              orElse: () => SdmPkh(id: '', nama: '', nip: ''),
            );
            if (match.id.isNotEmpty) {
              _selectedSdmPkhId = match.id;
            } else {
              _selectedSdmPkhId = '__custom__';
              _isManualPendamping = true;
            }
          }
        });
      }
    } catch (_) {}

    // Init Katim Name from profile
    if (_namaKetuaTimController.text.isEmpty && profile != null && profile.nama.isNotEmpty) {
      _namaKetuaTimController.text = profile.nama;
    }

    // Init Wilayah
    setState(() => _loadingSupervisiWilayah = true);
    try {
      final provinces = await WilayahService.instance.getProvinces();
      if (!mounted) return;
      setState(() => _supervisiProvinces = provinces);

      final isKatimKabKota = jabatan == 'Katim Kab/Kota';

      if (_supervisiProvinsi.isEmpty && profile != null && profile.provinsi.isNotEmpty) {
        _supervisiProvinsi = profile.provinsi;
      }

      if (isKatimKabKota) {
        if (_supervisiKabupaten.isEmpty && profile != null && profile.kabupatenKota.isNotEmpty) {
          _supervisiKabupaten = profile.kabupatenKota;
        }
      }

      if (_supervisiProvinsi.isNotEmpty) {
        await _fetchSupervisiRegencies(_supervisiProvinsi);
      }

      if (_supervisiKabupaten.isNotEmpty) {
        await _fetchSupervisiDistricts(_supervisiKabupaten, _supervisiProvinsi);
      }

      if (_supervisiKecamatan.isNotEmpty) {
        await _fetchSupervisiVillages(_supervisiKecamatan);
      }
    } catch (_) {} finally {
      if (mounted) {
        setState(() => _loadingSupervisiWilayah = false);
      }
    }
  }

  Future<void> _fetchSupervisiRegencies(String provName) async {
    if (provName.isEmpty) return;
    if (_supervisiProvinces.isEmpty) {
      _supervisiProvinces = await WilayahService.instance.getProvinces();
    }
    final matchedP = _supervisiProvinces.firstWhere(
      (p) => p.name.toUpperCase() == provName.toUpperCase(),
      orElse: () => WilayahItem(id: '', name: ''),
    );
    if (matchedP.id.isNotEmpty) {
      final rList = await WilayahService.instance.getRegencies(matchedP.id);
      if (mounted) {
        setState(() => _supervisiRegencies = rList);
      }
    }
  }

  Future<void> _fetchSupervisiDistricts(String kabName, [String? provName]) async {
    if (kabName.isEmpty) return;
    if (_supervisiRegencies.isEmpty && provName != null && provName.isNotEmpty) {
      await _fetchSupervisiRegencies(provName);
    }
    final matchedR = _supervisiRegencies.firstWhere(
      (r) {
        final rName = r.name.toUpperCase().replaceAll('KABUPATEN ', '').replaceAll('KOTA ', '').trim();
        final target = kabName.toUpperCase().replaceAll('KABUPATEN ', '').replaceAll('KOTA ', '').trim();
        return r.name.toUpperCase() == kabName.toUpperCase() || rName == target;
      },
      orElse: () => WilayahItem(id: '', name: ''),
    );
    if (matchedR.id.isNotEmpty) {
      final dList = await WilayahService.instance.getDistricts(matchedR.id);
      if (mounted) {
        setState(() => _supervisiDistricts = dList);
      }
    }
  }

  Future<void> _fetchSupervisiVillages(String kecName) async {
    if (kecName.isEmpty) return;
    final matchedD = _supervisiDistricts.firstWhere(
      (d) {
        final dName = d.name.toUpperCase().replaceAll('KECAMATAN ', '').trim();
        final target = kecName.toUpperCase().replaceAll('KECAMATAN ', '').trim();
        return d.name.toUpperCase() == kecName.toUpperCase() || dName == target;
      },
      orElse: () => WilayahItem(id: '', name: ''),
    );
    if (matchedD.id.isNotEmpty) {
      final vList = await WilayahService.instance.getVillages(matchedD.id);
      if (mounted) {
        setState(() => _supervisiVillages = vList);
      }
    }
  }

  void _onSupervisiKabupatenChanged(String? name) async {
    if (name == null || name == _supervisiKabupaten) return;
    setState(() {
      _supervisiKabupaten = name;
      _supervisiKecamatan = '';
      _supervisiKelurahan = '';
      _supervisiKelurahanController.clear();
      _supervisiDistricts = [];
      _supervisiVillages = [];
    });
    await _fetchSupervisiDistricts(name, _supervisiProvinsi);
  }

  void _onSupervisiKecamatanChanged(String? name) async {
    if (name == null || name == _supervisiKecamatan) return;
    setState(() {
      _supervisiKecamatan = name;
      _supervisiKelurahan = '';
      _supervisiKelurahanController.clear();
      _supervisiVillages = [];
    });
    await _fetchSupervisiVillages(name);
  }

  void _onSupervisiKelurahanChanged(String? name) {
    if (name == null) return;
    setState(() {
      _supervisiKelurahan = name;
      _supervisiKelurahanController.text = name;
    });
  }

  Widget _buildWilayahSupervisiDropdown({
    required String label,
    required String value,
    required List<String> items,
    required String hint,
    required IconData icon,
    required void Function(String?) onChanged,
    bool isLoading = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final safeItems = List<String>.from(items);
    if (value.isNotEmpty && !safeItems.contains(value)) {
      safeItems.insert(0, value);
    }
    final selectedVal = value.isNotEmpty && safeItems.contains(value) ? value : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: selectedVal,
          hint: isLoading
              ? Row(
                  children: [
                    const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 8),
                    Text('Memuat $label...', style: TextStyle(fontSize: 13, color: Colors.grey[400])),
                  ],
                )
              : Text(hint, style: TextStyle(fontSize: 13, color: Colors.grey[400])),
          isExpanded: true,
          itemHeight: null,
          icon: const Icon(Icons.arrow_drop_down_rounded, color: AppColors.navy),
          selectedItemBuilder: (context) {
            return safeItems.map((item) => Align(
              alignment: Alignment.centerLeft,
              child: Text(
                item,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            )).toList();
          },
          items: safeItems.map((item) => DropdownMenuItem(
            value: item,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(item, style: const TextStyle(fontSize: 12.5)),
            ),
          )).toList(),
          onChanged: isLoading ? null : onChanged,
        ),
      ),
    );
  }

  Widget _buildPendampingSupervisiDropdown() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_sdmPkhList.isEmpty || _isManualPendamping) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildTextField(
            controller: _namaPendampingController,
            hint: 'Nama Lengkap Pendamping',
            icon: Icons.person_outline_rounded,
            onChanged: (val) {
              if (!_isPemateriDiriSendiri) {
                _namaPemateriController.text = val;
              }
            },
          ),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _nipPendampingController,
            hint: 'NIP / ID Pendamping (opsional)',
            icon: Icons.badge_outlined,
          ),
          if (_sdmPkhList.isNotEmpty) ...[
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () {
                  setState(() => _isManualPendamping = false);
                },
                icon: const Icon(Icons.list_alt_rounded, size: 16, color: AppColors.teal),
                label: const Text('Pilih dari Master SDM', style: TextStyle(fontSize: 12, color: AppColors.teal, fontWeight: FontWeight.bold)),
              ),
            ),
          ] else ...[
            const SizedBox(height: 4),
            Text(
              '💡 Tips: Anda dapat menambahkan master data SDM PKH Dampingan di menu Pengaturan.',
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
            ),
          ],
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Builder(
          builder: (context) {
            final hasMatch = _selectedSdmPkhId != null &&
                (_selectedSdmPkhId == '__custom__' || _sdmPkhList.any((s) => s.id == _selectedSdmPkhId));
            final safeSdmId = hasMatch ? _selectedSdmPkhId : null;

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Theme.of(context).cardTheme.color ?? Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: safeSdmId,
                  hint: const Text('Pilih Pendamping yang Disupervisi', style: TextStyle(fontSize: 13)),
              isExpanded: true,
              itemHeight: null,
              items: [
                ..._sdmPkhList.map((sdm) {
                  final nipInfo = sdm.nip.isNotEmpty ? ' (NIP: ${sdm.nip})' : '';
                  return DropdownMenuItem<String>(
                    value: sdm.id,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        '${sdm.nama}$nipInfo',
                        style: const TextStyle(fontSize: 12.5),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  );
                }),
                const DropdownMenuItem<String>(
                  value: '__custom__',
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      '+ Ketik Nama Manual...',
                      style: TextStyle(fontSize: 12.5, color: AppColors.teal, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
              onChanged: (val) {
                if (val == '__custom__') {
                  setState(() {
                    _isManualPendamping = true;
                    _selectedSdmPkhId = '__custom__';
                    _namaPendampingController.clear();
                    _nipPendampingController.clear();
                  });
                } else if (val != null) {
                  final sdm = _sdmPkhList.firstWhere(
                    (s) => s.id == val,
                    orElse: () => SdmPkh(id: '', nama: '', nip: ''),
                  );
                  setState(() {
                    _selectedSdmPkhId = val;
                    _namaPendampingController.text = sdm.nama;
                    _nipPendampingController.text = sdm.nip;
                    if (!_isPemateriDiriSendiri) {
                      _namaPemateriController.text = sdm.nama;
                      _jabatanPemateriController.text = 'Pendamping PKH';
                    }
                  });
                }
              },
            ),
          ),
        );
      },
    ),
  ],
);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(_editingReport != null ? 'Edit Laporan' : 'Buat Laporan'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: true,
      ),
      body: Consumer<FormProvider>(
        builder: (context, formProvider, _) {
          return Stack(
            children: [
              Form(
                key: _formKey,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Jenis RHK Dropdown
                      _buildSectionTitle('Jenis RHK', isRequired: true),
                      _buildJenisRHKDropdown(),
                      const SizedBox(height: 16),

                      // Rencana Aksi Dropdown
                      if (_selectedJenisRHK != null) ...[
                        _buildSectionTitle('Rencana Aksi', isRequired: true),
                        _buildRencanaAksiDropdown(),
                        const SizedBox(height: 16),
                      ],

                      // Tanggal
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildSectionTitle('Tanggal Kegiatan', isRequired: true),
                          _buildPdfCheckbox(
                            value: _showTanggalInPdf,
                            onChanged: (val) => setState(() => _showTanggalInPdf = val ?? true),
                          ),
                        ],
                      ),
                      _buildDatePicker(),
                      const SizedBox(height: 16),

                      // Pukul
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildSectionTitle('Pukul Kegiatan', isRequired: true),
                          _buildPdfCheckbox(
                            value: _showPukulInPdf,
                            onChanged: (val) => setState(() => _showPukulInPdf = val ?? true),
                          ),
                        ],
                      ),
                      _buildTimePicker(),
                      const SizedBox(height: 16),

                      // Lokasi Kegiatan (untuk selain RHK P2K2)
                      if (!_isP2K2) ...[
                        _buildSectionTitle('Lokasi Kegiatan', isRequired: true),
                        _buildTextField(
                          controller: _lokasiNonP2K2Controller,
                          hint: 'Contoh: Balai Desa / Rumah KPM / Kantor Kecamatan',
                          icon: Icons.place_rounded,
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Poin Kegiatan
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildSectionTitle('Poin-poin Kegiatan', isRequired: true),
                          TextButton.icon(
                            onPressed: _showPoinHistory,
                            icon: const Icon(Icons.history, size: 16, color: AppColors.navy),
                            label: const Text(
                              'Riwayat Poin',
                              style: TextStyle(fontSize: 12, color: AppColors.navy, fontWeight: FontWeight.w600),
                            ),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(50, 30),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ],
                      ),
                      Stack(
                        children: [
                          _buildTextField(
                            controller: _poinController,
                            hint: 'Tuliskan poin-point kegiatan:\n- Siapa saja yang terlibat\n- Kegiatan apa\n- Hasil Utamanya\n- Saran',
                            maxLines: 6,
                          ),
                          if (_isListening)
                            Positioned(
                              top: 8,
                              left: 12,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.red.shade300),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.fiber_manual_record, color: Colors.red, size: 10),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Mendengarkan (Ketuk mic untuk berhenti)...',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.red.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          Positioned(
                            bottom: 8,
                            right: 8,
                            child: GestureDetector(
                              onTap: () {
                                if (_isListening) {
                                  _stopListening();
                                } else {
                                  _startListening();
                                }
                              },
                              child: Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: _isListening ? AppColors.error : AppColors.navy,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.15),
                                      blurRadius: 6,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Icon(
                                  _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                                  color: AppColors.bgLight,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Foto Bukti Dukung
                      _buildSectionTitle('Upload Foto Bukti Dukung', isRequired: true),
                      _buildPhotoSection(),
                      const SizedBox(height: 16),

                      // P2K2 Section (conditional)
                      if (_isP2K2) ...[
                        _buildP2K2Section(),
                        const SizedBox(height: 16),
                      ],

                      // Submit Button
                      _buildSubmitButton(formProvider),
                      const SizedBox(height: 80),
                    ],
                  ),
                ),
              ),

              // Loading overlay
              if (formProvider.isSubmitting)
                LoadingOverlay(message: _editingReport != null ? 'Memperbarui laporan...' : 'Menyimpan laporan...'),
              if (formProvider.isGeneratingNarrative)
                const LoadingOverlay(
                  message: 'Asisten Pendamping sedang membuat narasi...\nProses ini memerlukan beberapa detik',
                  showProgress: true,
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSectionTitle(String title, {bool isRequired = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.navyDark,
            ),
          ),
          if (isRequired)
            const Text(' *', style: TextStyle(color: Colors.red, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildJenisRHKDropdown() {
    final auth = context.read<AuthProvider>();
    final jenisSdm = auth.userProfile?.jenisSdm ?? 'SDM PKH';
    final uniqueJenis = getUniqueJenisRHK(jenisSdm);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedJenisRHK,
          hint: const Text('Pilih Jenis RHK', style: TextStyle(fontSize: 14)),
          isExpanded: true,
          itemHeight: null,
          selectedItemBuilder: (context) {
            return uniqueJenis.map((j) {
              final id = j['id'] as String;
              final text = j['jenisRhk'] as String;
              return Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '$id - $text',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList();
          },
          items: uniqueJenis.map((j) {
            final id = j['id'] as String;
            final text = j['jenisRhk'] as String;
            return DropdownMenuItem(
              value: text,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  '$id - $text',
                  style: const TextStyle(fontSize: 12, height: 1.3),
                  softWrap: true,
                ),
              ),
            );
          }).toList(),
          onChanged: (value) {
            setState(() {
              _selectedJenisRHK = value;
              _selectedRencanaAksi = null;
              _isP2K2 = isP2K2(value ?? '');
              // Find idRHK
              final match = uniqueJenis.firstWhere(
                (j) => j['jenisRhk'] == value,
                orElse: () => {'id': ''},
              );
              _selectedIdRHK = match['id'];
            });
          },
        ),
      ),
    );
  }

  Widget _buildRencanaAksiDropdown() {
    final auth = context.read<AuthProvider>();
    final jenisSdm = auth.userProfile?.jenisSdm ?? 'SDM PKH';
    final rencanaList = getRencanaAksiByJenis(_selectedJenisRHK ?? '', jenisSdm);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedRencanaAksi,
          hint: const Text('Pilih Rencana Aksi', style: TextStyle(fontSize: 14)),
          isExpanded: true,
          itemHeight: null,
          selectedItemBuilder: (context) {
            return rencanaList.map((r) => Align(
              alignment: Alignment.centerLeft,
              child: Text(
                r,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            )).toList();
          },
          items: rencanaList
              .map((r) => DropdownMenuItem(
                    value: r,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        r,
                        style: const TextStyle(fontSize: 12, height: 1.3),
                        softWrap: true,
                      ),
                    ),
                  ))
              .toList(),
          onChanged: (value) {
            setState(() => _selectedRencanaAksi = value);
            if (_isKatimSupervisiP2K2) {
              _initSupervisiData();
            }
          },
        ),
      ),
    );
  }

  Widget _buildPdfCheckbox({
    required bool value,
    required ValueChanged<bool?> onChanged,
  }) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: Checkbox(
                value: value,
                onChanged: onChanged,
                activeColor: AppColors.teal,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
            ),
            const SizedBox(width: 4),
            Text(
              'Tampilkan di PDF',
              style: TextStyle(
                fontSize: 12,
                fontWeight: value ? FontWeight.w600 : FontWeight.normal,
                color: value ? AppColors.teal : Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDatePicker() {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _selectedDate,
          firstDate: DateTime(2020),
          lastDate: DateTime.now().add(const Duration(days: 30)),
        );
        if (picked != null) {
          setState(() => _selectedDate = picked);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color ?? Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
        ),
        child: Row(
          children: [
            Icon(Icons.calendar_today_rounded, size: 20, color: Colors.grey[500]),
            const SizedBox(width: 12),
            Text(
              DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(_selectedDate),
              style: const TextStyle(fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimePicker() {
    return InkWell(
      onTap: () async {
        final TimeOfDay? picked = await showTimePicker(
          context: context,
          initialTime: const TimeOfDay(hour: 8, minute: 0),
        );
        if (picked != null) {
          final hour = picked.hour.toString().padLeft(2, '0');
          final minute = picked.minute.toString().padLeft(2, '0');
          final formattedTime = '$hour:$minute';
          setState(() {
            _pukukController.text = formattedTime;
          });
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color ?? Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
        ),
        child: Row(
          children: [
            Icon(Icons.access_time_rounded, size: 20, color: Colors.grey[500]),
            const SizedBox(width: 12),
            Text(
              _pukukController.text.isNotEmpty ? _pukukController.text : 'Pilih Jam Kegiatan',
              style: TextStyle(
                fontSize: 14,
                color: _pukukController.text.isNotEmpty ? (Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black) : Colors.grey[400],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
    IconData? icon,
    void Function(String)? onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
          prefixIcon: maxLines == 1 && icon != null
              ? Icon(icon, size: 20, color: Colors.grey[400])
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.all(14),
        ),
      ),
    );
  }

  Widget _buildPhotoSection() {
    final auth = context.read<AuthProvider>();
    return Column(
      children: [
        // Photo grid
        if (_existingPhotoIds.isNotEmpty || _selectedPhotos.isNotEmpty)
          SizedBox(
            height: 90,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _existingPhotoIds.length + _selectedPhotos.length,
              itemBuilder: (_, index) {
                if (index < _existingPhotoIds.length) {
                  final photoId = _existingPhotoIds[index];
                  final thumbUrl = auth.driveService != null
                      ? auth.driveService!.getThumbnailUrl(photoId, size: 300)
                      : null;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(
                      children: [
                        GestureDetector(
                          onTap: () {
                            if (thumbUrl != null) {
                              final fullSizeUrl = auth.driveService!.getThumbnailUrl(photoId, size: 1200);
                              _showImagePreview(fullSizeUrl, null);
                            }
                          },
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: thumbUrl != null
                                ? CachedNetworkImage(
                                    imageUrl: thumbUrl,
                                    width: 80,
                                    height: 80,
                                    fit: BoxFit.cover,
                                    placeholder: (_, __) => Container(
                                      width: 80,
                                      height: 80,
                                      color: Colors.grey[200],
                                      child: const Center(
                                        child: SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        ),
                                      ),
                                    ),
                                    errorWidget: (_, __, ___) => Container(
                                      width: 80,
                                      height: 80,
                                      color: Colors.grey[300],
                                      child: const Icon(Icons.broken_image, size: 28),
                                    ),
                                  )
                                : Container(
                                    width: 80,
                                    height: 80,
                                    color: Colors.grey[300],
                                    child: const Icon(Icons.image, size: 28),
                                  ),
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: InkWell(
                            onTap: () {
                              setState(() => _existingPhotoIds.removeAt(index));
                            },
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: Colors.red,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                } else {
                  final localIndex = index - _existingPhotoIds.length;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(
                      children: [
                        GestureDetector(
                          onTap: () => _showImagePreview(null, _selectedPhotos[localIndex].path),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(
                              File(_selectedPhotos[localIndex].path),
                              width: 80,
                              height: 80,
                              fit: BoxFit.cover,
                              cacheWidth: 240, // Decode small thumbnail to save RAM
                            ),
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: InkWell(
                            onTap: () {
                              setState(() => _selectedPhotos.removeAt(localIndex));
                            },
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: Colors.red,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }
              },
            ),
          ),

        if (_existingPhotoIds.isNotEmpty || _selectedPhotos.isNotEmpty) const SizedBox(height: 8),

        // Add photo buttons
        _buildPhotoButton(
          icon: Icons.photo_library_rounded,
          label: 'Pilih dari Galeri',
          onTap: () => _pickPhoto(ImageSource.gallery),
        ),
        const SizedBox(height: 4),
        Text(
          '${_existingPhotoIds.length + _selectedPhotos.length}/100 foto (max 100)',
          style: TextStyle(fontSize: 11, color: Colors.grey[400]),
        ),
      ],
    );
  }

  Widget _buildPhotoButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final totalPhotos = _existingPhotoIds.length + _selectedPhotos.length;
    return InkWell(
      onTap: totalPhotos >= 100 ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color ?? Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppColors.navy.withOpacity(0.2),
            style: BorderStyle.solid,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: AppColors.navy),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.navy,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildP2K2Section() {
    final moduls = getUniqueModulP2K2();
    final auth = context.read<AuthProvider>();

    final hadir = int.tryParse(_jumlahHadirController.text) ?? 0;
    final sakit = int.tryParse(_jumlahSakitController.text) ?? 0;
    final alpa = int.tryParse(_jumlahAlpaController.text) ?? 0;
    final totalDampingan = hadir + sakit + alpa;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gold.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.school_rounded, color: AppColors.gold, size: 20),
              const SizedBox(width: 8),
              Text(
                _isKatimSupervisiP2K2 ? 'Data Khusus Supervisi P2K2' : 'Data Khusus P2K2',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Khusus Supervisi Katim Section
          if (_isKatimSupervisiP2K2) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.teal.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.teal.withOpacity(0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.verified_user_rounded, color: AppColors.teal, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Supervisi P2K2 oleh ${auth.userProfile?.jabatan ?? "Ketua Tim"}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: AppColors.teal,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Nama Ketua Tim (Katim) — Otomatis nama sendiri
            _buildSectionTitle('Nama Ketua Tim (Katim)', isRequired: true),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: Theme.of(context).cardTheme.color?.withOpacity(0.6) ?? Colors.grey[100],
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.badge_rounded, size: 20, color: AppColors.navy),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _namaKetuaTimController.text.isNotEmpty
                          ? _namaKetuaTimController.text
                          : (auth.userProfile?.nama ?? '-'),
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.navy.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('Otomatis', style: TextStyle(fontSize: 10, color: AppColors.navy, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Nama Pendamping yang Disupervisi
            _buildSectionTitle('Nama Pendamping yang Disupervisi', isRequired: true),
            _buildPendampingSupervisiDropdown(),
            const SizedBox(height: 12),

            // Wilayah Supervisi Header
            _buildSectionTitle('Wilayah Pelaksanaan Supervisi', isRequired: true),

            // Provinsi (Otomatis dari profil Katim)
            if (_supervisiProvinsi.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardTheme.color?.withOpacity(0.6) ?? Colors.grey[100],
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.map_rounded, size: 20, color: AppColors.navy),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Provinsi', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                          Text(
                            _supervisiProvinsi,
                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.navy.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Otomatis', style: TextStyle(fontSize: 10, color: AppColors.navy, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ] else ...[
              _buildWilayahSupervisiDropdown(
                label: 'Provinsi',
                value: _supervisiProvinsi,
                items: _supervisiProvinces.map((p) => p.name).toList(),
                hint: _loadingSupervisiWilayah ? 'Memuat Provinsi...' : 'Pilih Provinsi',
                icon: Icons.map_rounded,
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _supervisiProvinsi = val);
                    _fetchSupervisiRegencies(val);
                  }
                },
                isLoading: _loadingSupervisiWilayah,
              ),
              const SizedBox(height: 12),
            ],

            // Kabupaten / Kota
            // Jika Katim Kab/Kota: Otomatis
            // Jika Katim Provinsi: Dropdown
            if ((auth.userProfile?.jabatan == 'Katim Kab/Kota') && _supervisiKabupaten.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardTheme.color?.withOpacity(0.6) ?? Colors.grey[100],
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.grey.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_city_rounded, size: 20, color: AppColors.navy),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Kabupaten / Kota', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                          Text(
                            _supervisiKabupaten,
                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.navy.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Otomatis', style: TextStyle(fontSize: 10, color: AppColors.navy, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ] else ...[
              _buildWilayahSupervisiDropdown(
                label: 'Kabupaten / Kota',
                value: _supervisiKabupaten,
                items: _supervisiRegencies.map((r) => r.name).toList(),
                hint: _supervisiProvinsi.isEmpty ? 'Pilih Provinsi dahulu' : 'Pilih Kabupaten / Kota',
                icon: Icons.location_city_rounded,
                onChanged: _onSupervisiKabupatenChanged,
              ),
              const SizedBox(height: 12),
            ],

            // Kecamatan (Dropdown dari data wilayah)
            _buildWilayahSupervisiDropdown(
              label: 'Kecamatan',
              value: _supervisiKecamatan,
              items: _supervisiDistricts.map((d) => d.name).toList(),
              hint: _supervisiKabupaten.isEmpty ? 'Pilih Kab/Kota dahulu' : 'Pilih Kecamatan',
              icon: Icons.holiday_village_rounded,
              onChanged: _onSupervisiKecamatanChanged,
            ),
            const SizedBox(height: 12),

            // Desa / Kelurahan (Dropdown dari data wilayah)
            if (_isManualKelurahan) ...[
              _buildTextField(
                controller: _supervisiKelurahanController,
                hint: 'Ketik nama Desa / Kelurahan',
                icon: Icons.home_work_rounded,
                onChanged: (val) => _supervisiKelurahan = val.trim(),
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => setState(() => _isManualKelurahan = false),
                  icon: const Icon(Icons.arrow_drop_down_circle_outlined, size: 14, color: AppColors.teal),
                  label: const Text('Pilih dari dropdown', style: TextStyle(fontSize: 11.5, color: AppColors.teal)),
                ),
              ),
            ] else ...[
              _buildWilayahSupervisiDropdown(
                label: 'Desa / Kelurahan',
                value: _supervisiKelurahan,
                items: _supervisiVillages.map((v) => v.name).toList(),
                hint: _supervisiKecamatan.isEmpty ? 'Pilih Kecamatan dahulu' : 'Pilih Desa / Kelurahan',
                icon: Icons.home_work_rounded,
                onChanged: _onSupervisiKelurahanChanged,
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => setState(() => _isManualKelurahan = true),
                  child: const Text('Desa tidak ada di list? Ketik manual', style: TextStyle(fontSize: 11.5, color: AppColors.teal)),
                ),
              ),
            ],
            const SizedBox(height: 12),
          ],

          // Modul dropdown
          _buildSectionTitle('Modul P2K2', isRequired: true),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Theme.of(context).cardTheme.color ?? Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedModul,
                hint: const Text('Pilih Modul', style: TextStyle(fontSize: 13)),
                isExpanded: true,
                itemHeight: null,
                selectedItemBuilder: (context) {
                  return moduls.map((m) => Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      m,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )).toList();
                },
                items: moduls.map((m) => DropdownMenuItem(
                  value: m,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      m,
                      style: const TextStyle(fontSize: 12, height: 1.3),
                      softWrap: true,
                    ),
                  ),
                )).toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedModul = value;
                    _selectedSesi = null;
                  });
                },
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Sesi dropdown
          if (_selectedModul != null) ...[
            _buildSectionTitle('Sesi P2K2 (Materi)', isRequired: true),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Theme.of(context).cardTheme.color ?? Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedSesi,
                  hint: const Text('Pilih Sesi', style: TextStyle(fontSize: 13)),
                  isExpanded: true,
                  itemHeight: null,
                  selectedItemBuilder: (context) {
                    final sesiList = getSesiByModul(_selectedModul!);
                    return sesiList.map((s) => Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        s,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    )).toList();
                  },
                  items: getSesiByModul(_selectedModul!).map((s) => DropdownMenuItem(
                    value: s,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        s,
                        style: const TextStyle(fontSize: 12, height: 1.3),
                        softWrap: true,
                      ),
                    ),
                  )).toList(),
                  onChanged: (value) => setState(() => _selectedSesi = value),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Jam Selesai
          _buildSectionTitle('Jam Selesai Kegiatan', isRequired: true),
          InkWell(
            onTap: () async {
              final picked = await showTimePicker(
                context: context,
                initialTime: const TimeOfDay(hour: 15, minute: 30),
              );
              if (picked != null) {
                final hour = picked.hour.toString().padLeft(2, '0');
                final minute = picked.minute.toString().padLeft(2, '0');
                setState(() {
                  _jamSelesaiController.text = '$hour:$minute';
                });
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: Theme.of(context).cardTheme.color ?? Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? Colors.grey[800]! : Colors.grey[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.access_time_filled_rounded, size: 20, color: Colors.grey[500]),
                  const SizedBox(width: 12),
                  Text(
                    _jamSelesaiController.text.isNotEmpty ? _jamSelesaiController.text : 'Pilih Jam Selesai (contoh: 15:30)',
                    style: TextStyle(
                      fontSize: 14,
                      color: _jamSelesaiController.text.isNotEmpty ? (Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black) : Colors.grey[400],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Tempat Pelaksanaan
          _buildSectionTitle('Tempat Pelaksanaan / Lokasi Kegiatan', isRequired: true),
          _buildTextField(
            controller: _tempatPelaksanaanController,
            hint: 'Contoh: Jl. Apel 3 Lk.II / Rumah Ibu Siti',
            icon: Icons.place_rounded,
          ),
          const SizedBox(height: 12),

          // Pemateri P2K2
          _buildSectionTitle('Pemateri P2K2', isRequired: true),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Pemateri adalah diri sendiri', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            subtitle: Text('Otomatis mengambil data Nama & Jabatan dari Profil', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
            value: _isPemateriDiriSendiri,
            activeColor: AppColors.navy,
            onChanged: (val) {
              setState(() {
                _isPemateriDiriSendiri = val ?? true;
                if (_isPemateriDiriSendiri) {
                  _namaPemateriController.text = auth.userProfile?.nama ?? '';
                  _jabatanPemateriController.text = auth.userProfile?.jabatan ?? '';
                }
              });
            },
          ),
          if (!_isPemateriDiriSendiri) ...[
            const SizedBox(height: 8),
            _buildTextField(
              controller: _namaPemateriController,
              hint: 'Nama Pemateri',
              icon: Icons.person_rounded,
            ),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _jabatanPemateriController,
              hint: 'Jabatan / Instansi Pemateri',
              icon: Icons.work_rounded,
            ),
          ],
          const SizedBox(height: 12),

          // Jumlah Kehadiran Peserta (Desain Kartu Menarik + Input Angka)
          _buildParticipantCountCards(totalDampingan),
          const SizedBox(height: 12),

          _buildSectionTitle('Nama Kelompok (opsional)', isRequired: false),
          _buildTextField(
            controller: _namaKelompokController,
            hint: 'Contoh: Kelompok Mawar 1 / Harapan Mulia',
            icon: Icons.groups_rounded,
          ),
          const SizedBox(height: 12),

          _buildSectionTitle('Ketua Kelompok (opsional)', isRequired: false),
          _buildTextField(
            controller: _ketuaKelompokController,
            hint: 'Nama lengkap ketua kelompok',
            icon: Icons.person_outline_rounded,
          ),
        ],
      ),
    );
  }

  Widget _buildParticipantCountCards(int totalDampingan) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle('Jumlah Peserta Dampingan', isRequired: true),
        Row(
          children: [
            Expanded(
              child: _buildParticipantCard(
                title: 'Hadir',
                color: const Color(0xFF2E7D32),
                bgColor: const Color(0xFFE8F5E9),
                icon: Icons.check_circle_rounded,
                controller: _jumlahHadirController,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildParticipantCard(
                title: 'Sakit',
                color: const Color(0xFFE65100),
                bgColor: const Color(0xFFFFF3E0),
                icon: Icons.healing_rounded,
                controller: _jumlahSakitController,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _buildParticipantCard(
                title: 'Alpa',
                color: const Color(0xFFC62828),
                bgColor: const Color(0xFFFFEBEE),
                icon: Icons.cancel_rounded,
                controller: _jumlahAlpaController,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.navy.withOpacity(0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.navy.withOpacity(0.15)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.groups_rounded, size: 20, color: AppColors.navy),
                  SizedBox(width: 8),
                  Text(
                    'Total Dampingan',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.navyDark,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.navy,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$totalDampingan KPM',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildParticipantCard({
    required String title,
    required Color color,
    required Color bgColor,
    required IconData icon,
    required TextEditingController controller,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? color.withOpacity(0.15) : bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.35), width: 1.2),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: controller,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
            decoration: InputDecoration(
              isDense: true,
              hintText: '0',
              hintStyle: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.grey[600] : Colors.grey[400],
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
              fillColor: isDark ? Colors.grey[850] : Colors.white,
              filled: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.withOpacity(0.3)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.withOpacity(0.3)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: color, width: 1.5),
              ),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton(FormProvider formProvider) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: formProvider.isSubmitting ? null : _handleSubmit,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 2,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.auto_awesome, size: 20),
            const SizedBox(width: 8),
            Text(
              _editingReport != null ? 'Perbarui & Lanjut ke Narasi' : 'Buat Narasi',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final totalPhotos = _existingPhotoIds.length + _selectedPhotos.length;
    if (totalPhotos >= 100) return;

    final picker = ImagePicker();
    if (source == ImageSource.gallery) {
      final images = await picker.pickMultiImage();
      setState(() {
        final remaining = 100 - totalPhotos;
        _selectedPhotos.addAll(images.take(remaining));
      });
    } else {
      final image = await picker.pickImage(source: source);
      if (image != null) {
        setState(() {
          _selectedPhotos.add(image);
        });
      }
    }
  }

  Future<void> _handleSubmit() async {
    // Validate
    if (_selectedJenisRHK == null || _selectedRencanaAksi == null) {
      _showError('Mohon pilih Jenis RHK dan Rencana Aksi');
      return;
    }
    if (_pukukController.text.trim().isEmpty) {
      _showError('Mohon pilih pukul kegiatan');
      return;
    }
    if (_poinController.text.trim().isEmpty) {
      _showError('Mohon isi poin-poin kegiatan');
      return;
    }
    if (_existingPhotoIds.isEmpty && _selectedPhotos.isEmpty) {
      _showError('Mohon upload minimal 1 foto bukti dukung kegiatan');
      return;
    }

    if (!_isP2K2) {
      if (_lokasiNonP2K2Controller.text.trim().isEmpty) {
        _showError('Mohon isi Lokasi Kegiatan');
        return;
      }
    }

    if (_isP2K2) {
      if (_isKatimSupervisiP2K2) {
        if (_namaPendampingController.text.trim().isEmpty) {
          _showError('Mohon pilih atau isi Nama Pendamping yang disupervisi');
          return;
        }
        if (_supervisiKecamatan.trim().isEmpty) {
          _showError('Mohon pilih Kecamatan supervisi');
          return;
        }
        final desa = _isManualKelurahan
            ? _supervisiKelurahanController.text.trim()
            : _supervisiKelurahan.trim();
        if (desa.isEmpty) {
          _showError('Mohon pilih atau isi Desa/Kelurahan supervisi');
          return;
        }
      }
      if (_selectedModul == null || _selectedModul!.isEmpty) {
        _showError('Mohon pilih Modul P2K2');
        return;
      }
      if (_selectedSesi == null || _selectedSesi!.isEmpty) {
        _showError('Mohon pilih Sesi P2K2');
        return;
      }
      if (_jamSelesaiController.text.trim().isEmpty) {
        _showError('Mohon tentukan Jam Selesai Kegiatan');
        return;
      }
      if (_tempatPelaksanaanController.text.trim().isEmpty) {
        _showError('Mohon isi Tempat Pelaksanaan / Lokasi Kegiatan');
        return;
      }
      if (!_isPemateriDiriSendiri) {
        if (_namaPemateriController.text.trim().isEmpty) {
          _showError('Mohon isi Nama Pemateri');
          return;
        }
        if (_jabatanPemateriController.text.trim().isEmpty) {
          _showError('Mohon isi Jabatan / Instansi Pemateri');
          return;
        }
      }
    }

    final formProvider = context.read<FormProvider>();
    final auth = context.read<AuthProvider>();

    final hadir = int.tryParse(_jumlahHadirController.text) ?? 0;
    final sakit = int.tryParse(_jumlahSakitController.text) ?? 0;
    final alpa = int.tryParse(_jumlahAlpaController.text) ?? 0;
    final totalDampingan = hadir + sakit + alpa;

    if (_isP2K2 && totalDampingan <= 0) {
      _showError('Jumlah peserta dampingan (Hadir) minimal 1 orang');
      return;
    }

    P2K2Data? p2k2;
    if (_isP2K2) {
      final desaFinal = _isManualKelurahan
          ? _supervisiKelurahanController.text.trim()
          : _supervisiKelurahan.trim();

      p2k2 = P2K2Data(
        modul: _selectedModul ?? '',
        sesi: _selectedSesi ?? '',
        jumlahKPM: totalDampingan.toString(),
        jumlahHadir: _jumlahHadirController.text.trim().isEmpty ? '0' : _jumlahHadirController.text.trim(),
        jumlahSakit: _jumlahSakitController.text.trim().isEmpty ? '0' : _jumlahSakitController.text.trim(),
        jumlahAlpa: _jumlahAlpaController.text.trim().isEmpty ? '0' : _jumlahAlpaController.text.trim(),
        namaKelompok: _namaKelompokController.text.trim(),
        ketuaKelompok: _ketuaKelompokController.text.trim(),
        jamSelesai: _jamSelesaiController.text.trim(),
        tempatPelaksanaan: _tempatPelaksanaanController.text.trim(),
        namaPemateri: _isPemateriDiriSendiri
            ? (auth.userProfile?.nama ?? '')
            : _namaPemateriController.text.trim(),
        jabatanPemateri: _isPemateriDiriSendiri
            ? (auth.userProfile?.jabatan ?? '')
            : _jabatanPemateriController.text.trim(),
        isPemateriDiriSendiri: _isPemateriDiriSendiri,
        namaKetuaTim: _namaKetuaTimController.text.trim().isNotEmpty
            ? _namaKetuaTimController.text.trim()
            : (auth.userProfile?.nama ?? ''),
        desaKelurahan: formatTitleCase(desaFinal),
        kecamatan: formatTitleCase(_supervisiKecamatan.trim().isNotEmpty
            ? _supervisiKecamatan.trim()
            : (auth.userProfile?.kecamatan ?? '')),
        kabupatenKota: formatTitleCase(_supervisiKabupaten.trim().isNotEmpty
            ? _supervisiKabupaten.trim()
            : (auth.userProfile?.kabupatenKota ?? '')),
        provinsi: formatTitleCase(_supervisiProvinsi.trim().isNotEmpty
            ? _supervisiProvinsi.trim()
            : (auth.userProfile?.provinsi ?? '')),
        namaPendamping: _namaPendampingController.text.trim(),
        nipPendamping: _nipPendampingController.text.trim(),
        isSupervisi: _isKatimSupervisiP2K2 || (_editingReport?.p2k2Data?.isSupervisi == true),
      );
    }

    final String finalLokasi = _isP2K2
        ? _tempatPelaksanaanController.text.trim()
        : _lokasiNonP2K2Controller.text.trim();

    if (_editingReport != null) {
      final success = await formProvider.updateReport(
        auth: auth,
        reportId: _editingReport!.id,
        jenisRHK: _selectedJenisRHK!,
        idRHK: _selectedIdRHK ?? '',
        rencanaAksi: _selectedRencanaAksi!,
        tanggal: _selectedDate.toIso8601String(),
        pukul: _pukukController.text,
        poinKegiatan: _poinController.text,
        existingPhotoIds: _existingPhotoIds,
        newPhotos: _selectedPhotos,
        p2k2Data: p2k2,
        physicalLokasi: finalLokasi,
        showTanggalInPdf: _showTanggalInPdf,
        showPukulInPdf: _showPukulInPdf,
      );

      if (success && mounted) {
        // Save to RHK-specific history
        if (_selectedIdRHK != null && _selectedIdRHK!.isNotEmpty) {
          final newPoint = _poinController.text.trim();
          if (newPoint.isNotEmpty) {
            final prefs = await SharedPreferences.getInstance();
            final historyKey = 'poin_history_${_selectedIdRHK}';
            final history = prefs.getStringList(historyKey) ?? [];
            final bool isNew = !history.contains(newPoint);
            
            history.remove(newPoint);
            history.insert(0, newPoint);
            if (history.length > 10) {
              history.removeLast();
            }
            await prefs.setStringList(historyKey, history);

            if (isNew && auth.sheetsService != null && auth.spreadsheetId != null) {
              auth.sheetsService!.appendRow(
                auth.spreadsheetId!,
                AppConstants.sheetRiwayatPoin,
                [_selectedIdRHK, newPoint, DateTime.now().toIso8601String()],
              ).catchError((e) => debugPrint('Error saving poin to cloud: $e'));
            }
          }
        }

        // Refresh report provider so draft is immediately visible on dashboard
        context.read<ReportProvider>().loadReports();

        // Navigate to narrative screen
        Navigator.pushNamed(context, '/narrative', arguments: _editingReport!.id);
      } else if (formProvider.errorMessage != null && mounted) {
        _showError(formProvider.errorMessage!);
      }
    } else {
      final reportId = await formProvider.submitReport(
        auth: auth,
        jenisRHK: _selectedJenisRHK!,
        idRHK: _selectedIdRHK ?? '',
        rencanaAksi: _selectedRencanaAksi!,
        tanggal: _selectedDate.toIso8601String(),
        pukul: _pukukController.text,
        poinKegiatan: _poinController.text,
        photos: _selectedPhotos,
        p2k2Data: p2k2,
        physicalLokasi: finalLokasi,
        showTanggalInPdf: _showTanggalInPdf,
        showPukulInPdf: _showPukulInPdf,
      );

      if (reportId != null && mounted) {
        // Save to RHK-specific history
        if (_selectedIdRHK != null && _selectedIdRHK!.isNotEmpty) {
          final newPoint = _poinController.text.trim();
          if (newPoint.isNotEmpty) {
            final prefs = await SharedPreferences.getInstance();
            final historyKey = 'poin_history_${_selectedIdRHK}';
            final history = prefs.getStringList(historyKey) ?? [];
            final bool isNew = !history.contains(newPoint);
            
            history.remove(newPoint);
            history.insert(0, newPoint);
            if (history.length > 10) {
              history.removeLast();
            }
            await prefs.setStringList(historyKey, history);

            if (isNew && auth.sheetsService != null && auth.spreadsheetId != null) {
              auth.sheetsService!.appendRow(
                auth.spreadsheetId!,
                AppConstants.sheetRiwayatPoin,
                [_selectedIdRHK, newPoint, DateTime.now().toIso8601String()],
              ).catchError((e) => debugPrint('Error saving poin to cloud: $e'));
            }
          }
        }

        // Refresh report provider so draft is immediately visible on dashboard
        context.read<ReportProvider>().loadReports();

        // Navigate to narrative screen
        Navigator.pushNamed(context, '/narrative', arguments: reportId);
      } else if (formProvider.errorMessage != null && mounted) {
        _showError(formProvider.errorMessage!);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}




