import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../config/app_theme.dart';
import '../../models/pengaduan.dart';
import '../../providers/pengaduan_provider.dart';
import '../../widgets/loading_overlay.dart';

class PengaduanDetailScreen extends StatefulWidget {
  final Pengaduan pengaduan;

  const PengaduanDetailScreen({super.key, required this.pengaduan});

  @override
  State<PengaduanDetailScreen> createState() => _PengaduanDetailScreenState();
}

class _PengaduanDetailScreenState extends State<PengaduanDetailScreen> {
  late Pengaduan _currentPengaduan;
  bool _isSaving = false;
  final stt.SpeechToText _speechToText = stt.SpeechToText();

  @override
  void initState() {
    super.initState();
    _currentPengaduan = widget.pengaduan;
  }

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label berhasil disalin ke clipboard'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _viewPdf(BuildContext context) async {
    if (_currentPengaduan.pdfFileId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('File PDF tidak ditemukan'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final url = 'https://drive.google.com/file/d/${_currentPengaduan.pdfFileId}/view';
    final uri = Uri.parse(url);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Membuka PDF laporan di browser...'),
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
            Text('Hapus Pengaduan'),
          ],
        ),
        content: Text(
          'Yakin ingin menghapus pengaduan atas nama "${_currentPengaduan.nama}"?\n\nTindakan ini akan menghapus data di Google Sheet dan file-file di Google Drive.',
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
              context.read<PengaduanProvider>().deletePengaduan(_currentPengaduan.id).then((_) {
                Navigator.pop(context); // back to list
              });
            },
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _editAnalysis(BuildContext context) {
    final controller = TextEditingController(text: _currentPengaduan.hasilAnalisa);
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
                          'Edit Analisa & Tindak Lanjut',
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
                        labelText: 'Narasi Analisis & Tindak Lanjut',
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
                          _saveAnalysis(controller.text.trim());
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

  Future<void> _saveAnalysis(String newAnalysis) async {
    if (newAnalysis.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Analisis tidak boleh kosong'), backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final success = await context.read<PengaduanProvider>().updatePengaduanAnalysis(
        _currentPengaduan.id,
        newAnalysis,
      );

      if (success) {
        // Retrieve the latest instance from the provider to ensure we reflect any spreadsheet-generated values (like pdfFileId)
        final provider = context.read<PengaduanProvider>();
        final updated = provider.pengaduans.firstWhere((p) => p.id == _currentPengaduan.id, orElse: () => _currentPengaduan.copyWith(hasilAnalisa: newAnalysis));
        setState(() {
          _currentPengaduan = updated;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Analisis berhasil diperbarui & PDF diunggah ulang!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        final error = context.read<PengaduanProvider>().errorMessage;
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(error ?? 'Gagal memperbarui analisis'),
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

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(_currentPengaduan.createdAt) ?? DateTime.now();
    final formattedDate = DateFormat('dd MMMM yyyy, HH:mm', 'id_ID').format(date);

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text('Detail Pengaduan', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
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
                // Header Card
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
                            Text(
                              _currentPengaduan.id,
                              style: TextStyle(
                                color: AppColors.gold.withOpacity(0.8),
                                fontSize: 12,
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
                          _currentPengaduan.nama,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.credit_card_rounded, color: Colors.white70, size: 16),
                            const SizedBox(width: 8),
                            Text(
                              _currentPengaduan.nik,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.copy_rounded, color: AppColors.gold, size: 18),
                              onPressed: () => _copyToClipboard(context, _currentPengaduan.nik, 'NIK'),
                              constraints: const BoxConstraints(),
                              padding: EdgeInsets.zero,
                              tooltip: 'Salin NIK',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Profile Details
                const Text(
                  'Informasi Sasaran',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navyDark,
                  ),
                ),
                const SizedBox(height: 8),
                _buildDetailTile(Icons.home_rounded, 'Alamat', _currentPengaduan.alamat),
                _buildDetailTile(Icons.location_city_rounded, 'Desa / Kelurahan', _currentPengaduan.desaKelurahan),
                _buildDetailTile(Icons.map_rounded, 'Kecamatan', _currentPengaduan.kecamatan),
                _buildDetailTile(Icons.location_on_rounded, 'Kabupaten / Kota', _currentPengaduan.kabKota),
                _buildDetailTile(
                  Icons.gps_fixed_rounded,
                  'Koordinat GPS',
                  '${_currentPengaduan.latitude}, ${_currentPengaduan.longitude}',
                  actionIcon: Icons.map,
                  onActionPressed: () async {
                    final url = 'https://www.google.com/maps/search/?api=1&query=${_currentPengaduan.latitude},${_currentPengaduan.longitude}';
                    final uri = Uri.parse(url);
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
                const Divider(height: 32),

                // Complaint description
                const Text(
                  'Aduan Masyarakat',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navyDark,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Text(
                    _currentPengaduan.aduan,
                    style: const TextStyle(fontSize: 14, height: 1.4, color: Colors.black87),
                  ),
                ),
                const Divider(height: 32),

                // AI Analysis & Tindak Lanjut
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Hasil Analisa Asisten Pendamping & Tindak Lanjut',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.navyDark,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.edit_rounded, color: AppColors.navy, size: 20),
                      onPressed: () => _editAnalysis(context),
                      tooltip: 'Edit Analisa',
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
                    color: Colors.blue.shade50.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Text(
                    _currentPengaduan.hasilAnalisa,
                    style: const TextStyle(fontSize: 14, height: 1.5, color: Colors.black87),
                  ),
                ),
                const Divider(height: 32),

                // Documents / Photos Attachments
                const Text(
                  'Berkas Lampiran',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.navyDark,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (_currentPengaduan.fotoKtp.isNotEmpty)
                      Expanded(
                        child: _buildAttachmentCard(
                          context,
                          'Foto KTP',
                          _currentPengaduan.fotoKtp,
                        ),
                      )
                    else
                      const Expanded(child: SizedBox()),
                    const SizedBox(width: 12),
                    if (_currentPengaduan.screenshotSiks.isNotEmpty)
                      Expanded(
                        child: _buildAttachmentCard(
                          context,
                          'Screenshot SIKS-NG',
                          _currentPengaduan.screenshotSiks,
                        ),
                      )
                    else
                      const Expanded(child: SizedBox()),
                  ],
                ),
                const SizedBox(height: 32),

                // PDF Action Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: () => _viewPdf(context),
                    icon: const Icon(Icons.picture_as_pdf),
                    label: const Text(
                      'Lihat / Cetak Laporan PDF',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
        if (_isSaving)
          const LoadingOverlay(
            message: 'Memperbarui Analisa & Mengunggah PDF...',
          ),
      ],
    );
  }

  Widget _buildDetailTile(
    IconData icon,
    String label,
    String value, {
    IconData? actionIcon,
    VoidCallback? onActionPressed,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.navy, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value.isNotEmpty ? value : '-',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
          if (actionIcon != null && onActionPressed != null && value.isNotEmpty && value != '-')
            IconButton(
              icon: Icon(actionIcon, color: AppColors.gold, size: 20),
              onPressed: onActionPressed,
              constraints: const BoxConstraints(),
              padding: EdgeInsets.zero,
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
