import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../config/app_theme.dart';
import '../../providers/nota_dinas_provider.dart';
import '../../widgets/loading_overlay.dart';

class NotaDinasFormScreen extends StatefulWidget {
  const NotaDinasFormScreen({super.key});

  @override
  State<NotaDinasFormScreen> createState() => _NotaDinasFormScreenState();
}

class _NotaDinasFormScreenState extends State<NotaDinasFormScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nomorController = TextEditingController();
  final _ythController = TextEditingController();
  final _dariController = TextEditingController();
  final _halController = TextEditingController();
  final _lampiranController = TextEditingController();
  final _sifatController = TextEditingController();
  final _tanggalController = TextEditingController();
  final _draftController = TextEditingController();

  File? _buktiDukungPhoto;
  final ImagePicker _picker = ImagePicker();

  final stt.SpeechToText _speechToText = stt.SpeechToText();
  String? _listeningField; // null, 'draft', 'isi'
  String _preSpeechText = '';

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _tanggalController.text = DateFormat('dd MMMM yyyy', 'id_ID').format(DateTime.now());
    _sifatController.text = 'Biasa';
    _lampiranController.text = '-';
    _initSpeech();
  }

  @override
  void dispose() {
    _nomorController.dispose();
    _ythController.dispose();
    _dariController.dispose();
    _halController.dispose();
    _lampiranController.dispose();
    _sifatController.dispose();
    _tanggalController.dispose();
    _draftController.dispose();
    super.dispose();
  }

  void _initSpeech() async {
    try {
      await _speechToText.initialize(
        onError: (val) => debugPrint('STT onError: $val'),
        onStatus: (val) {
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

  Future<void> _selectTanggal(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      locale: const Locale('id'),
    );
    if (picked != null) {
      setState(() {
        _tanggalController.text = DateFormat('dd MMMM yyyy', 'id_ID').format(picked);
      });
    }
  }

  Future<void> _pickBuktiDukung() async {
    final pickedFile = await _picker.pickImage(
      source: ImageSource.gallery,
    );
    if (pickedFile == null) return;
    setState(() {
      _buktiDukungPhoto = File(pickedFile.path);
    });
  }


  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      // 1. Generate AI content automatically in the background
      final generatedIsi = await context.read<NotaDinasProvider>().generateAiNotaDinas(
        yth: _ythController.text.trim(),
        dari: _dariController.text.trim(),
        hal: _halController.text.trim(),
        tanggal: _tanggalController.text.trim(),
        poinDraft: _draftController.text.trim(),
      );

      if (!mounted) return;

      // 2. Save the generated Nota Dinas
      final success = await context.read<NotaDinasProvider>().saveNotaDinas(
        nomor: _nomorController.text.trim(),
        yth: _ythController.text.trim(),
        dari: _dariController.text.trim(),
        hal: _halController.text.trim(),
        lampiran: _lampiranController.text.trim(),
        sifat: _sifatController.text.trim(),
        tanggal: _tanggalController.text.trim(),
        poinDraft: _draftController.text.trim(),
        isiNotaDinas: generatedIsi,
        buktiDukungPhoto: _buktiDukungPhoto,
      );

      if (success) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Nota Dinas berhasil disimpan & PDF terunggah!'), backgroundColor: Colors.green),
          );
          Navigator.pop(context);
        }
      } else {
        if (mounted) {
          final error = context.read<NotaDinasProvider>().errorMessage;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(error ?? 'Gagal menyimpan Nota Dinas'), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menyusun/menyimpan surat: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = _isSubmitting;

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text('Buat Nota Dinas', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
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
                  const Text(
                    'Parameter Nota Dinas',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),

                  _buildInputField(
                    controller: _nomorController,
                    label: 'Nomor Surat (contoh: 123/ND/06/2026)',
                    icon: Icons.numbers_rounded,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Nomor surat wajib diisi' : null,
                  ),

                  _buildInputField(
                    controller: _ythController,
                    label: 'Kepada Yth. (contoh: Kepala Dinas Sosial Kabupaten...)',
                    icon: Icons.person_rounded,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Penerima wajib diisi' : null,
                  ),

                  _buildInputField(
                    controller: _dariController,
                    label: 'Dari (contoh: Pendamping Sosial PKH Kecamatan...)',
                    icon: Icons.send_rounded,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Pengirim wajib diisi' : null,
                  ),

                  _buildInputField(
                    controller: _halController,
                    label: 'Hal / Perihal (contoh: Laporan Pelaksanaan P2K2 Bulan Juni)',
                    icon: Icons.info_outline,
                    validator: (val) => val == null || val.trim().isEmpty ? 'Perihal wajib diisi' : null,
                  ),

                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _sifatController.text.isEmpty ? 'Biasa' : _sifatController.text,
                          decoration: InputDecoration(
                            labelText: 'Sifat',
                            labelStyle: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                            prefixIcon: const Icon(Icons.label_important_outline, color: AppColors.navy, size: 20),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: AppColors.navy, width: 2),
                            ),
                            contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'Biasa', child: Text('Biasa')),
                            DropdownMenuItem(value: 'Penting', child: Text('Penting')),
                            DropdownMenuItem(value: 'Rahasia', child: Text('Rahasia')),
                            DropdownMenuItem(value: 'Segera', child: Text('Segera')),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _sifatController.text = val;
                              });
                            }
                          },
                          validator: (val) => val == null || val.trim().isEmpty ? 'Wajib diisi' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildInputField(
                          controller: _lampiranController,
                          label: 'Lampiran',
                          icon: Icons.attachment_rounded,
                          validator: (val) => val == null || val.trim().isEmpty ? 'Wajib diisi' : null,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  _buildInputField(
                    controller: _tanggalController,
                    label: 'Tanggal Surat',
                    icon: Icons.calendar_today_rounded,
                    readOnly: true,
                    onTap: () => _selectTanggal(context),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Tanggal wajib diisi' : null,
                  ),

                  const Divider(height: 32),

                  // DRAFT / POINTS SECTION
                  const Text(
                    'Poin-poin Draft Kegiatan',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),
                  _buildInputField(
                    controller: _draftController,
                    label: 'Tuliskan poin-poin singkat isi surat/kegiatan...',
                    icon: Icons.notes_rounded,
                    maxLines: 4,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _listeningField == 'draft' ? Icons.mic_rounded : Icons.mic_none_rounded,
                        color: _listeningField == 'draft' ? Colors.red : AppColors.navy,
                      ),
                      onPressed: () => _toggleListening('draft', _draftController),
                    ),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Poin draf wajib diisi' : null,
                  ),

                  const Divider(height: 32),

                  // BUKTI DUKUNG SECTION
                  const Text(
                    'Foto / Bukti Dukung (Opsional)',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navyDark),
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickBuktiDukung,
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
                          Icon(Icons.image_outlined, color: AppColors.navy, size: 28),
                          const SizedBox(width: 12),
                          const Text(
                            'Unggah Foto dari Galeri',
                            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.navyDark),
                          )
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_buktiDukungPhoto != null) ...[
                    Center(
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(_buktiDukungPhoto!, height: 180, fit: BoxFit.contain, cacheHeight: 500),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: CircleAvatar(
                              backgroundColor: Colors.red.withOpacity(0.8),
                              radius: 16,
                              child: IconButton(
                                icon: const Icon(Icons.close, size: 16, color: Colors.white),
                                onPressed: () => setState(() => _buktiDukungPhoto = null),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  const SizedBox(height: 24),

                  // SUBMIT BUTTON
                  ElevatedButton.icon(
                    onPressed: _handleSubmit,
                    icon: const Icon(Icons.save_rounded),
                    label: const Text(
                      'SIMPAN & GENERATE PDF',
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 52),
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
        if (isLoading)
          const LoadingOverlay(
            message: 'Menyusun Surat Dinas & Mengunggah Laporan...',
          ),
      ],
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int? maxLines,
    FormFieldValidator<String>? validator,
    bool readOnly = false,
    Widget? suffixIcon,
    VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines ?? 1,
        validator: validator,
        readOnly: readOnly,
        onTap: onTap,
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
}
