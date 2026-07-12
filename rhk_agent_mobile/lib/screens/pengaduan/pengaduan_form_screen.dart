import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../config/app_theme.dart';
import '../../providers/pengaduan_provider.dart';
import '../../widgets/loading_overlay.dart';
import '../../widgets/scanner_overlay.dart';
import '../camera/custom_camera_screen.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class PengaduanFormScreen extends StatefulWidget {
  const PengaduanFormScreen({super.key});

  @override
  State<PengaduanFormScreen> createState() => _PengaduanFormScreenState();
}

class _PengaduanFormScreenState extends State<PengaduanFormScreen> {
  final _formKey = GlobalKey<FormState>();
  
  final _nikController = TextEditingController();
  final _namaController = TextEditingController();
  final _alamatController = TextEditingController();
  final _desaController = TextEditingController();
  final _kecamatanController = TextEditingController();
  final _kabKotaController = TextEditingController();
  final _aduanController = TextEditingController();
  final _analisaController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();

  File? _ktpPhoto;
  File? _screenshotSiks;
  
  bool _isLocating = false;
  MapController? _mapController;
  bool _isOcrProcessing = false;
  bool _isAiGenerating = false;
  bool _isSubmitting = false;

  final ImagePicker _picker = ImagePicker();

  // Focus nodes for geocoding on address inputs losing focus
  final _alamatFocusNode = FocusNode();
  final _desaFocusNode = FocusNode();
  final _kecamatanFocusNode = FocusNode();
  final _kabKotaFocusNode = FocusNode();

  // Speech to Text state
  final stt.SpeechToText _speechToText = stt.SpeechToText();
  String? _listeningField; // null, 'aduan', or 'analisa'
  String _preSpeechText = '';
  bool _isSubmitEnabled = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
    _mapController = MapController();
    
    // Add focus listeners for automatic geocoding
    _alamatFocusNode.addListener(_onAddressFieldFocusChange);
    _desaFocusNode.addListener(_onAddressFieldFocusChange);
    _kecamatanFocusNode.addListener(_onAddressFieldFocusChange);
    _kabKotaFocusNode.addListener(_onAddressFieldFocusChange);

    // Listen to inputs to enable submit button dynamically
    _aduanController.addListener(_updateSubmitButtonState);
    _analisaController.addListener(_updateSubmitButtonState);

