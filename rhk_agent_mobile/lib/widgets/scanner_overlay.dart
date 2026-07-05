import 'dart:io';
import 'package:flutter/material.dart';

class ScannerOverlay extends StatefulWidget {
  final File imageFile;
  final String message;

  const ScannerOverlay({
    super.key,
    required this.imageFile,
    required this.message,
  });

  @override
  State<ScannerOverlay> createState() => _ScannerOverlayState();
}

class _ScannerOverlayState extends State<ScannerOverlay> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.0, end: 1.0).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withOpacity(0.85),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Scanner Title
              const Icon(Icons.document_scanner_rounded, color: Colors.cyanAccent, size: 48),
              const SizedBox(height: 12),
              const Text(
                'AI DOCUMENT SCANNER',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 24),

              // Bounding box with image and animated laser
              Container(
                width: double.infinity,
                height: 220,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.cyanAccent, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.cyanAccent.withOpacity(0.2),
                      blurRadius: 16,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Stack(
                    children: [
                      // Document image
                      Positioned.fill(
                        child: Image.file(
                          widget.imageFile,
                          fit: BoxFit.cover,
                        ),
                      ),

                      // Holographic overlay
                      Positioned.fill(
                        child: Container(
                          color: Colors.cyanAccent.withOpacity(0.05),
                        ),
                      ),

                      // Corner brackets
                      _buildCornerBrackets(),

                      // Scanning Laser Line
                      AnimatedBuilder(
                        animation: _animation,
                        builder: (context, child) {
                          return Positioned(
                            top: _animation.value * 216,
                            left: 0,
                            right: 0,
                            child: Container(
                              height: 4,
                              decoration: BoxDecoration(
                                color: Colors.cyanAccent,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.cyanAccent.withOpacity(0.8),
                                    blurRadius: 10,
                                    spreadRadius: 3,
                                  ),
                                  BoxShadow(
                                    color: Colors.cyanAccent.withOpacity(0.5),
                                    blurRadius: 20,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Status message with pulse effect
              Text(
                widget.message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 16),
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.cyanAccent),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCornerBrackets() {
    const double size = 20;
    const double thickness = 3;
    return Stack(
      children: [
        // Top-left
        Positioned(
          top: 8,
          left: 8,
          child: Container(
            width: size,
            height: size,
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: Colors.cyanAccent, width: thickness),
                left: BorderSide(color: Colors.cyanAccent, width: thickness),
              ),
            ),
          ),
        ),
        // Top-right
        Positioned(
          top: 8,
          right: 8,
          child: Container(
            width: size,
            height: size,
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: Colors.cyanAccent, width: thickness),
                right: BorderSide(color: Colors.cyanAccent, width: thickness),
              ),
            ),
          ),
        ),
        // Bottom-left
        Positioned(
          bottom: 8,
          left: 8,
          child: Container(
            width: size,
            height: size,
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.cyanAccent, width: thickness),
                left: BorderSide(color: Colors.cyanAccent, width: thickness),
              ),
            ),
          ),
        ),
        // Bottom-right
        Positioned(
          bottom: 8,
          right: 8,
          child: Container(
            width: size,
            height: size,
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Colors.cyanAccent, width: thickness),
                right: BorderSide(color: Colors.cyanAccent, width: thickness),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
