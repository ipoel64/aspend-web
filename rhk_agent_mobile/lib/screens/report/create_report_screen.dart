import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/app_theme.dart';
import '../../config/constants.dart';
import '../../config/master_data.dart';
import '../../models/p2k2_data.dart';
import '../../models/report.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';
import '../../widgets/loading_overlay.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:cached_network_image/cached_network_image.dart';

/// Buat Laporan Screen — Form input lengkap
class CreateReportScreen extends StatefulWidget {
  const CreateReportScreen({super.key});

  @override
  State<CreateReportScreen> createState() => _CreateReportScreenState();
}

class _CreateReportScreenState extends State<CreateReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _poinController = TextEditingController();
  final _pukukController = TextEditingController();

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

  @override
  void initState() {
    super.initState();
    _initSpeech();
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
        _isP2K2 = isP2K2(args.jenisRHK);
        if (_isP2K2 && args.p2k2Data != null) {
          _selectedModul = args.p2k2Data!.modul;
          _selectedSesi = args.p2k2Data!.sesi;
          _jumlahKpmController.text = args.p2k2Data!.jumlahKPM;
          _jumlahHadirController.text = args.p2k2Data!.jumlahHadir;
          _namaKelompokController.text = args.p2k2Data!.namaKelompok;
          _ketuaKelompokController.text = args.p2k2Data!.ketuaKelompok;
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
    _jumlahKpmController.dispose();
    _jumlahHadirController.dispose();
    _namaKelompokController.dispose();
    _ketuaKelompokController.dispose();
    super.dispose();
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
                      _buildSectionTitle('Tanggal Kegiatan', isRequired: true),
                      _buildDatePicker(),
                      const SizedBox(height: 16),

                      // Pukul
                      _buildSectionTitle('Pukul Kegiatan', isRequired: true),
                      _buildTimePicker(),
                      const SizedBox(height: 16),

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
                            hint: 'Tuliskan poin-point kegiatan:\n- Siapa saja yang terlibat\n- Kegiatan apa\n- Lokasi kegiatan\n- Hasil Utamanya\n- Saran',
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
                const LoadingOverlay(message: 'Asisten Pendamping sedang membuat narasi...\nProses ini memerlukan beberapa detik'),
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
    final uniqueJenis = getUniqueJenisRHK();

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
          items: uniqueJenis.map((j) {
            final id = j['id'] as String;
            final text = j['jenisRhk'] as String;
            return DropdownMenuItem(
              value: text,
              child: Text(
                '$id - ${text.length > 50 ? '${text.substring(0, 50)}...' : text}',
                style: const TextStyle(fontSize: 13),
                overflow: TextOverflow.ellipsis,
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
              _selectedIdRHK = match['id'] as String?;
            });
          },
        ),
      ),
    );
  }

  Widget _buildRencanaAksiDropdown() {
    final rencanaList = getRencanaAksiByJenis(_selectedJenisRHK ?? '');

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
          items: rencanaList
              .map((r) => DropdownMenuItem(
                    value: r,
                    child: Text(
                      r.length > 60 ? '${r.substring(0, 60)}...' : r,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ))
              .toList(),
          onChanged: (value) => setState(() => _selectedRencanaAksi = value),
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
          '${_existingPhotoIds.length + _selectedPhotos.length}/10 foto (max 10)',
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
      onTap: totalPhotos >= 10 ? null : onTap,
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
          const Row(
            children: [
              Icon(Icons.school_rounded, color: AppColors.gold, size: 20),
              SizedBox(width: 8),
              Text(
                'Data P2K2',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Modul dropdown
          _buildSectionTitle('Modul', isRequired: true),
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
                items: moduls.map((m) => DropdownMenuItem(
                  value: m,
                  child: Text(
                    m.length > 40 ? '${m.substring(0, 40)}...' : m,
                    style: const TextStyle(fontSize: 12),
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
            _buildSectionTitle('Sesi', isRequired: true),
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
                  items: getSesiByModul(_selectedModul!).map((s) => DropdownMenuItem(
                    value: s,
                    child: Text(s, style: const TextStyle(fontSize: 12)),
                  )).toList(),
                  onChanged: (value) => setState(() => _selectedSesi = value),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Numeric inputs
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle('Jumlah KPM'),
                    _buildTextField(controller: _jumlahKpmController, hint: '0'),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle('Jumlah Hadir'),
                    _buildTextField(controller: _jumlahHadirController, hint: '0'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          _buildSectionTitle('Nama Kelompok'),
          _buildTextField(controller: _namaKelompokController, hint: 'Nama kelompok'),
          const SizedBox(height: 12),

          _buildSectionTitle('Ketua Kelompok'),
          _buildTextField(controller: _ketuaKelompokController, hint: 'Nama ketua kelompok'),
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
              _editingReport != null ? 'Perbarui & Buat Narasi' : 'Buat Narasi',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final totalPhotos = _existingPhotoIds.length + _selectedPhotos.length;
    if (totalPhotos >= 10) return;

    final picker = ImagePicker();
    if (source == ImageSource.gallery) {
      final images = await picker.pickMultiImage();
      setState(() {
        final remaining = 10 - totalPhotos;
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

    if (_isP2K2) {
      if (_selectedModul == null || _selectedModul!.isEmpty) {
        _showError('Mohon pilih Modul P2K2');
        return;
      }
      if (_selectedSesi == null || _selectedSesi!.isEmpty) {
        _showError('Mohon pilih Sesi P2K2');
        return;
      }
    }

    final formProvider = context.read<FormProvider>();
    final auth = context.read<AuthProvider>();

    // Build P2K2 data if applicable
    P2K2Data? p2k2;
    if (_isP2K2) {
      p2k2 = P2K2Data(
        modul: _selectedModul ?? '',
        sesi: _selectedSesi ?? '',
        jumlahKPM: _jumlahKpmController.text,
        jumlahHadir: _jumlahHadirController.text,
        namaKelompok: _namaKelompokController.text,
        ketuaKelompok: _ketuaKelompokController.text,
      );
    }

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
