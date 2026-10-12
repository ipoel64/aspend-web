import 'dart:async';
import 'package:flutter/material.dart';
import '../config/app_theme.dart';

/// Loading overlay widget with optional animated progress bar (0% - 100%)
class LoadingOverlay extends StatefulWidget {
  final String message;
  final bool showProgress;

  const LoadingOverlay({
    super.key,
    this.message = 'Memproses...',
    this.showProgress = false,
  });

  @override
  State<LoadingOverlay> createState() => _LoadingOverlayState();
}

class _LoadingOverlayState extends State<LoadingOverlay> {
  Timer? _timer;
  double _progress = 0.05;

  @override
  void initState() {
    super.initState();
    if (widget.showProgress) {
      _startProgressSimulation();
    }
  }

  void _startProgressSimulation() {
    // Simulates natural progress from 5% up to 96%
    _timer = Timer.periodic(const Duration(milliseconds: 250), (timer) {
      if (!mounted) return;
      setState(() {
        if (_progress < 0.30) {
          _progress += 0.025;
        } else if (_progress < 0.65) {
          _progress += 0.018;
        } else if (_progress < 0.88) {
          _progress += 0.012;
        } else if (_progress < 0.96) {
          _progress += 0.005;
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _getProgressStatus(int percent) {
    if (percent < 25) {
      return 'Menganalisis data kegiatan...';
    } else if (percent < 50) {
      return 'Menyusun pendahuluan & maksud tujuan...';
    } else if (percent < 75) {
      return 'Memformulasikan uraian kegiatan...';
    } else if (percent < 90) {
      return 'Menyusun hasil & rencana tindak lanjut...';
    } else {
      return 'Menyelesaikan format narasi laporan...';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final percent = (_progress * 100).toInt();

    return Container(
      color: Colors.black.withOpacity(0.65),
      child: Center(
        child: Container(
          width: MediaQuery.of(context).size.width * 0.85,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 26),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!widget.showProgress) ...[
                const SizedBox(
                  width: 44,
                  height: 44,
                  child: CircularProgressIndicator(
                    strokeWidth: 3.5,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.navy),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  widget.message,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
              ] else ...[
                // Animated AI Icon
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.navy, AppColors.gold],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.gold.withOpacity(0.35),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 28),
                  ),
                ),
                const SizedBox(height: 18),
                
                // Main Message
                Text(
                  widget.message,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),

                // Dynamic Status Step
                Text(
                  _getProgressStatus(percent),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),

                // Progress Bar & Percentage
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: _progress,
                    minHeight: 10,
                    backgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.gold),
                  ),
                ),
                const SizedBox(height: 10),

                // Percentage number
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Harap tunggu sebentar',
                      style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                    ),
                    Text(
                      '$percent%',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
