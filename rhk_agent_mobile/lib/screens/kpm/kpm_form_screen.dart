import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/app_theme.dart';
import '../../config/constants.dart';
import '../../models/kpm_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/kpm_provider.dart';
import '../../services/ai_service.dart';
import '../../widgets/scanner_overlay.dart';
import '../camera/custom_camera_screen.dart';

class KpmFormScreen extends StatefulWidget {
  final KpmProfile? profile;

  const KpmFormScreen({super.key, this.profile});

  @override
  State<KpmFormScreen> createState() => _KpmFormScreenState();
}

class _KpmFormScreenState extends State<KpmFormScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isEditMode = false;
  bool _isSaving = false;

  // Caretaker controllers
  final _nikController = TextEditingController();
  final _kkController = TextEditingController();
  final _namaController = TextEditingController();
  String _selectedStatus = 'Anggota'; // 'Ketua' atau 'Anggota'
  final _kelompokController = TextEditingController();
  final _pekerjaanController = TextEditingController();
  final _noHpController = TextEditingController();
  final _provinsiController = TextEditingController();
  final _kabKotaController = TextEditingController();
  final _kecamatanController = TextEditingController();
  final _desaController = TextEditingController();
  final _lingkunganController = TextEditingController();
  final _tahunBansosController = TextEditingController();

  // File IDs for caretaker
  String _fotoWajahId = '';
  String _fotoKtpId = '';
  String _fotoKkId = '';
  String _fotoBukuTabunganId = '';
  String _fotoKksId = '';

  // Component (Komponen) data
  final List<KpmComponent> _komponenList = [];

  // House / Business data
  bool _punyaUsaha = false;
  final _namaUsahaController = TextEditingController();
  String _fotoUsahaId = '';
  String _fotoRumahLuarId = '';
  String _fotoRumahTamuId = '';
  String _fotoKamarMandiId = '';
  double _latitude = 0.0;
  double _longitude = 0.0;
  String _selectedPernyataan = 'Saya menyatakan saya masih miskin, dan masih butuh bansos PKH';
  
  // Complementarity bansos
  final Map<String, bool> _komplementaritas = {
    'BPNT (Sembako)': false,
    'KIS (PBI Jaminan Kesehatan)': false,
    'PIP (KIP Sekolah)': false,
    'RST (Rumah Sejahtera Terpadu)': false,
    'PENA (Pahlawan Ekonomi Nasional)': false,
    'BLT El Nino / Mitigasi': false,
  };

  // Upload status tracking
  final Map<String, bool> _uploadingMap = {};
  bool _isOcrLoading = false;
  File? _pickedDocFile;

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.profile != null;
    if (_isEditMode) {
      final p = widget.profile!;
      final c = p.caretaker;
      final h = p.house;

      _nikController.text = c.nik;
      _kkController.text = c.noKk;
      _namaController.text = c.nama;
      _selectedStatus = c.status;
      _kelompokController.text = c.namaKelompok;
      _pekerjaanController.text = c.pekerjaan;
      _noHpController.text = c.noHp;
      _provinsiController.text = c.provinsi;
      _kabKotaController.text = c.kabKota;
      _kecamatanController.text = c.kecamatan;
      _desaController.text = c.desaKelurahan;
      _lingkunganController.text = c.lingkungan;
      _tahunBansosController.text = c.tahunDapatBansos;

      _fotoWajahId = c.fotoWajah;
      _fotoKtpId = c.fotoKtp;
      _fotoKkId = c.fotoKk;
      _fotoBukuTabunganId = c.fotoBukuTabungan;
      _fotoKksId = c.fotoKks;

      _komponenList.addAll(p.komponenList);

      _punyaUsaha = h.punyaUsaha == 'Y';
      _namaUsahaController.text = h.namaUsaha;
      _fotoUsahaId = h.fotoUsaha;
      _fotoRumahLuarId = h.fotoRumahLuar;
      _fotoRumahTamuId = h.fotoRumahTamu;
      _fotoKamarMandiId = h.fotoKamarMandi;
      _latitude = h.latitude;
      _longitude = h.longitude;
      if (h.pernyataan.isNotEmpty) {
        _selectedPernyataan = h.pernyataan;
      }

      // Parse bansos lain
      if (h.bansosLain.isNotEmpty) {
        final parts = h.bansosLain.split(',');
        for (var part in parts) {
          final trimmed = part.trim();
          if (_komplementaritas.containsKey(trimmed)) {
            _komplementaritas[trimmed] = true;
          }
        }
      }
    }
  }

  @override
  void dispose() {
    _nikController.dispose();
    _kkController.dispose();
    _namaController.dispose();
    _kelompokController.dispose();
    _pekerjaanController.dispose();
    _noHpController.dispose();
    _provinsiController.dispose();
    _kabKotaController.dispose();
    _kecamatanController.dispose();
    _desaController.dispose();
    _lingkunganController.dispose();
    _tahunBansosController.dispose();
    _namaUsahaController.dispose();
    super.dispose();
  }

  /// Mengambil lokasi GPS saat ini secara otomatis
  Future<void> _getCurrentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showSnackBar('Izin GPS ditolak', Colors.orange);
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        _showSnackBar('Izin GPS ditolak permanen', Colors.orange);
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
      _showSnackBar('Koordinat berhasil didapatkan!', Colors.green);
    } catch (e) {
      _showSnackBar('Gagal mendapatkan lokasi: $e', Colors.red);
    }
  }

  /// Fungsi untuk jepret foto dan mengunggahnya langsung ke Google Drive
  Future<void> _captureAndUploadPhoto(String fileType) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 75, maxWidth: 1280);
    if (image == null) return;

    setState(() {
      _uploadingMap[fileType] = true;
    });

    try {
      final bytes = await File(image.path).readAsBytes();
      final provider = context.read<KpmProvider>();
      
      final kpmId = _isEditMode ? widget.profile!.caretaker.kpmId : 'TEMP_${DateTime.now().millisecondsSinceEpoch}';
      
      // Upload ke Drive
      final fileId = await provider.uploadKpmDocument(
        kpmId,
        fileType,
        bytes,
        'image/jpeg',
      );

      setState(() {
        switch (fileType) {
          case 'Wajah':
            _fotoWajahId = fileId;
            break;
          case 'Ktp':
            _fotoKtpId = fileId;
            break;
          case 'Kk':
            _fotoKkId = fileId;
            break;
          case 'Tabungan':
            _fotoBukuTabunganId = fileId;
            break;
          case 'Kks':
            _fotoKksId = fileId;
            break;
          case 'Usaha':
            _fotoUsahaId = fileId;
            break;
          case 'Luar':
            _fotoRumahLuarId = fileId;
            // Dapatkan koordinat GPS secara otomatis saat mengambil foto rumah tampak luar
            _getCurrentLocation();
            break;
          case 'Tamu':
            _fotoRumahTamuId = fileId;
            break;
          case 'Mandi':
            _fotoKamarMandiId = fileId;
            break;
        }
      });
      _showSnackBar('Foto berhasil diunggah ke Google Drive!', Colors.green);
    } catch (e) {
      _showSnackBar('Gagal mengunggah foto: $e', Colors.red);
    } finally {
      setState(() {
        _uploadingMap[fileType] = false;
      });
    }
  }

  /// Scan KTP/KK via Gemini AI (Multimodal OCR)
  Future<void> _scanDocumentWithGemini(bool isKtp) async {
    String? resultPath;
    if (isKtp) {
      resultPath = await Navigator.push<String>(
        context,
        MaterialPageRoute(
          builder: (context) => const CustomCameraScreen(title: 'Scan KTP'),
        ),
      );
    } else {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: ImageSource.camera, imageQuality: 80, maxWidth: 1600);
      resultPath = image?.path;
    }
    if (resultPath == null) return;

    final file = File(resultPath);
    setState(() {
      _pickedDocFile = file;
      _isOcrLoading = true;
    });

    try {
      final auth = context.read<AuthProvider>();
      
      // Gunakan API Key AI bawaan
      final apiKey = AppConstants.defaultOpenRouterApiKey;
      // Ambil detail provider dan model default
      final configRows = await auth.sheetsService!.getAllRows(auth.spreadsheetId!, 'Config');
      String provider = 'groq';
      
      for (var row in configRows) {
        if (row.length > 1) {
          if (row[0] == 'AI_PROVIDER') provider = row[1].toString();
        }
      }

      String model = provider == 'groq' ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'google/gemini-2.5-flash';


      // Panggil OCR
      final ocrData = await AiService().extractDocumentData(
        imageFile: file,
        provider: provider,
        apiKey: apiKey,
        model: model,
        isKtp: isKtp,
      );

      setState(() {
        if (isKtp) {
          if (ocrData['nik'] != null && ocrData['nik']!.isNotEmpty) {
            _nikController.text = ocrData['nik']!;
            Clipboard.setData(ClipboardData(text: ocrData['nik']!));
          }
          if (ocrData['nama'] != null && ocrData['nama']!.isNotEmpty) _namaController.text = ocrData['nama']!;
          if (ocrData['alamat'] != null && ocrData['alamat']!.isNotEmpty) _lingkunganController.text = ocrData['alamat']!;
          if (ocrData['kelDesa'] != null && ocrData['kelDesa']!.isNotEmpty) _desaController.text = ocrData['kelDesa']!;
          if (ocrData['kecamatan'] != null && ocrData['kecamatan']!.isNotEmpty) _kecamatanController.text = ocrData['kecamatan']!;
          if (ocrData['kabKota'] != null && ocrData['kabKota']!.isNotEmpty) _kabKotaController.text = ocrData['kabKota']!;
          if (ocrData['provinsi'] != null && ocrData['provinsi']!.isNotEmpty) _provinsiController.text = ocrData['provinsi']!;
        } else {
          if (ocrData['noKk'] != null && ocrData['noKk']!.isNotEmpty) _kkController.text = ocrData['noKk']!;
          if (ocrData['nama'] != null && ocrData['nama']!.isNotEmpty) {
            _showSnackBar('Nama Kepala Keluarga: ${ocrData['nama']}', Colors.blue);
          }
        }
      });
      
      _showSnackBar('Scan berhasil! Kolom formulir terisi otomatis.', Colors.green);
    } catch (e) {
      _showSnackBar('Gagal memproses gambar: $e', Colors.red);
    } finally {
      setState(() {
        _isOcrLoading = false;
      });
    }
  }

  /// Fungsi dinamis menambah komponen anak/anggota keluarga
  void _addKomponenDialog() {
    final nameCtrl = TextEditingController();
    String rel = 'Anak';
    String gen = 'L';
    String type = 'SD';
    final classCtrl = TextEditingController();
    final posyanduCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final isSchool = type == 'SD' || type == 'SMP' || type == 'SMA';
          final isBaby = type == 'USIA DINI' || type == 'BUMIL';

          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Tambah Anggota Komponen PKH', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Nama Lengkap'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: rel,
                    decoration: const InputDecoration(labelText: 'Hubungan Keluarga'),
                    items: const [
                      DropdownMenuItem(value: 'Anak', child: Text('Anak')),
                      DropdownMenuItem(value: 'Istri', child: Text('Istri')),
                      DropdownMenuItem(value: 'Kepala Keluarga', child: Text('Kepala Keluarga')),
                      DropdownMenuItem(value: 'Lainnya', child: Text('Lainnya')),
                    ],
                    onChanged: (val) => setDialogState(() => rel = val!),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: gen,
                    decoration: const InputDecoration(labelText: 'Jenis Kelamin'),
                    items: const [
                      DropdownMenuItem(value: 'L', child: Text('Laki-laki')),
                      DropdownMenuItem(value: 'P', child: Text('Perempuan')),
                    ],
                    onChanged: (val) => setDialogState(() => gen = val!),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: type,
                    decoration: const InputDecoration(labelText: 'Jenis Komponen'),
                    items: const [
                      DropdownMenuItem(value: 'SD', child: Text('Anak Sekolah SD')),
                      DropdownMenuItem(value: 'SMP', child: Text('Anak Sekolah SMP')),
                      DropdownMenuItem(value: 'SMA', child: Text('Anak Sekolah SMA')),
                      DropdownMenuItem(value: 'USIA DINI', child: Text('Balita (Usia Dini)')),
                      DropdownMenuItem(value: 'BUMIL', child: Text('Ibu Hamil')),
                      DropdownMenuItem(value: 'LANSIA', child: Text('Lanjut Usia (Lansia)')),
                      DropdownMenuItem(value: 'DISABILITAS', child: Text('Disabilitas Berat')),
                    ],
                    onChanged: (val) {
                      setDialogState(() {
                        type = val!;
                      });
                    },
                  ),
                  if (isSchool) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: classCtrl,
                      decoration: const InputDecoration(labelText: 'Kelas / Tingkatan'),
                    ),
                  ],
                  if (isBaby) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: posyanduCtrl,
                      decoration: const InputDecoration(labelText: 'Fasilitas Kesehatan / Posyandu'),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
              ElevatedButton(
                onPressed: () {
                  if (nameCtrl.text.trim().isEmpty) return;
                  final cId = 'KOMP-${_nikController.text}_${DateTime.now().millisecondsSinceEpoch}';
                  
                  setState(() {
                    _komponenList.add(KpmComponent(
                      komponenId: cId,
                      kpmId: _isEditMode ? widget.profile!.caretaker.kpmId : 'KPM-${_nikController.text}',
                      nama: nameCtrl.text.trim(),
                      jenisKelamin: gen,
                      hubunganKeluarga: rel,
                      jenisKomponen: type,
                      kelas: isSchool ? classCtrl.text.trim() : '',
                      posyandu: isBaby ? posyanduCtrl.text.trim() : '',
                      createdAt: DateTime.now().toIso8601String(),
                    ));
                  });
                  Navigator.pop(ctx);
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, foregroundColor: Colors.white),
                child: const Text('Simpan'),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Kirim data lengkap ke Provider
  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) {
      _showSnackBar('Mohon isi field bertanda bintang wajib (*)', Colors.orange);
      return;
    }

    if (_fotoWajahId.isEmpty || _fotoKtpId.isEmpty || _fotoKkId.isEmpty) {
      _showSnackBar('Mohon upload foto Wajah, KTP, dan KK pengurus.', Colors.orange);
      return;
    }

    if (_fotoRumahLuarId.isEmpty || _fotoRumahTamuId.isEmpty || _fotoKamarMandiId.isEmpty) {
      _showSnackBar('Mohon lengkapi foto tampak Rumah (Luar, Tamu, Mandi).', Colors.orange);
      return;
    }

    setState(() => _isSaving = true);

    try {
      final kpmId = _isEditMode ? widget.profile!.caretaker.kpmId : 'KPM-${_nikController.text.trim()}';

      // Satukan komplementaritas bansos
      final bansosList = _komplementaritas.entries
          .where((e) => e.value == true)
          .map((e) => e.key)
          .join(', ');

      final caretaker = KpmCaretaker(
        kpmId: kpmId,
        nik: _nikController.text.trim(),
        noKk: _kkController.text.trim(),
        nama: _namaController.text.trim(),
        status: _selectedStatus,
        namaKelompok: _kelompokController.text.trim(),
        pekerjaan: _pekerjaanController.text.trim(),
        noHp: _noHpController.text.trim(),
        provinsi: _provinsiController.text.trim(),
        kabKota: _kabKotaController.text.trim(),
        kecamatan: _kecamatanController.text.trim(),
        desaKelurahan: _desaController.text.trim(),
        lingkungan: _lingkunganController.text.trim(),
        fotoWajah: _fotoWajahId,
        fotoKtp: _fotoKtpId,
        fotoKk: _fotoKkId,
        fotoBukuTabungan: _fotoBukuTabunganId,
        fotoKks: _fotoKksId,
        tahunDapatBansos: _tahunBansosController.text.trim(),
        createdAt: _isEditMode ? widget.profile!.caretaker.createdAt : DateTime.now().toIso8601String(),
      );

      final house = KpmHouse(
        rumahId: _isEditMode ? widget.profile!.house.rumahId : 'RMH-${_nikController.text.trim()}',
        kpmId: kpmId,
        punyaUsaha: _punyaUsaha ? 'Y' : 'T',
        namaUsaha: _punyaUsaha ? _namaUsahaController.text.trim() : '',
        fotoUsaha: _punyaUsaha ? _fotoUsahaId : '',
        fotoRumahLuar: _fotoRumahLuarId,
        fotoRumahTamu: _fotoRumahTamuId,
        fotoKamarMandi: _fotoKamarMandiId,
        latitude: _latitude,
        longitude: _longitude,
        pernyataan: _selectedPernyataan,
        bansosLain: bansosList,
        createdAt: _isEditMode ? widget.profile!.house.createdAt : DateTime.now().toIso8601String(),
      );

      // Pastikan kpmId komponen disamakan jika baru
      final List<KpmComponent> updatedKomponenList = _komponenList.map((c) {
        return c.copyWith(kpmId: kpmId);
      }).toList();

      final profile = KpmProfile(
        caretaker: caretaker,
        komponenList: updatedKomponenList,
        house: house,
      );

      final success = await context.read<KpmProvider>().saveKpmProfile(profile);
      if (mounted) {
        if (success) {
          _showSnackBar('Profil KPM berhasil disimpan.', Colors.green);
          Navigator.pop(context, true); // Kembali & refresh
        } else {
          _showSnackBar('Gagal menyimpan KPM: ${context.read<KpmProvider>().errorMessage}', Colors.red);
        }
      }
    } catch (e) {
      _showSnackBar('Terjadi kesalahan: $e', Colors.red);
    } finally {
      setState(() => _isSaving = false);
    }
  }

  void _showSnackBar(String msg, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: color, behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditMode ? 'Edit Profil KPM' : 'Tambah KPM Baru'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          Form(
            key: _formKey,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader('1. DATA DIRI PENGURUS KPM'),
                  
                  // Scan button helper
                  _buildOcrButtons(),
                  
                  _buildTextFormField(_namaController, 'Nama Lengkap Pengurus KPM *', isRequired: true),
                  _buildTextFormField(_nikController, 'NIK KTP *', isRequired: true, keyboardType: TextInputType.number),
                  _buildTextFormField(_kkController, 'Nomor Kartu Keluarga *', isRequired: true, keyboardType: TextInputType.number),
                  _buildDropdownField('Status dalam Kelompok', _selectedStatus, ['Ketua', 'Anggota'], (val) => setState(() => _selectedStatus = val!)),
                  _buildTextFormField(_kelompokController, 'Nama Kelompok PKH *', isRequired: true),
                  _buildTextFormField(_pekerjaanController, 'Pekerjaan Pengurus'),
                  _buildTextFormField(_noHpController, 'Nomor HP Aktif', keyboardType: TextInputType.phone),
                  _buildTextFormField(_tahunBansosController, 'Tahun Dapat Bansos PKH pertama', keyboardType: TextInputType.number),
                  
                  const SizedBox(height: 16),
                  _buildSectionHeader('2. ALAMAT TINGGAL'),
                  _buildTextFormField(_provinsiController, 'Provinsi *', isRequired: true),
                  _buildTextFormField(_kabKotaController, 'Kabupaten/Kota *', isRequired: true),
                  _buildTextFormField(_kecamatanController, 'Kecamatan *', isRequired: true),
                  _buildTextFormField(_desaController, 'Desa/Kelurahan *', isRequired: true),
                  _buildTextFormField(_lingkunganController, 'Lingkungan / RT / RW *', isRequired: true),

                  const SizedBox(height: 16),
                  _buildSectionHeader('3. DOKUMEN & FOTO PENGURUS'),
                  _buildPhotoPickerRow('Foto Wajah *', _fotoWajahId, 'Wajah'),
                  _buildPhotoPickerRow('Foto KTP *', _fotoKtpId, 'Ktp'),
                  _buildPhotoPickerRow('Foto Kartu Keluarga *', _fotoKkId, 'Kk'),
                  _buildPhotoPickerRow('Foto Buku Tabungan Kemensos', _fotoBukuTabunganId, 'Tabungan'),
                  _buildPhotoPickerRow('Foto Kartu Keluarga Sejahtera (KKS)', _fotoKksId, 'Kks'),

                  const SizedBox(height: 16),
                  _buildSectionHeader('4. ANGGOTA KOMPONEN PKH'),
                  _buildKomponenList(),

                  const SizedBox(height: 16),
                  _buildSectionHeader('5. USAHA & KONDISI RUMAH'),
                  _buildUsahaSection(),
                  const SizedBox(height: 12),
                  _buildPhotoPickerRow('Foto Rumah Tampak Luar *', _fotoRumahLuarId, 'Luar'),
                  _buildPhotoPickerRow('Foto Rumah Ruang Tamu *', _fotoRumahTamuId, 'Tamu'),
                  _buildPhotoPickerRow('Foto Rumah Kamar Mandi *', _fotoKamarMandiId, 'Mandi'),

                  const SizedBox(height: 12),
                  _buildGpsSection(),

                  const SizedBox(height: 16),
                  _buildSectionHeader('6. KOMPLEMENTARITAS BANSOS'),
                  _buildBansosChecklist(),

                  const SizedBox(height: 16),
                  _buildSectionHeader('7. PERNYATAAN KOMITMEN'),
                  _buildDropdownField(
                    'Pernyataan Pengurus KPM',
                    _selectedPernyataan,
                    [
                      'Saya menyatakan saya masih miskin, dan masih butuh bansos PKH',
                      'Saya menyatakan saya sudah mampu dan akan mengundurkan diri (graduasi) dari PKH'
                    ],
                    (val) => setState(() => _selectedPernyataan = val!),
                  ),

                  const SizedBox(height: 32),
                  _buildSubmitButton(),
                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
          
          if (_isSaving)
            Container(
              color: Colors.black38,
              child: Center(
                child: Card(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 16),
                        Text('Menyimpan data KPM ke Sheets...', style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            
          if (_isOcrLoading && _pickedDocFile != null)
            ScannerOverlay(
              imageFile: _pickedDocFile!,
              message: 'Gemini AI sedang membaca dokumen...',
            ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.navy, letterSpacing: 0.8),
          ),
          const Divider(thickness: 1, color: AppColors.navy),
        ],
      ),
    );
  }

  Widget _buildOcrButtons() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.gold.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome, color: AppColors.gold, size: 20),
          const SizedBox(width: 8),
          const Text('Scan AI:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          const Spacer(),
          ElevatedButton.icon(
            onPressed: () => _scanDocumentWithGemini(true),
            icon: const Icon(Icons.camera_alt, size: 14),
            label: const Text('Scan KTP', style: TextStyle(fontSize: 11)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.navy,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: () => _scanDocumentWithGemini(false),
            icon: const Icon(Icons.camera_alt, size: 14),
            label: const Text('Scan KK', style: TextStyle(fontSize: 11)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.navy,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextFormField(
    TextEditingController controller,
    String label, {
    bool isRequired = false,
    TextInputType keyboardType = TextInputType.text,
  }) {
    final isNik = label.contains('NIK');
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 13),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          suffixIcon: isNik
              ? IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  tooltip: 'Salin NIK',
                  onPressed: () {
                    if (controller.text.isNotEmpty) {
                      Clipboard.setData(ClipboardData(text: controller.text));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('NIK sukses disalin ke Clipboard!'),
                          backgroundColor: Colors.green,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                )
              : null,
        ),
        validator: (val) {
          if (isRequired && (val == null || val.trim().isEmpty)) {
            return 'Field ini wajib diisi';
          }
          return null;
        },
      ),
    );
  }

  Widget _buildDropdownField(
    String label,
    String currentValue,
    List<String> items,
    Function(String?) onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: DropdownButtonFormField<String>(
        value: currentValue,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 13),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
        items: items
            .map((item) => DropdownMenuItem(
                  value: item,
                  child: Text(item, style: const TextStyle(fontSize: 12)),
                ))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildPhotoPickerRow(String label, String currentFileId, String fileType) {
    final hasPhoto = currentFileId.isNotEmpty;
    final isUploading = _uploadingMap[fileType] ?? false;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  Text(
                    hasPhoto ? 'Terunggah ke Drive' : 'Belum ada foto',
                    style: TextStyle(fontSize: 11, color: hasPhoto ? Colors.green : Colors.grey),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            isUploading
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                : IconButton(
                    icon: Icon(hasPhoto ? Icons.check_circle : Icons.camera_alt, color: hasPhoto ? Colors.green : AppColors.navy),
                    onPressed: () => _captureAndUploadPhoto(fileType),
                  ),
          ],
        ),
      ),
    );
  }

  Widget _buildKomponenList() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Daftar Anggota Keluarga PKH', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              ElevatedButton.icon(
                onPressed: _addKomponenDialog,
                icon: const Icon(Icons.add, size: 14),
                label: const Text('Tambah', style: TextStyle(fontSize: 11)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.navy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_komponenList.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Text(
                  'Belum ada komponen PKH ditambahkan.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _komponenList.length,
              itemBuilder: (context, index) {
                final c = _komponenList[index];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(c.nama, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text('${c.hubunganKeluarga} • Komponen: ${c.jenisKomponen}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red, size: 18),
                    onPressed: () => setState(() => _komponenList.removeAt(index)),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildUsahaSection() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          CheckboxListTile(
            title: const Text('KPM memiliki usaha ekonomi mandiri?', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            contentPadding: EdgeInsets.zero,
            dense: true,
            value: _punyaUsaha,
            onChanged: (val) => setState(() => _punyaUsaha = val!),
          ),
          if (_punyaUsaha) ...[
            const SizedBox(height: 8),
            _buildTextFormField(_namaUsahaController, 'Nama Usaha KPM'),
            _buildPhotoPickerRow('Foto Usaha KPM', _fotoUsahaId, 'Usaha'),
          ],
        ],
      ),
    );
  }

  Widget _buildGpsSection() {
    final hasGps = _latitude != 0.0 && _longitude != 0.0;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50.withOpacity(0.3),
        border: Border.all(color: Colors.red.shade100),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.location_on, color: Colors.red),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Koordinat GPS Rumah KPM', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.red)),
                const SizedBox(height: 4),
                Text(
                  hasGps ? 'Lat: $_latitude\nLng: $_longitude' : 'Foto rumah luar akan otomatis mendeteksi lokasi.',
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: _getCurrentLocation,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.navy,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Ambil GPS', style: TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _buildBansosChecklist() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: _komplementaritas.keys.map((key) {
          return CheckboxListTile(
            title: Text(key, style: const TextStyle(fontSize: 12)),
            contentPadding: EdgeInsets.zero,
            dense: true,
            value: _komplementaritas[key],
            onChanged: (val) => setState(() => _komplementaritas[key] = val!),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: _submitForm,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: const Text(
          'Simpan Profil KPM',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
