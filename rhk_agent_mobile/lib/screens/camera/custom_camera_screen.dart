import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';

class CustomCameraScreen extends StatefulWidget {
  final String title;
  const CustomCameraScreen({super.key, this.title = 'Scan KTP'});

  @override
  State<CustomCameraScreen> createState() => _CustomCameraScreenState();
}

class _CustomCameraScreenState extends State<CustomCameraScreen> with SingleTickerProviderStateMixin {
  List<CameraDescription> _cameras = [];
  CameraController? _controller;
  bool _isInitialized = false;
  bool _isCapturing = false;
  
  late AnimationController _animationController;
  late Animation<double> _laserAnimation;

  @override
  void initState() {
    super.initState();
    _initCamera();
    
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);

    _animationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    
    _laserAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(_animationController);
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        _showError('Kamera tidak ditemukan');
        return;
      }

      // Gunakan kamera belakang default
      final backCamera = _cameras.firstWhere(
        (cam) => cam.lensDirection == CameraLensDirection.back,
        orElse: () => _cameras.first,
      );

      _controller = CameraController(
        backCamera,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );

      await _controller!.initialize();
      
      // Kunci orientasi capture ke landscapeLeft agar preview & foto stabil dalam landscape di Samsung A12
      await _controller!.lockCaptureOrientation(DeviceOrientation.landscapeLeft);

      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
    } catch (e) {
      _showError('Gagal inisialisasi kamera: $e');
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red),
      );
    }
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    _animationController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _capturePhoto() async {
    if (_controller == null || !_controller!.value.isInitialized || _isCapturing) return;

    setState(() {
      _isCapturing = true;
    });

    try {
      final XFile file = await _controller!.takePicture();
      if (mounted) {
        Navigator.pop(context, file.path);
      }
    } catch (e) {
      setState(() {
        _isCapturing = false;
      });
      _showError('Gagal mengambil foto: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized || _controller == null) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Colors.cyanAccent),
          ),
        ),
      );
    }

    final size = MediaQuery.of(context).size;
    
    // Dimensi bounding box KTP untuk Landscape mode (kotak kartu mendatar mengikuti orientasi layar)
    final boxHeight = size.height * 0.65; // 65% dari tinggi layar
    final boxWidth = boxHeight * 1.58; // Aspek rasio standar kartu KTP (1.58:1)

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera Preview (Auto-scale to fill screen without distortion)
          Positioned.fill(
            child: ClipRect(
              child: FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: _controller!.value.aspectRatio,
                  height: 1,
                  child: CameraPreview(_controller!),
                ),
              ),
            ),
          ),

          // Dark overlay with cut-out for KTP using HolePainter
          Positioned.fill(
            child: CustomPaint(
              painter: HolePainter(
                boxWidth: boxWidth,
                boxHeight: boxHeight,
                borderRadius: 16,
              ),
            ),
          ),

          // Bounding Box Border and Laser animation
          Center(
            child: Container(
              width: boxWidth,
              height: boxHeight,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.cyanAccent, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.cyanAccent.withOpacity(0.15),
                    blurRadius: 10,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Stack(
                  children: [
                    // Corner brackets (glowing)
                    _buildCornerBrackets(),

                    // Animated Laser line
                    AnimatedBuilder(
                      animation: _laserAnimation,
                      builder: (context, child) {
                        return Positioned(
                          top: _laserAnimation.value * (boxHeight - 4),
                          left: 0,
                          right: 0,
                          child: Container(
                            height: 3,
                            decoration: BoxDecoration(
                              color: Colors.cyanAccent,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.cyanAccent.withOpacity(0.8),
                                  blurRadius: 8,
                                  spreadRadius: 2,
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
          ),

          // Top Back button
          Positioned(
            top: MediaQuery.of(context).padding.top + 12,
            left: 16,
            child: CircleAvatar(
              backgroundColor: Colors.black.withOpacity(0.5),
              child: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ),

          // Top Title
          Positioned(
            top: MediaQuery.of(context).padding.top + 20,
            left: 0,
            right: 0,
            child: Center(
              child: Text(
                widget.title.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                  shadows: [
                    Shadow(color: Colors.black, blurRadius: 4, offset: Offset(1, 1)),
                  ],
                ),
              ),
            ),
          ),

          // Bottom guidance text
          Positioned(
            bottom: 20,
            left: 20,
            right: 120, // avoid overlap with capture button on right
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white12),
                ),
                child: const Text(
                  'Posisikan KTP Mendatar (Landscape) di dalam kotak scanner',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),

          // Right capture button area
          Positioned(
            right: 24,
            top: 0,
            bottom: 0,
            child: Center(
              child: _isCapturing
                  ? const CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.cyanAccent),
                    )
                  : GestureDetector(
                      onTap: _capturePhoto,
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 4),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.4),
                              blurRadius: 12,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Container(
                          margin: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Colors.cyanAccent,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.camera_alt_rounded,
                            color: Colors.black,
                            size: 32,
                          ),
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCornerBrackets() {
    const double size = 18;
    const double thickness = 3;
    return Stack(
      children: [
        // Top-left
        Positioned(
          top: 6,
          left: 6,
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
          top: 6,
          right: 6,
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
          bottom: 6,
          left: 6,
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
          bottom: 6,
          right: 6,
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

class HolePainter extends CustomPainter {
  final double boxWidth;
  final double boxHeight;
  final double borderRadius;

  HolePainter({
    required this.boxWidth,
    required this.boxHeight,
    this.borderRadius = 16,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withOpacity(0.75)
      ..style = PaintingStyle.fill;

    final center = Offset(size.width / 2, size.height / 2);
    final rect = Rect.fromCenter(center: center, width: boxWidth, height: boxHeight);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(borderRadius));

    final backgroundPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final holePath = Path()..addRRect(rrect);

    final path = Path.combine(PathOperation.difference, backgroundPath, holePath);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant HolePainter oldDelegate) {
    return oldDelegate.boxWidth != boxWidth || oldDelegate.boxHeight != boxHeight;
  }
}
