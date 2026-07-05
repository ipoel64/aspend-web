import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../config/app_theme.dart';
import '../../models/nota_dinas.dart';
import '../../providers/nota_dinas_provider.dart';
import '../../widgets/loading_overlay.dart';

class NotaDinasDetailScreen extends StatefulWidget {
  final NotaDinas notaDinas;

  const NotaDinasDetailScreen({super.key, required this.notaDinas});

  @override
  State<NotaDinasDetailScreen> createState() => _NotaDinasDetailScreenState();
}

class _NotaDinasDetailScreenState extends State<NotaDinasDetailScreen> {
  late NotaDinas _currentNotaDinas;
  bool _isSaving = false;
  final stt.SpeechToText _speechToText = stt.SpeechToText();

  @override
  void initState() {
    super.initState();
    _currentNotaDinas = widget.notaDinas;
  }

  Future<void> _viewPdf(BuildContext context) async {
    if (_currentNotaDinas.pdfFileId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('File PDF tidak ditemukan'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final url = 'https://drive.google.com/file/d/${_currentNotaDinas.pdfFileId}/view';
    final uri = Uri.parse(url);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Membuka PDF Nota Dinas di browser...'),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Gagal membuka PDF: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange),
            SizedBox(width: 8),
            Text('Hapus Nota Dinas'),
          ],
        ),
        content: Text(
          'Yakin ingin menghapus Nota Dinas nomor "${_currentNotaDinas.nomor}"?\n\nTindakan ini akan menghapus data di Google Sheet dan file PDF/lampiran di Google Drive.',
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
              context.read<NotaDinasProvider>().deleteNotaDinas(_currentNotaDinas.id).then((_) {
                Navigator.pop(context); // back to list
              });
            },
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _editBodyText(BuildContext context) {
    final controller = TextEditingController(text: _currentNotaDinas.isiNotaDinas);
    bool isListeningLocal = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            void toggleListening() async {
              if (isListeningLocal) {
                await _speechToText.stop();
                setModalState(() {
                  isListeningLocal = false;
                });
              } else {
                final bool available = await _speechToText.initialize(
                  onError: (val) => debugPrint('STT onError: $val'),
                  onStatus: (val) {
                    if (val == 'done' || val == 'notListening') {
                      if (mounted) {
                        setModalState(() {
                          isListeningLocal = false;
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

                final preSpeechText = controller.text;
                final space = preSpeechText.isNotEmpty && !preSpeechText.endsWith(' ') ? ' ' : '';

                await _speechToText.listen(
                  onResult: (result) {
                    setModalState(() {
                      controller.text = preSpeechText + space + result.recognizedWords;
                      controller.selection = TextSelection.fromPosition(
                        TextPosition(offset: controller.text.length),
                      );
                    });
                  },
                  localeId: 'id_ID',
                );

                setModalState(() {
                  isListeningLocal = true;
                });
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                top: 24,
                left: 24,
                right: 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Edit Isi Nota Dinas',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navyDark,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () {
                            if (isListeningLocal) {
                              _speechToText.stop();
                            }
                            Navigator.pop(context);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: controller,
                      maxLines: 8,
                      decoration: InputDecoration(
                        labelText: 'Teks Isi Nota Dinas Resmi',
                        labelStyle: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.navy, width: 2),
                        ),
                        suffixIcon: IconButton(
                          icon: Icon(
                            isListeningLocal ? Icons.mic_rounded : Icons.mic_none_rounded,
                            color: isListeningLocal ? Colors.red : AppColors.navy,
                          ),
                          onPressed: toggleListening,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.navy,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () async {
                          if (isListeningLocal) {
                            await _speechToText.stop();
                          }
                          Navigator.pop(context); // close bottom sheet
                          _saveBodyText(controller.text.trim());
                        },
                        child: const Text('Simpan Perubahan', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _saveBodyText(String newContent) async {
    if (newContent.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Isi surat tidak boleh kosong'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final success = await context.read<NotaDinasProvider>().updateNotaDinasContent(
        _currentNotaDinas.id,
        newContent,
      );

      if (success) {
        final provider = context.read<NotaDinasProvider>();
        final updated = provider.notaDinasList.firstWhere(
          (nd) => nd.id == _currentNotaDinas.id,
          orElse: () => _currentNotaDinas.copyWith(isiNotaDinas: newContent),
        );
        setState(() {
          _currentNotaDinas = updated;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Isi surat berhasil diperbarui & PDF diunggah ulang!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        final error = providerErrorMessage(context);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(error ?? 'Gagal memperbarui isi surat'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Terjadi kesalahan: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  String? providerErrorMessage(BuildContext context) {
    try {
      return context.read<NotaDinasProvider>().errorMessage;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(_currentNotaDinas.createdAt) ?? DateTime.now();
    final formattedDate = DateFormat('dd MMMM yyyy, HH:mm', 'id_ID').format(date);

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text('Detail Nota Dinas', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            backgroundColor: AppColors.navy,
            foregroundColor: Colors.white,
            actions: [
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.white),
                onPressed: () => _confirmDelete(context),
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title Card
                Card(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: AppColors.navyDark,
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'NOTA DINAS',
                              style: TextStyle(
                                color: AppColors.gold,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              formattedDate,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.6),
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _currentNotaDinas.hal,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Nomor: ${_currentNotaDinas.nomor}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Metadata / Parameters Section
                const Text(
                  'Parameter Surat',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navyDark,
                  ),
                ),
                const SizedBox(height: 8),
                _buildInfoTile(Icons.person_rounded, 'Kepada Yth.', _currentNotaDinas.yth),
                _buildInfoTile(Icons.send_rounded, 'Dari', _currentNotaDinas.dari),
                _buildInfoTile(Icons.date_range_rounded, 'Tanggal Surat', _currentNotaDinas.tanggal),
                _buildInfoTile(Icons.info_outline, 'Sifat', _currentNotaDinas.sifat),
                _buildInfoTile(Icons.attachment_rounded, 'Lampiran', _currentNotaDinas.lampiran),
                const Divider(height: 32),

                // AI Prompts / Draft
                const Text(
                  'Poin-poin Draft',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navyDark,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    _currentNotaDinas.poinDraft,
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700, height: 1.4),
                  ),
                ),
                const Divider(height: 32),

                // Body of Nota Dinas
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Isi Nota Dinas',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navyDark,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.edit_rounded, color: AppColors.navy, size: 20),
                      onPressed: () => _editBodyText(context),
                      tooltip: 'Edit Isi Surat',
                      constraints: const BoxConstraints(),
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Text(
                    _currentNotaDinas.isiNotaDinas,
                    style: const TextStyle(fontSize: 14, height: 1.5, color: Colors.black87),
                  ),
                ),
                
                if (_currentNotaDinas.buktiDukung.isNotEmpty) ...[
                  const Divider(height: 32),
                  const Text(
                    'Berkas Lampiran',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navyDark,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: 160,
                    child: _buildAttachmentCard(
                      context,
                      'Foto Bukti Dukung',
                      _currentNotaDinas.buktiDukung,
                    ),
                  ),
                ],
                
                const SizedBox(height: 32),

                // Action Buttons (Edit & PDF)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _editBodyText(context),
                        icon: const Icon(Icons.edit_rounded, color: AppColors.navy),
                        label: const Text(
                          'Edit Isi Surat',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.navy),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: AppColors.navy, width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _viewPdf(context),
                        icon: const Icon(Icons.picture_as_pdf),
                        label: const Text(
                          'Cetak PDF',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.navy,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
        if (_isSaving)
          const LoadingOverlay(
            message: 'Memperbarui Isi Surat & Mengunggah PDF...',
          ),
      ],
    );
  }

  Widget _buildInfoTile(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.navy, size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 90,
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ),
                Text(
                  ':  ',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
                Expanded(
                  child: Text(
                    value.isNotEmpty ? value : '-',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.black87,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttachmentCard(BuildContext context, String label, String fileId) {
    final thumbnailUrl = 'https://drive.google.com/thumbnail?id=$fileId&sz=w300';
    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: () async {
          final url = 'https://drive.google.com/file/d/$fileId/view';
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Image.network(
              thumbnailUrl,
              height: 120,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Container(
                height: 120,
                color: Colors.grey.shade100,
                child: const Icon(Icons.broken_image, color: Colors.grey),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 12.0),
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.navyDark,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
