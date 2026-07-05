import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';
import '../../providers/report_provider.dart';
import '../../widgets/loading_overlay.dart';

/// Narrative Screen — Preview & Edit narasi AI + Generate PDF
class NarrativeScreen extends StatefulWidget {
  const NarrativeScreen({super.key});

  @override
  State<NarrativeScreen> createState() => _NarrativeScreenState();
}

class _NarrativeScreenState extends State<NarrativeScreen> {
  final TextEditingController _narrativeController = TextEditingController();
  String? _reportId;
  bool _hasGenerated = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_reportId == null) {
      _reportId = ModalRoute.of(context)?.settings.arguments as String?;
      if (_reportId != null && !_hasGenerated) {
        _hasGenerated = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _generateNarrative();
        });
      }
    }
  }

  @override
  void dispose() {
    _narrativeController.dispose();
    super.dispose();
  }

  Future<void> _generateNarrative() async {
    if (_reportId == null) return;
    final formProvider = context.read<FormProvider>();
    final auth = context.read<AuthProvider>();
    
    final narrative = await formProvider.generateNarrative(
      auth: auth,
      reportId: _reportId!,
    );
    
    if (narrative != null && mounted) {
      setState(() {
        _narrativeController.text = narrative;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Preview Narasi'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Consumer<FormProvider>(
        builder: (context, formProvider, _) {
          return Stack(
            children: [
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Status bar
                    _buildStatusBar(formProvider),
                    const SizedBox(height: 16),

                    // Narrative editor
                    Container(
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardTheme.color ?? Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: AppColors.navy.withOpacity(0.05),
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.edit_document, size: 20, color: AppColors.navy),
                                const SizedBox(width: 8),
                                const Expanded(
                                  child: Text(
                                    'Narasi Laporan',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.navyDark,
                                    ),
                                  ),
                                ),
                                Text(
                                  'Bisa diedit',
                                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                                ),
                              ],
                            ),
                          ),

                          // Text area
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: TextField(
                              controller: _narrativeController,
                              maxLines: null,
                              minLines: 20,
                              style: const TextStyle(fontSize: 13, height: 1.6),
                              decoration: InputDecoration(
                                hintText: formProvider.isGeneratingNarrative
                                    ? 'Asisten Pendamping sedang membuat narasi...'
                                    : 'Narasi akan muncul di sini',
                                hintStyle: TextStyle(color: Colors.grey[400]),
                                border: InputBorder.none,
                                filled: false,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Action buttons
                    Row(
                      children: [
                        // Regenerate
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: formProvider.isGeneratingNarrative
                                ? null
                                : _generateNarrative,
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: const Text('Buat Ulang'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.navy,
                              side: const BorderSide(color: AppColors.navy),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Save & Generate PDF
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            onPressed: (formProvider.isGeneratingPdf || 
                                       _narrativeController.text.isEmpty)
                                ? null
                                : _handleSaveAndGeneratePdf,
                            icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                            label: const Text('Simpan & Buat PDF'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.navy,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 80),
                  ],
                ),
              ),

              // Loading overlays
              if (formProvider.isGeneratingNarrative)
                const LoadingOverlay(
                  message: '🤖 Asisten Pendamping sedang membuat narasi...\nProses ini memerlukan beberapa detik',
                ),
              if (formProvider.isGeneratingPdf)
                const LoadingOverlay(
                  message: '📄 Membuat PDF...\nMenyimpan ke Google Drive',
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatusBar(FormProvider formProvider) {
    Color bgColor;
    Color textColor;
    IconData icon;
    String text;

    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (formProvider.isGeneratingNarrative) {
      bgColor = isDark ? Colors.blue[900]!.withOpacity(0.3) : Colors.blue[50]!;
      textColor = isDark ? Colors.blue[200]! : Colors.blue[700]!;
      icon = Icons.hourglass_top_rounded;
      text = 'Asisten Pendamping sedang membuat narasi...';
    } else if (formProvider.errorMessage != null) {
      bgColor = isDark ? Colors.red[900]!.withOpacity(0.3) : Colors.red[50]!;
      textColor = isDark ? Colors.red[200]! : Colors.red[700]!;
      icon = Icons.error_outline_rounded;
      text = formProvider.errorMessage!;
    } else if (_narrativeController.text.isNotEmpty) {
      bgColor = isDark ? Colors.green[900]!.withOpacity(0.3) : Colors.green[50]!;
      textColor = isDark ? Colors.green[200]! : Colors.green[700]!;
      icon = Icons.check_circle_outline_rounded;
      text = 'Narasi berhasil di-generate! Anda dapat mengedit sebelum menyimpan.';
    } else {
      bgColor = isDark ? AppColors.surfaceDark : Colors.grey[100]!;
      textColor = isDark ? AppColors.textSecondaryDark : Colors.grey[600]!;
      icon = Icons.info_outline_rounded;
      text = 'Menunggu narasi...';
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: textColor, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 13, color: textColor, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleSaveAndGeneratePdf() async {
    if (_reportId == null) return;

    final formProvider = context.read<FormProvider>();
    final auth = context.read<AuthProvider>();

    // Save edited narrative first
    await formProvider.saveNarrative(
      auth: auth,
      reportId: _reportId!,
      narrative: _narrativeController.text,
    );

    // Generate PDF
    final success = await formProvider.generatePdf(
      auth: auth,
      reportId: _reportId!,
    );

    if (success && mounted) {
      // Refresh reports
      context.read<ReportProvider>().loadReports();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text('PDF berhasil dibuat & disimpan ke Google Drive'),
              ),
            ],
          ),
          backgroundColor: Colors.green[700],
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );

      // Go back to home
      Navigator.popUntil(context, ModalRoute.withName('/home'));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Gagal membuat PDF: ${formProvider.errorMessage ?? "Terjadi kesalahan"}'),
              ),
            ],
          ),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
  }
}