    // Listen to GPS changes to rebuild map and toggle button
    _latController.addListener(_updateGpsState);
    _lngController.addListener(_updateGpsState);
  }

  void _updateGpsState() {
    setState(() {});
  }

  void _updateSubmitButtonState() {
    final enabled = _aduanController.text.trim().isNotEmpty && _analisaController.text.trim().isNotEmpty;
    if (enabled != _isSubmitEnabled) {
      setState(() {
        _isSubmitEnabled = enabled;
      });
    }
  }

  void _initSpeech() async {
    try {
      await _speechToText.initialize(
        onError: (val) => debugPrint('STT onError: $val'),
        onStatus: (val) {
          debugPrint('STT onStatus: $val');
          if (val == 'done' || val == 'notListening') {
            if (mounted) {
              setState(() {
                _listeningField = null;
              });
            }
          }
        },
      );
    } catch (_) {}
  }

  void _toggleListening(String field, TextEditingController controller) async {
    if (_listeningField == field) {
      await _speechToText.stop();
      setState(() {
        _listeningField = null;
      });
    } else {
      if (_listeningField != null) {
        await _speechToText.stop();
      }
      
      final bool available = await _speechToText.initialize(
        onError: (val) => debugPrint('STT onError: $val'),
        onStatus: (val) {
          debugPrint('STT onStatus: $val');
          if (val == 'done' || val == 'notListening') {
            if (mounted) {
              setState(() {
                _listeningField = null;
              });
            }
          }
        },
      );

      if (!available) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Speech recognition tidak tersedia')),
        );
        return;
      }

      _preSpeechText = controller.text;
      final space = _preSpeechText.isNotEmpty && !_preSpeechText.endsWith(' ') ? ' ' : '';

      await _speechToText.listen(
        onResult: (result) {
          setState(() {
            controller.text = _preSpeechText + space + result.recognizedWords;
            controller.selection = TextSelection.fromPosition(
              TextPosition(offset: controller.text.length),
            );
          });
        },
        localeId: 'id_ID',
      );

      setState(() {
        _listeningField = field;
      });
    }
  }

  Future<void> _geocodeAddress() async {
    final street = _alamatController.text.trim();
    final village = _desaController.text.trim();
    final subdistrict = _kecamatanController.text.trim();
    final city = _kabKotaController.text.trim();

    if (city.isEmpty && subdistrict.isEmpty && village.isEmpty) {
      return; // Not enough info
    }

    setState(() => _isLocating = true);

    try {
      List<String> queryParts = [];
      if (street.isNotEmpty) queryParts.add(street);
      if (village.isNotEmpty) queryParts.add(village);
      if (subdistrict.isNotEmpty) queryParts.add(subdistrict);
      if (city.isNotEmpty) queryParts.add(city);
      
      final query = queryParts.join(', ');
      
      List<Location> locations = await locationFromAddress(query);
      if (locations.isNotEmpty) {
        final loc = locations.first;
        setState(() {
          _latController.text = loc.latitude.toStringAsFixed(6);
          _lngController.text = loc.longitude.toStringAsFixed(6);
        });
      } else {
        throw Exception('Alamat tidak ditemukan di peta geocoding');
      }
    } catch (e) {
      debugPrint('Geocoding error: $e');
      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                const SizedBox(width: 8),
                Text('GPS Otomatis Gagal', style: TextStyle(color: Colors.orange.shade800)),
              ],
            ),
            content: const Text(
              'Gagal mendeteksi koordinat GPS dari alamat secara otomatis.\n\n'
              'Penyebab: Koneksi internet bermasalah, atau alamat kurang spesifik.\n\n'
              'Solusi:\n'
              '1. Pastikan koneksi internet Anda aktif.\n'
              '2. Lengkapi field alamat, desa, kecamatan, dan kabupaten/kota.\n'
              '3. Atau ketuk tombol "Ambil GPS" di bawah untuk menggunakan GPS perangkat Anda secara langsung.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Mengerti', style: TextStyle(color: AppColors.navy)),
              ),
            ],
          ),
        );
      }
    } finally {
      setState(() => _isLocating = false);
    }
  }

  void _onAddressFieldFocusChange() {
    if (!_alamatFocusNode.hasFocus &&
        !_desaFocusNode.hasFocus &&
        !_kecamatanFocusNode.hasFocus &&
        !_kabKotaFocusNode.hasFocus) {
      if (_alamatController.text.isNotEmpty ||
          _desaController.text.isNotEmpty ||
          _kecamatanController.text.isNotEmpty ||
          _kabKotaController.text.isNotEmpty) {
        _geocodeAddress();
      }
    }
  }

  @override
  void dispose() {
    _latController.removeListener(_updateGpsState);
    _lngController.removeListener(_updateGpsState);

    _nikController.dispose();
    _namaController.dispose();
    _alamatController.dispose();
    _desaController.dispose();
    _kecamatanController.dispose();
    _kabKotaController.dispose();
    _aduanController.dispose();
    _analisaController.dispose();
    _latController.dispose();
    _lngController.dispose();
    
    _alamatFocusNode.dispose();
    _desaFocusNode.dispose();
    _kecamatanFocusNode.dispose();
    _kabKotaFocusNode.dispose();
    
    super.dispose();
  }

  Future<void> _pickKtp() async {
    final resultPath = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (context) => const CustomCameraScreen(title: 'Scan KTP'),
      ),
    );
    if (resultPath == null) return;

    final file = File(resultPath);
    setState(() {
      _ktpPhoto = file;
      _isOcrProcessing = true;
    });

    try {
      final ocrResult = await context.read<PengaduanProvider>().extractKtpData(file);
      if (ocrResult != null) {
        setState(() {
          if (ocrResult.containsKey('nik') && ocrResult['nik']!.isNotEmpty) {
            _nikController.text = ocrResult['nik']!;
            Clipboard.setData(ClipboardData(text: ocrResult['nik']!));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('NIK sukses diekstrak & disalin ke Clipboard!'),
                backgroundColor: Colors.green,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
          if (ocrResult.containsKey('nama')) _namaController.text = ocrResult['nama']!;
          if (ocrResult.containsKey('alamat')) _alamatController.text = ocrResult['alamat']!;
          if (ocrResult.containsKey('kelDesa')) _desaController.text = ocrResult['kelDesa']!;
          if (ocrResult.containsKey('kecamatan')) _kecamatanController.text = ocrResult['kecamatan']!;
          if (ocrResult.containsKey('kabKota')) _kabKotaController.text = ocrResult['kabKota']!;
        });
        _geocodeAddress(); // Auto trigger geocoding coordinates
      } else {
        final error = context.read<PengaduanProvider>().errorMessage;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error ?? 'Gagal membaca KTP. Pastikan foto KTP dekat, jelas dan terbaca.'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal OCR KTP: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isOcrProcessing = false);
    }
  }

  Future<void> _pickScreenshot() async {
    final pickedFile = await _picker.pickImage(
      source: ImageSource.gallery,
    );
    if (pickedFile == null) return;
    setState(() {
      _screenshotSiks = File(pickedFile.path);
    });
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isLocating = true);
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw 'Izin lokasi ditolak';
        }
      }
      if (permission == LocationPermission.deniedForever) {
        throw 'Izin lokasi ditolak permanen';
      }

      Position? position;
      try {
        bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high,
            timeLimit: const Duration(seconds: 8),
          );
        }
      } catch (_) {}

      position ??= await Geolocator.getLastKnownPosition();

      if (position != null) {
        setState(() {
          _latController.text = position!.latitude.toStringAsFixed(6);
          _lngController.text = position!.longitude.toStringAsFixed(6);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lokasi sukses diperoleh'), backgroundColor: Colors.green),
        );
      } else {
        throw 'Gagal mendapatkan koordinat GPS';
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error GPS: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isLocating = false);
    }
  }

  Future<void> _generateAiAnalysis() async {
    if (_aduanController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Silakan isi aduan masyarakat terlebih dahulu'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() => _isAiGenerating = true);
    try {
      final analysis = await context.read<PengaduanProvider>().generateAiAnalysis(_aduanController.text.trim());
      setState(() {
        _analisaController.text = analysis;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Analisis Asisten Pendamping berhasil di-generate!'), backgroundColor: Colors.green),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal generate analisis: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isAiGenerating = false);
    }
  }

  Future<void> _launchUrl(String urlString) async {
    final uri = Uri.parse(urlString);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
  }

  void _showError(String message) {
    if (mounted) {
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

  Future<void> _handleGenerateAiAndSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    
    final aduanText = _aduanController.text.trim();
    final initialAnalisaText = _analisaController.text.trim();
    
    if (aduanText.isEmpty || initialAnalisaText.isEmpty) {
      _showError('Aduan dan Analisa wajib diisi');
      return;
    }

    setState(() {
      _isAiGenerating = true;
    });
    
    String formalNarrative = '';
    try {
      formalNarrative = await context.read<PengaduanProvider>().generateFormalAnalysis(
        aduanText,
        initialAnalisaText,
      );
      
      if (formalNarrative.isEmpty) {
        throw Exception('AI mengembalikan respons kosong');
      }
    } catch (e) {
      setState(() => _isAiGenerating = false);
      _showError('Gagal menyusun narasi formal Asisten Pendamping: $e');
      return;
    }

    setState(() {
      _isAiGenerating = false;
      _isSubmitting = true;
    });

    try {
      final success = await context.read<PengaduanProvider>().savePengaduan(
        nik: _nikController.text.trim(),
        nama: _namaController.text.trim(),
        alamat: _alamatController.text.trim(),
        desaKelurahan: _desaController.text.trim(),
        kecamatan: _kecamatanController.text.trim(),
        kabKota: _kabKotaController.text.trim(),
        aduan: aduanText,
        hasilAnalisa: formalNarrative,
        latitude: double.tryParse(_latController.text) ?? 0.0,
        longitude: double.tryParse(_lngController.text) ?? 0.0,
        ktpPhoto: _ktpPhoto,
        screenshotSiks: _screenshotSiks,
      );

      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pengaduan formal berhasil disimpan & PDF terunggah!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.pop(context);
        }
      } else {
        final error = context.read<PengaduanProvider>().errorMessage;
        _showError(error ?? 'Gagal menyimpan pengaduan');
      }
    } catch (e) {
      _showError('Gagal menyimpan pengaduan: $e');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = _isOcrProcessing || _isAiGenerating || _isSubmitting || _isLocating;

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text('Buat Pengaduan', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            backgroundColor: AppColors.navy,
            foregroundColor: Colors.white,
          ),
          body: Form(
            key: _formKey,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // NIK OCR & Camera Button
                  const Text(
                    'Identitas Sasaran',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),
                  
                  // Camera Button for KTP OCR
                  InkWell(
                    onTap: _pickKtp,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.camera_alt_rounded, color: AppColors.navy, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Jepret Foto KTP',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.navyDark),
                                ),
                                Text(
                                  'Asisten Pendamping otomatis scan NIK & Data Diri',
                                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          )
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  if (_ktpPhoto != null) ...[
                    Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(_ktpPhoto!, height: 150, fit: BoxFit.cover, cacheHeight: 400),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Text Fields for Profile
                  _buildInputField(
                    controller: _nikController,
                    label: 'NIK',
                    icon: Icons.credit_card_rounded,
                    keyboardType: TextInputType.number,
                    maxLength: 16,
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.copy, color: AppColors.navy),
                      tooltip: 'Salin NIK',
                      onPressed: () {
                        if (_nikController.text.trim().isNotEmpty) {
                          Clipboard.setData(ClipboardData(text: _nikController.text.trim()));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('NIK disalin ke Clipboard!'),
                              backgroundColor: Colors.green,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('NIK kosong'),
                              backgroundColor: Colors.orange,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) return 'NIK wajib diisi';
                      final trimmed = val.trim();
                      if (trimmed.length != 16) return 'NIK harus 16 digit';
                      if (!RegExp(r'^\d{16}$').hasMatch(trimmed)) return 'NIK harus berupa 16 digit angka';
                      return null;
                    },
                  ),
                  _buildInputField(
                    controller: _namaController,
                    label: 'Nama Lengkap',
                    icon: Icons.person_rounded,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Nama wajib diisi' : null,
                  ),
                   _buildInputField(
                    controller: _alamatController,
                    label: 'Alamat (Jalan/RT/RW)',
                    icon: Icons.home_rounded,
                    focusNode: _alamatFocusNode,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Alamat wajib diisi' : null,
                  ),
                  
                  Row(
                    children: [
                      Expanded(
                        child: _buildInputField(
                          controller: _desaController,
                          label: 'Desa / Kelurahan',
                          icon: Icons.location_city_rounded,
                          focusNode: _desaFocusNode,
                          validator: (val) => val == null || val.trim().isEmpty ? 'Wajib diisi' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildInputField(
                          controller: _kecamatanController,
                          label: 'Kecamatan',
                          icon: Icons.map_rounded,
                          focusNode: _kecamatanFocusNode,
                          validator: (val) => val == null || val.trim().isEmpty ? 'Wajib diisi' : null,
                        ),
                      ),
                    ],
                  ),
                  
                  _buildInputField(
                    controller: _kabKotaController,
                    label: 'Kabupaten / Kota',
                    icon: Icons.location_on_rounded,
                    focusNode: _kabKotaFocusNode,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Kabupaten/Kota wajib diisi' : null,
                  ),
                  
                  const Divider(height: 32),
                  
                  // GPS COORDINATE SECTION
                  const Text(
                    'Lokasi GPS',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildInputField(
                          controller: _latController,
                          label: 'Latitude',
                          icon: Icons.pin_drop,
                          readOnly: true,
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return 'Wajib ambil GPS';
                            final latVal = double.tryParse(val.trim());
                            if (latVal == null || latVal == 0.0) return 'GPS tidak valid';
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildInputField(
                          controller: _lngController,
                          label: 'Longitude',
                          icon: Icons.pin_drop,
                          readOnly: true,
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return 'Wajib ambil GPS';
                            final lngVal = double.tryParse(val.trim());
                            if (lngVal == null || lngVal == 0.0) return 'GPS tidak valid';
                            return null;
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildMapPreview(),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isLocating ? null : _getCurrentLocation,
                      icon: _isLocating
                          ? const SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Icon(
                              _latController.text.trim().isEmpty
                                  ? Icons.gps_fixed
                                  : Icons.my_location_rounded,
                            ),
                      label: Text(
                        _isLocating
                            ? 'Mengambil lokasi...'
                            : (_latController.text.trim().isEmpty
                                ? 'Ambil Lokasi GPS Saat Ini'
                                : 'Perbarui Lokasi GPS Saat Ini'),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _latController.text.trim().isEmpty
                            ? AppColors.navy
                            : AppColors.navyDark,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ADUAN DESCRIPTION
                  const Text(
                    'Detail Aduan',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),
                  _buildInputField(
                    controller: _aduanController,
                    label: 'Deskripsi Aduan Masyarakat (Bisa pakai Mic)',
                    icon: Icons.edit_note_rounded,
                    maxLines: 5,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _listeningField == 'aduan' ? Icons.mic_rounded : Icons.mic_none_rounded,
                        color: _listeningField == 'aduan' ? Colors.red : AppColors.navy,
                      ),
                      onPressed: () => _toggleListening('aduan', _aduanController),
                    ),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Aduan wajib diisi' : null,
                  ),
                  const SizedBox(height: 12),

                  _buildInputField(
                    controller: _analisaController,
                    label: 'Analisis Awal / Rencana Tindak Lanjut (Bisa pakai Mic)',
                    icon: Icons.analytics_rounded,
                    maxLines: 6,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _listeningField == 'analisa' ? Icons.mic_rounded : Icons.mic_none_rounded,
                        color: _listeningField == 'analisa' ? Colors.red : AppColors.navy,
                      ),
                      onPressed: () => _toggleListening('analisa', _analisaController),
                    ),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Analisis wajib diisi' : null,
                  ),

                  const Divider(height: 32),

                  // SCREENSHOT EVIDENCE
                  const Text(
                    'Screenshot SIKS-NG / Cek Bansos',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _launchUrl('https://cekbansos.kemensos.go.id/'),
                          icon: const Icon(Icons.open_in_browser_rounded),
                          label: const Text('Link Cek Bansos'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey.shade200,
                            foregroundColor: Colors.black87,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _launchUrl('https://siks.kemensos.go.id/'),
                          icon: const Icon(Icons.open_in_browser_rounded),
                          label: const Text('Link SIKS-NG'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey.shade200,
                            foregroundColor: Colors.black87,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickScreenshot,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.image_outlined, color: AppColors.navy, size: 28),
                          const SizedBox(width: 12),
                          const Text(
                            'Unggah Screenshot Bukti Dukung',
                            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.navyDark),
                          )
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_screenshotSiks != null) ...[
                    Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(_screenshotSiks!, height: 180, fit: BoxFit.contain, cacheHeight: 500),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  const SizedBox(height: 24),

                  // SUBMIT BUTTON
                  ElevatedButton.icon(
                    onPressed: _isSubmitEnabled ? _handleGenerateAiAndSubmit : null,
                    icon: const Icon(Icons.auto_awesome),
                    label: const Text(
                      'GENERATE ASISTEN PENDAMPING & SIMPAN PDF',
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 52),
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                      disabledBackgroundColor: Colors.grey.shade300,
                      disabledForegroundColor: Colors.grey.shade500,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
        if (_isOcrProcessing && _ktpPhoto != null)
          ScannerOverlay(
            imageFile: _ktpPhoto!,
            message: 'Asisten Pendamping sedang membaca KTP...',
          )
        else if (isLoading)
          LoadingOverlay(
            message: _isAiGenerating
                ? 'Sedang menyusun narasi formal Asisten Pendamping...'
                : (_isSubmitting ? 'Mengunggah & Menyimpan Laporan...' : 'Mengambil GPS...'),
          ),
      ],
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int? maxLines,
    int? maxLength,
    TextInputType? keyboardType,
    FormFieldValidator<String>? validator,
    bool readOnly = false,
    Widget? suffixIcon,
    FocusNode? focusNode,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: TextFormField(
        controller: controller,
        focusNode: focusNode,
        maxLines: maxLines ?? 1,
        maxLength: maxLength,
        keyboardType: keyboardType,
        readOnly: readOnly,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: Colors.grey.shade600, fontSize: 13),
          prefixIcon: Icon(icon, color: AppColors.navy, size: 20),
          suffixIcon: suffixIcon,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.navy, width: 2),
          ),
          filled: readOnly,
          fillColor: readOnly ? Colors.grey.shade100 : null,
          contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        ),
      ),
    );
  }

  Widget _buildMapPreview() {
    final lat = double.tryParse(_latController.text);
    final lng = double.tryParse(_lngController.text);
    final hasValidCoords = lat != null && lng != null && lat != 0.0 && lng != 0.0;

    if (!hasValidCoords) {
      return Container(
        height: 150,
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.map_outlined, color: Colors.grey.shade400, size: 40),
            const SizedBox(height: 8),
            Text(
              'Peta Lokasi belum tersedia',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 2),
            Text(
              'Lakukan scan KTP atau klik Ambil GPS untuk memuat peta',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 10),
            ),
          ],
        ),
      );
    }

    // Move map controller if coordinates change
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_mapController != null) {
        _mapController!.move(LatLng(lat, lng), 15.0);
      }
    });

    return Container(
      height: 150,
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: LatLng(lat, lng),
                initialZoom: 15.0,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.aspend.mobile',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(lat, lng),
                      width: 40,
                      height: 40,
                      alignment: Alignment.topCenter,
                      child: const Icon(
                        Icons.location_on,
                        color: Colors.red,
                        size: 36,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            Positioned(
              bottom: 8,
              right: 8,
              child: FloatingActionButton.small(
                heroTag: 'open_gmaps_form',
                backgroundColor: Colors.white,
                foregroundColor: Colors.blue.shade700,
                elevation: 3,
                onPressed: () => _launchUrl('https://www.google.com/maps/search/?api=1&query=$lat,$lng'),
                child: const Icon(Icons.open_in_new_rounded, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
