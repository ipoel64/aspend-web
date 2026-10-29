import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/constants.dart';
import '../../config/master_data.dart';
import '../../models/p2k2_data.dart';
import '../../providers/auth_provider.dart';
import '../../providers/form_provider.dart';
import '../../providers/report_provider.dart';
import '../../services/ai_service.dart';
import '../../services/sound_service.dart';
import '../../widgets/loading_overlay.dart';
import '../../utils/dialog_utils.dart';

/// Item data RHK
class _RhkItem {
  final String id;
  final String title;
  const _RhkItem({required this.id, required this.title});
}

/// Asisten Pendamping Interaktif Mode Percakapan
/// Respon cepat, input suara terus-menerus, barge-in (interupsi langsung),
/// alur P2K2 lengkap (Modul, Sesi, KPM), dan eksekusi langsung ke PDF resmi diakhiri popup dashboard.
class JarvisAssistantScreen extends StatefulWidget {
  const JarvisAssistantScreen({super.key});

  @override
  State<JarvisAssistantScreen> createState() => _JarvisAssistantScreenState();
}

class _JarvisAssistantScreenState extends State<JarvisAssistantScreen>
    with TickerProviderStateMixin {
  // TTS & STT
  final FlutterTts _tts = FlutterTts();
  final stt.SpeechToText _stt = stt.SpeechToText();
  bool _isTtsReady = false;
  bool _isSpeaking = false;
  bool _isListening = false;
  bool _isMuted = false;
  bool _sttInitialized = false;
  String _sttLocaleId = 'id_ID';
  String _userTranscriptText = '';
  DateTime? _lastVoiceProcessedTime;
  String _lastHandledUtterance = '';
  int _lastHandledStep = -1;

  DateTime? _ttsStartTime;
  DateTime? _ttsFinishedTime;

  // Animation Controllers
  late AnimationController _waveController;
  late AnimationController _pulseController;

  // Form State:
  // Step 0: RHK
  // Step 1: Aksi
  // Step 2: Foto
  // Step 3: Waktu
  // Step 4: Lokasi
  // Step 5: Poin Kegiatan
  // Step 6: P2K2 Modul (khusus RHK-2)
  // Step 7: P2K2 Sesi & KPM (khusus RHK-2)
  // Step 8: Eksekusi Narasi & PDF
  int _currentStep = 0;
  String? _selectedJenisRHK;
  String? _selectedIdRHK;
  String? _selectedRencanaAksi;

  // Step 2: Foto Dukung
  final List<XFile> _selectedPhotos = [];

  // Step 3: Waktu Kegiatan
  DateTime _selectedDate = DateTime.now();
  String _selectedPukul = '';

  // Step 4: Lokasi Kegiatan
  String _lokasi = '';
  final TextEditingController _lokasiController = TextEditingController();

  // Step 5: Poin Kegiatan
  String _poinKegiatan = '';
  final TextEditingController _poinController = TextEditingController();

  // Khusus RHK-2 (P2K2)
  String? _selectedModulP2K2;
  String? _selectedSesiP2K2;
  String _jumlahKpm = '20';
  String _jumlahHadir = '20';

  // Step Eksekusi: Narasi & PDF
  final TextEditingController _narrativeController = TextEditingController();
  bool _isSubmittingReport = false;
  bool _isGeneratingNarrative = false;
  bool _isGeneratingPdf = false;
  bool _isCompleted = false;

  // Headlines
  String _assistantHeadline = 'Halo Boss, siap bantu!';
  String _assistantSubText = 'Mau buat laporan RHK apa hari ini?';

  bool get _isRhk2 =>
      _selectedIdRHK == 'RHK-2' ||
      (_selectedJenisRHK != null && _selectedJenisRHK!.toUpperCase().contains('P2K2'));

  String _getTimeGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 4 && hour < 11) return 'selamat pagi';
    if (hour >= 11 && hour < 15) return 'selamat siang';
    if (hour >= 15 && hour < 18) return 'selamat sore';
    return 'selamat malam';
  }

  /// Memperhalus fonetik teks untuk Google TTS Bahasa Indonesia agar fasih & natural
  String _sanitizeForVoice(String text) {
    return text
        .replaceAll('RHK-1', 'R H K satu')
        .replaceAll('RHK-2', 'R H K dua')
        .replaceAll('RHK-3', 'R H K tiga')
        .replaceAll('RHK-4', 'R H K empat')
        .replaceAll('RHK-5', 'R H K lima')
        .replaceAll('RHK-6', 'R H K enam')
        .replaceAll('RHK-7', 'R H K tujuh')
        .replaceAll('RHK-8', 'R H K delapan')
        .replaceAll('RHK-9', 'R H K sembilan')
        .replaceAll('RHK 1', 'R H K satu')
        .replaceAll('RHK 2', 'R H K dua')
        .replaceAll('RHK 3', 'R H K tiga')
        .replaceAll('RHK 4', 'R H K empat')
        .replaceAll('RHK 5', 'R H K lima')
        .replaceAll('RHK 6', 'R H K enam')
        .replaceAll('RHK 7', 'R H K tujuh')
        .replaceAll('RHK 8', 'R H K delapan')
        .replaceAll('RHK 9', 'R H K sembilan')
        .replaceAll('P2K2', 'P dua K dua')
        .replaceAll('KPM', 'K P M')
        .replaceAll('WIB', 'W I B')
        .replaceAll('AI', 'Asisten Pendamping')
        .replaceAll('Ai', 'Asisten Pendamping')
        .replaceAll('ai', 'Asisten Pendamping')
        .replaceAll('PDF', 'P D F');
  }

  List<_RhkItem> _getJenisRhkList() {
    final jenisSdm = context.read<AuthProvider>().userProfile?.jenisSdm ?? 'SDM PKH';
    final raw = getUniqueJenisRHK(jenisSdm);
    return raw.map((item) => _RhkItem(
      id: item['id'] ?? '',
      title: item['jenisRhk'] ?? '',
    )).toList();
  }

  List<String> _getRencanaAksiList() {
    if (_selectedJenisRHK == null) return [];
    final jenisSdm = context.read<AuthProvider>().userProfile?.jenisSdm ?? 'SDM PKH';
    return getRencanaAksiByJenis(_selectedJenisRHK!, jenisSdm);
  }

  @override
  void initState() {
    super.initState();

    // Audio Fluid Wave Controller
    _waveController = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    )..repeat();

    // Subtle Glow Pulse Controller
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1100),
      vsync: this,
    )..repeat(reverse: true);

    // Default Time
    final now = DateTime.now();
    _selectedPukul = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    // Putar sound intro (durasi 10 detik, diputar sekali saja)
    SoundService.playIntroSound();

    _initTtsAndStt();
  }

  @override
  void dispose() {
    SoundService.stopSound();
    _tts.stop();
    _stt.stop();
    _waveController.dispose();
    _pulseController.dispose();
    _lokasiController.dispose();
    _poinController.dispose();
    _narrativeController.dispose();
    super.dispose();
  }

  Future<void> _initTtsAndStt() async {
    try {
      if (Platform.isAndroid) {
        try {
          final engines = await _tts.getEngines;
          if (engines is List && engines.contains('com.google.android.tts')) {
            await _tts.setEngine('com.google.android.tts');
          }
        } catch (_) {}
      }

      await _tts.setLanguage('id-ID');
      await _tts.setPitch(1.0);
      await _tts.setSpeechRate(0.50); // Nada wajar, jelas, dan santai
      await _tts.setVolume(0.85); // Suara jelas tanpa distorsi speaker berlebihan

      try {
        final voices = await _tts.getVoices;
        if (voices is List) {
          for (var v in voices) {
            if (v is Map) {
              final name = v['name']?.toString().toLowerCase() ?? '';
              final locale = v['locale']?.toString().toLowerCase() ?? '';
              if (locale.startsWith('id')) {
                if (name.contains('dfz') || name.contains('id-id-x-dfz') || name.contains('female') || name.contains('wanita')) {
                  await _tts.setVoice({'name': v['name'], 'locale': v['locale']});
                  break;
                }
              }
            }
          }
        }
      } catch (_) {}

      _tts.setStartHandler(() {
        if (mounted) {
          setState(() {
            _isSpeaking = true;
            _isListening = false;
          });
        }
        _ttsStartTime = DateTime.now();
      });

      _tts.setCompletionHandler(() {
        if (mounted) {
          setState(() {
            _isSpeaking = false;
            _ttsFinishedTime = DateTime.now();
          });
          // Sistem SELESAI berbicara -> mikrofon LANGSUNG AKTIF seketika tanpa jeda!
          if (!_isCompleted && !_isSubmittingReport) {
            _startListening();
          }
        }
      });

      _tts.setErrorHandler((_) {
        if (mounted) {
          setState(() {
            _isSpeaking = false;
            _ttsFinishedTime = DateTime.now();
          });
          if (!_isCompleted && !_isSubmittingReport) {
            _startListening();
          }
        }
      });

      _isTtsReady = true;

      _sttInitialized = await _stt.initialize(
        onError: (e) {
          debugPrint('STT Error: $e');
          if (mounted && _isListening && !_isSpeaking && !_isCompleted && !_isSubmittingReport) {
            _triggerListenInternal();
          }
        },
        onStatus: (s) {
          debugPrint('STT Status: $s');
          if (s == 'done' || s == 'notListening') {
            if (mounted && _isListening && !_isSpeaking && !_isCompleted && !_isSubmittingReport) {
              _triggerListenInternal();
            } else if (mounted) {
              setState(() => _isListening = false);
            }
          } else if (s == 'listening') {
            if (mounted && !_isListening) {
              setState(() => _isListening = true);
            }
          }
        },
      );

      try {
        final locales = await _stt.locales();
        for (var l in locales) {
          final idLower = l.localeId.toLowerCase();
          if (idLower.startsWith('id') || idLower.startsWith('in')) {
            _sttLocaleId = l.localeId;
            break;
          }
        }
      } catch (_) {}

      // Mulai sambutan ramah
      Future.delayed(const Duration(milliseconds: 300), _startGreeting);
    } catch (e) {
      debugPrint('Error init TTS/STT: $e');
    }
  }

  String _normalizeForComparison(String text) {
    return text
        .toLowerCase()
        .replaceAll('rhk-1', 'rhk 1')
        .replaceAll('rhk-2', 'rhk 2')
        .replaceAll('rhk-3', 'rhk 3')
        .replaceAll('rhk-4', 'rhk 4')
        .replaceAll('rhk-5', 'rhk 5')
        .replaceAll('rhk-6', 'rhk 6')
        .replaceAll('rhk-7', 'rhk 7')
        .replaceAll('rhk-8', 'rhk 8')
        .replaceAll('rhk-9', 'rhk 9')
        .replaceAll('r h k', 'rhk')
        .replaceAll('p2k2', 'p2k2')
        .replaceAll('p dua k dua', 'p2k2')
        .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  String _numberToWords(int n) {
    switch (n) {
      case 1: return 'satu';
      case 2: return 'dua';
      case 3: return 'tiga';
      case 4: return 'empat';
      case 5: return 'lima';
      case 6: return 'enam';
      case 7: return 'tujuh';
      case 8: return 'delapan';
      case 9: return 'sembilan';
      default: return '$n';
    }
  }

  Future<void> _speak(String displayText, {String? voiceText}) async {
    if (!mounted) return;

    // Pastikan mikrofon mati total saat sistem sedang berbicara
    _stopListening();

    setState(() {
      _assistantSubText = displayText;
      _isSpeaking = true;
      _isListening = false;
      _userTranscriptText = '';
    });

    final rawSpeech = voiceText ?? displayText;

    if (!_isMuted && _isTtsReady) {
      _ttsStartTime = DateTime.now();
      await _tts.speak(_sanitizeForVoice(rawSpeech));
    } else {
      _isSpeaking = false;
      if (!_isCompleted && !_isSubmittingReport) {
        _startListening();
      }
    }
  }

  Future<void> _startGreeting() async {
    final greeting = _getTimeGreeting();
    setState(() {
      _assistantHeadline = 'Halo Boss, $greeting!';
    });
    await _speak(
      'Mau buat laporan RHK apa hari ini, Boss?',
      voiceText: 'Halo Boss, $greeting! Mau buat laporan R H K berapa hari ini?',
    );
  }

  void _startListening() async {
    if (!mounted || _isSpeaking || _isSubmittingReport || _isCompleted) return;

    if (!_sttInitialized) {
      _sttInitialized = await _stt.initialize(
        onError: (e) {
          debugPrint('STT Error: $e');
          if (mounted && _isListening && !_isSpeaking && !_isCompleted && !_isSubmittingReport) {
            _triggerListenInternal();
          }
        },
        onStatus: (s) {
          debugPrint('STT Status: $s');
          if (s == 'done' || s == 'notListening') {
            if (mounted && _isListening && !_isSpeaking && !_isCompleted && !_isSubmittingReport) {
              _triggerListenInternal();
            } else if (mounted) {
              setState(() => _isListening = false);
            }
          } else if (s == 'listening') {
            if (mounted && !_isListening) {
              setState(() => _isListening = true);
            }
          }
        },
      );
    }

    if (!_sttInitialized || !mounted) return;

    setState(() {
      _isListening = true;
    });

    _triggerListenInternal();
  }

  void _triggerListenInternal() async {
    if (!mounted || _isSpeaking || _isSubmittingReport || _isCompleted || _stt.isListening) return;

    try {
      await _stt.listen(
        onResult: (result) {
          if (!mounted || _isSpeaking) return;

          final words = result.recognizedWords.toLowerCase().trim();
          if (words.isEmpty) return;

          setState(() {
            _userTranscriptText = result.recognizedWords;
          });

          // 1. Eksekusi cepat jika terdeteksi aksi yang cocok
          final processed = _tryFastActionRecognition(words);
          if (processed) return;

          // 2. Jika pengenalan final selesai, proses di handler utama
          if (result.finalResult) {
            _processVoiceInput(words);
          }
        },
        localeId: _sttLocaleId,
        listenMode: stt.ListenMode.confirmation,
        pauseFor: const Duration(seconds: 4),
        listenFor: const Duration(seconds: 45),
        cancelOnError: false,
        partialResults: true,
      );
    } catch (e) {
      debugPrint('STT listen error: $e');
    }
  }

  void _stopListening() async {
    try {
      await _stt.stop();
    } catch (_) {}
    if (mounted) {
      setState(() => _isListening = false);
    }
  }

  /// Toggle mode dengar suara secara manual via tombol gelombang animasi di tengah
  void _toggleListeningMode() {
    SoundService.playConfirmSound();
    if (_isSpeaking) {
      // Seketika itu juga suara sistem berhenti dan langsung mendengar suara user!
      _tts.stop();
      setState(() => _isSpeaking = false);
      if (!_isCompleted && !_isSubmittingReport) {
        _startListening();
      }
      return;
    }

    if (_isListening) {
      _stopListening();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mendengarkan dijeda. Ketuk kembali tombol tengah untuk mengaktifkan.'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      _startListening();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mendengarkan aktif. Silakan berbicara langsung.'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  int? _extractSpokenNumber(String words) {
    final clean = ' ${words.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), ' ')} ';
    if (RegExp(r'\b(1|satu|kesatu|pertama)\b').hasMatch(clean)) return 1;
    if (RegExp(r'\b(2|dua|kedua)\b').hasMatch(clean)) return 2;
    if (RegExp(r'\b(3|tiga|ketiga)\b').hasMatch(clean)) return 3;
    if (RegExp(r'\b(4|empat|keempat)\b').hasMatch(clean)) return 4;
    if (RegExp(r'\b(5|lima|kelima)\b').hasMatch(clean)) return 5;
    if (RegExp(r'\b(6|enam|keenam)\b').hasMatch(clean)) return 6;
    if (RegExp(r'\b(7|tujuh|ketujuh)\b').hasMatch(clean)) return 7;
    if (RegExp(r'\b(8|delapan|kedelapan)\b').hasMatch(clean)) return 8;
    if (RegExp(r'\b(9|sembilan|kesembilan)\b').hasMatch(clean)) return 9;
    return null;
  }

  /// Eksekusi cepat jika kata kunci terdeteksi tanpa harus menunggu jeda diam lama
  bool _tryFastActionRecognition(String words) {
    if (_isSpeaking) return false;

    final now = DateTime.now();
    if (_lastVoiceProcessedTime != null && now.difference(_lastVoiceProcessedTime!).inMilliseconds < 350) {
      return false;
    }
    if (words == _lastHandledUtterance && _currentStep == _lastHandledStep) {
      return false;
    }

    if (words.contains('batal') || words.contains('keluar') || words.contains('tutup')) {
      _lastVoiceProcessedTime = now;
      _lastHandledUtterance = words;
      _lastHandledStep = _currentStep;
      _confirmCancel();
      return true;
    }

    // Step 0: RHK
    if (_currentStep == 0) {
      final rhkList = _getJenisRhkList();
      final num = _extractSpokenNumber(words);
      if (num != null && num >= 1 && num <= rhkList.length) {
        _lastVoiceProcessedTime = now;
        _lastHandledUtterance = words;
        _lastHandledStep = 0;
        _selectJenisRHK(rhkList[num - 1]);
        return true;
      }
      for (var rhk in rhkList) {
        final idNum = rhk.id.replaceAll(RegExp(r'[^0-9]'), '');
        final isExplicitRhk = RegExp('\\b(rhk|nomor|pilihan)\\s*0?$idNum\\b').hasMatch(words);
        final isP2k2Match = idNum == '2' && RegExp(r'\b(p2k2|p 2 k 2|fams)\b').hasMatch(words);
        if (isExplicitRhk || isP2k2Match) {
          _lastVoiceProcessedTime = now;
          _lastHandledUtterance = words;
          _lastHandledStep = 0;
          _selectJenisRHK(rhk);
          return true;
        }
      }
    }

    // Step 1: Rencana Aksi
    if (_currentStep == 1) {
      final actions = _getRencanaAksiList();
      final num = _extractSpokenNumber(words);
      if (num != null && num >= 1 && num <= actions.length) {
        _lastVoiceProcessedTime = now;
        _lastHandledUtterance = words;
        _lastHandledStep = 1;
        _selectRencanaAksi(actions[num - 1]);
        return true;
      }
      for (int i = 0; i < actions.length; i++) {
        final action = actions[i];
        final actionIndex = (i + 1).toString();
        final isExplicitIndex = RegExp('\\b(nomor|pilihan|opsi|aksi)\\s*0?$actionIndex\\b').hasMatch(words);
        final actionKeywords = action.toLowerCase().split(RegExp(r'[^a-z0-9]')).where((w) => w.length >= 5).toSet();
        final spokenWords = words.split(RegExp(r'[^a-z0-9]')).where((w) => w.length >= 5).toSet();
        final matchedKeywordsCount = spokenWords.where((w) => actionKeywords.contains(w)).length;
        if (isExplicitIndex || matchedKeywordsCount >= 2) {
          _lastVoiceProcessedTime = now;
          _lastHandledUtterance = words;
          _lastHandledStep = 1;
          _selectRencanaAksi(action);
          return true;
        }
      }
    }

    // Step 2: Foto (Wajib)
    if (_currentStep == 2) {
      if (words.contains('kamera') || words.contains('foto')) {
        _lastVoiceProcessedTime = now;
        _lastHandledUtterance = words;
        _lastHandledStep = 2;
        _pickPhoto(ImageSource.camera);
        return true;
      }
      if (words.contains('galeri') || words.contains('album')) {
        _lastVoiceProcessedTime = now;
        _lastHandledUtterance = words;
        _lastHandledStep = 2;
        _pickPhoto(ImageSource.gallery);
        return true;
      }
      if (words.contains('lanjut') || words.contains('selesai') || words.contains('sudah')) {
        _lastVoiceProcessedTime = now;
        _lastHandledUtterance = words;
        _lastHandledStep = 2;
        _proceedToWaktu();
        return true;
      }
    }

    // Step 3: Waktu
    if (_currentStep == 3 && (words.contains('sekarang') || words.contains('hari ini') || words.contains('lanjut') || words.contains('ya') || words.contains('oke'))) {
      _lastVoiceProcessedTime = now;
      _confirmWaktu(true);
      return true;
    }

    // Step 5: Poin
    if (_currentStep == 5) {
      if (words.contains('riwayat')) {
        _lastVoiceProcessedTime = now;
        _showRiwayatPoinBottomSheet();
        return true;
      }
      if (words.contains('lanjut') || words.contains('selesai') || words.contains('buat narasi')) {
        _lastVoiceProcessedTime = now;
        _proceedFromPoin();
        return true;
      }
    }

    // Step 6: Modul P2K2
    if (_currentStep == 6) {
      final moduls = getUniqueModulP2K2();
      final num = _extractSpokenNumber(words);
      if (num != null && num >= 1 && num <= moduls.length) {
        _lastVoiceProcessedTime = now;
        _selectModulP2K2(moduls[num - 1]);
        return true;
      }
    }

    // Step 7: Sesi P2K2
    if (_currentStep == 7 && _selectedModulP2K2 != null) {
      final sesiList = getSesiByModul(_selectedModulP2K2!);
      final num = _extractSpokenNumber(words);
      if (num != null && num >= 1 && num <= sesiList.length) {
        _lastVoiceProcessedTime = now;
        _selectSesiP2K2(sesiList[num - 1]);
        return true;
      }
    }

    return false;
  }

  void _processVoiceInput(String words) {
    if (_isSpeaking) return;

    final now = DateTime.now();
    if (_lastVoiceProcessedTime != null && now.difference(_lastVoiceProcessedTime!).inMilliseconds < 350) {
      return;
    }
    if (words == _lastHandledUtterance && _currentStep == _lastHandledStep) {
      return;
    }
    _lastVoiceProcessedTime = now;

    if (words.contains('batal') || words.contains('keluar') || words.contains('tutup')) {
      _lastHandledUtterance = words;
      _lastHandledStep = _currentStep;
      _confirmCancel();
      return;
    }

    switch (_currentStep) {
      case 0: // Jenis RHK
        final rhkList = _getJenisRhkList();
        final rhkNum = _extractSpokenNumber(words);
        if (rhkNum != null && rhkNum >= 1 && rhkNum <= rhkList.length) {
          _lastHandledUtterance = words;
          _lastHandledStep = 0;
          _selectJenisRHK(rhkList[rhkNum - 1]);
          return;
        }
        for (var rhk in rhkList) {
          final idNum = rhk.id.replaceAll(RegExp(r'[^0-9]'), '');
          final isExplicitRhk = RegExp('\\b(rhk|nomor|pilihan)\\s*0?$idNum\\b').hasMatch(words);
          final isP2k2Match = idNum == '2' && RegExp(r'\b(p2k2|p 2 k 2|fams)\b').hasMatch(words);
          if (isExplicitRhk || isP2k2Match) {
            _lastHandledUtterance = words;
            _lastHandledStep = 0;
            _selectJenisRHK(rhk);
            return;
          }
        }
        _speak('Belum cocok Boss. Sebutkan nomor RHK atau ketuk di layar.');
        break;

      case 1: // Rencana Aksi
        final actions = _getRencanaAksiList();
        final actionNum = _extractSpokenNumber(words);
        if (actionNum != null && actionNum >= 1 && actionNum <= actions.length) {
          _lastHandledUtterance = words;
          _lastHandledStep = 1;
          _selectRencanaAksi(actions[actionNum - 1]);
          return;
        }
        for (int i = 0; i < actions.length; i++) {
          final action = actions[i];
          final actionIndex = (i + 1).toString();
          final isExplicitIndex = RegExp('\\b(nomor|pilihan|opsi|aksi)\\s*0?$actionIndex\\b').hasMatch(words);
          final actionKeywords = action.toLowerCase().split(RegExp(r'[^a-z0-9]')).where((w) => w.length >= 5).toSet();
          final spokenWords = words.split(RegExp(r'[^a-z0-9]')).where((w) => w.length >= 5).toSet();
          final matchedKeywordsCount = spokenWords.where((w) => actionKeywords.contains(w)).length;
          if (isExplicitIndex || matchedKeywordsCount >= 2) {
            _lastHandledUtterance = words;
            _lastHandledStep = 1;
            _selectRencanaAksi(action);
            return;
          }
        }
        _speak('Silakan pilih nomor atau sebutkan rencana aksinya, Boss.');
        break;

      case 2: // Foto Bukti Dukung (Wajib)
        _lastHandledUtterance = words;
        _lastHandledStep = 2;
        if (words.contains('kamera') || words.contains('foto')) {
          _pickPhoto(ImageSource.camera);
        } else if (words.contains('galeri') || words.contains('album')) {
          _pickPhoto(ImageSource.gallery);
        } else if (words.contains('lanjut') || words.contains('selesai') || words.contains('sudah')) {
          _proceedToWaktu();
        } else {
          if (_selectedPhotos.isEmpty) {
            _speak('Foto bukti dukung wajib diisi, Boss. Sebutkan kamera atau galeri untuk mengambil foto.');
          } else {
            _speak('Foto sudah tersimpan, Boss. Sebutkan "lanjut" atau ketuk tombol di layar untuk lanjut ke waktu kegiatan.');
          }
        }
        break;

      case 3: // Waktu Kegiatan
        if (words.contains('sekarang') || words.contains('hari ini') || words.contains('lanjut') || words.contains('ya') || words.contains('oke') || words.contains('sesuai') || words.contains('benar')) {
          _confirmWaktu(true);
        }
        break;

      case 4: // Lokasi Kegiatan
        if (words.length > 2) {
          _selectLokasi(words);
        }
        break;

      case 5: // Poin Kegiatan
        if (words.contains('riwayat')) {
          _showRiwayatPoinBottomSheet();
        } else if (words.contains('lanjut') || words.contains('selesai') || words.contains('buat narasi')) {
          _proceedFromPoin();
        } else if (words.length > 3) {
          setState(() {
            if (_poinController.text.trim().isEmpty) {
              _poinController.text = '• $words';
            } else {
              _poinController.text += '\n• $words';
            }
            _poinKegiatan = _poinController.text;
          });
          _speak('Poin dicatat Boss. Ada poin lain, atau sebutkan lanjut?');
        }
        break;

      case 6: // P2K2: Modul (Jika RHK-2)
        final moduls = getUniqueModulP2K2();
        final modNum = _extractSpokenNumber(words);
        if (modNum != null && modNum >= 1 && modNum <= moduls.length) {
          _selectModulP2K2(moduls[modNum - 1]);
          return;
        }
        for (int i = 0; i < moduls.length; i++) {
          final m = moduls[i];
          final mLower = m.toLowerCase();
          if (words.contains('nomor ${i + 1}') ||
              words.contains('${i + 1}') ||
              mLower.contains(words) ||
              words.split(' ').any((w) => w.length > 4 && mLower.contains(w))) {
            _selectModulP2K2(m);
            return;
          }
        }
        _speak('Pilih modul P2K2 di layar Boss.');
        break;

      case 7: // P2K2: Sesi (Jika RHK-2)
        if (_selectedModulP2K2 != null) {
          final sesiList = getSesiByModul(_selectedModulP2K2!);
          final sesNum = _extractSpokenNumber(words);
          if (sesNum != null && sesNum >= 1 && sesNum <= sesiList.length) {
            _selectSesiP2K2(sesiList[sesNum - 1]);
            return;
          }
          for (int i = 0; i < sesiList.length; i++) {
            final s = sesiList[i];
            final sLower = s.toLowerCase();
            if (words.contains('sesi ${i + 1}') ||
                words.contains('nomor ${i + 1}') ||
                words.contains('${i + 1}') ||
                sLower.contains(words)) {
              _selectSesiP2K2(s);
              return;
            }
          }
        }
        _speak('Pilih sesi P2K2 di layar Boss.');
        break;
    }
  }

  // STEP 0: Pilih Jenis RHK -> Konfirmasi jawaban sebelumnya!
  void _selectJenisRHK(_RhkItem item) {
    SoundService.playConfirmSound();
    setState(() {
      _selectedJenisRHK = item.title;
      _selectedIdRHK = item.id;
      _currentStep = 1;
      _lastHandledStep = 0;
      _assistantHeadline = 'RHK ${item.id} Terpilih';
      _userTranscriptText = '';
    });

    _speak(
      'Baik Boss, RHK ${item.id} dipilih. Untuk rencana aksinya, apa yang akan Boss lakukan?',
      voiceText: 'Baik Boss, R H K ${item.id} dipilih. Untuk rencana aksinya, apa yang akan Boss lakukan?',
    );
  }

  // STEP 1: Pilih Rencana Aksi -> Konfirmasi jawaban sebelumnya & beralih ke Foto Wajib!
  void _selectRencanaAksi(String action) {
    SoundService.playConfirmSound();
    setState(() {
      _selectedRencanaAksi = action;
      _currentStep = 2; // Ke Foto Bukti Dukung (WAJIB)
      _lastHandledStep = 1;
      _assistantHeadline = 'Foto Bukti Dukung (Wajib)';
      _userTranscriptText = '';
    });

    _speak(
      'Rencana aksi dicatat. Mohon masukkan foto bukti dukung kegiatan, Boss.',
      voiceText: 'Rencana aksi dicatat Boss. Mohon masukkan foto bukti dukung, lewat kamera atau galeri.',
    );
  }

  // STEP 2: Input Foto Dukung (Wajib)
  Future<void> _pickPhoto(ImageSource source) async {
    final picker = ImagePicker();
    if (source == ImageSource.gallery) {
      final images = await picker.pickMultiImage();
      if (images.isNotEmpty) {
        setState(() {
          _selectedPhotos.addAll(images);
          _userTranscriptText = '';
        });
        SoundService.playConfirmSound();
        _speak(
          'Baik Boss, ${_selectedPhotos.length} foto tersimpan. Sebutkan lanjut untuk ke waktu kegiatan.',
          voiceText: 'Baik Boss, ${_selectedPhotos.length} foto tersimpan. Sebutkan lanjut untuk ke waktu kegiatan.',
        );
      }
    } else {
      final image = await picker.pickImage(source: source);
      if (image != null) {
        setState(() {
          _selectedPhotos.add(image);
          _userTranscriptText = '';
        });
        SoundService.playConfirmSound();
        _speak(
          'Baik Boss, foto bukti dukung tersimpan. Sebutkan lanjut untuk ke waktu kegiatan.',
          voiceText: 'Baik Boss, foto bukti dukung tersimpan. Sebutkan lanjut untuk ke waktu kegiatan.',
        );
      }
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _selectedPhotos.removeAt(index);
    });
  }

  void _proceedToWaktu() {
    if (_selectedPhotos.isEmpty) {
      _speak(
        'Foto bukti dukung wajib diisi, Boss. Silakan ambil dari kamera atau pilih galeri.',
        voiceText: 'Foto bukti dukung wajib diisi, Boss. Silakan ambil dari kamera atau pilih galeri.',
      );
      return;
    }
    SoundService.playConfirmSound();
    setState(() {
      _currentStep = 3;
      _lastHandledStep = 2;
      _assistantHeadline = 'Waktu Pelaksanaan';
      _userTranscriptText = '';
    });

    final now = DateTime.now();
    final jamStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    _speak('Kapan waktu kegiatannya, Boss? Apakah hari ini pukul $jamStr WIB?');
  }

  // STEP 3: Konfirmasi Waktu -> Konfirmasi jawaban sebelumnya!
  void _confirmWaktu(bool useNow) {
    SoundService.playConfirmSound();
    if (useNow) {
      _selectedDate = DateTime.now();
      final now = DateTime.now();
      _selectedPukul = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    }

    final tglStr = DateFormat('d MMMM yyyy', 'id_ID').format(_selectedDate);

    setState(() {
      _currentStep = 4;
      _assistantHeadline = 'Lokasi Kegiatan';
    });

    _speak(
      'Waktu kegiatan tanggal $tglStr pukul $_selectedPukul WIB disimpan Boss. Di mana lokasi kegiatannya?',
      voiceText: 'Waktu kegiatan disimpan Boss. Di mana lokasi kegiatannya?',
    );
  }

  // STEP 4: Lokasi Kegiatan -> Konfirmasi jawaban sebelumnya!
  void _selectLokasi(String loc) {
    SoundService.playConfirmSound();
    setState(() {
      _lokasi = loc;
      _lokasiController.text = loc;
      _currentStep = 5;
      _assistantHeadline = 'Poin-Poin Kegiatan';
    });

    _speak(
      'Lokasi di $loc dicatat Boss. Sebutkan apa saja poin-poin kegiatannya Boss.',
      voiceText: 'Lokasi di $loc dicatat Boss. Sebutkan poin-poin kegiatannya.',
    );
  }

  // STEP 5: Poin Kegiatan
  Future<void> _showRiwayatPoinBottomSheet() async {
    final prefs = await SharedPreferences.getInstance();
    final historyKey = 'poin_history_${_selectedIdRHK ?? ""}';
    final history = prefs.getStringList(historyKey) ?? [];

    if (history.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Belum ada riwayat poin untuk ${_selectedIdRHK ?? "RHK ini"}'),
            backgroundColor: Colors.orange[800],
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        side: BorderSide(color: Color(0xFF38BDF8), width: 1),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.history_rounded, color: Color(0xFF38BDF8), size: 22),
                      const SizedBox(width: 10),
                      Text(
                        'Riwayat Poin ${_selectedIdRHK ?? ""}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 22),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: history.length,
                  separatorBuilder: (_, __) => Divider(color: Colors.white.withOpacity(0.08)),
                  itemBuilder: (context, index) {
                    final item = history[index];
                    return ListTile(
                      title: Text(item, style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4)),
                      trailing: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF38BDF8)),
                      onTap: () {
                        Navigator.pop(ctx);
                        setState(() {
                          if (_poinController.text.trim().isEmpty) {
                            _poinController.text = item;
                          } else {
                            _poinController.text = '${_poinController.text.trim()}\n$item';
                          }
                          _poinKegiatan = _poinController.text;
                        });
                        _speak('Poin ditambahkan dari riwayat Boss.');
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

  /// Lanjut dari Poin Kegiatan: Jika RHK-2 arahkan ke input Modul & Sesi, jika bukan langsung eksekusi!
  void _proceedFromPoin() {
    if (_poinController.text.trim().isEmpty) {
      _speak('Mohon sebutkan atau ketik minimal satu poin kegiatan, Boss.');
      return;
    }

    setState(() {
      _poinKegiatan = _poinController.text.trim();
    });

    if (_isRhk2) {
      // Masuk ke tahap input Modul P2K2
      SoundService.playConfirmSound();
      setState(() {
        _currentStep = 6;
        _assistantHeadline = 'Modul P2K2';
      });
      _speak(
        'Poin kegiatan dicatat. Untuk P2K2, modul apa yang disampaikan Boss?',
        voiceText: 'Poin kegiatan dicatat Boss. Untuk P dua K dua, modul apa yang disampaikan?',
      );
    } else {
      // Non-RHK-2: Langsung eksekusi narasi & PDF sampai selesai tanpa konfirmasi berbelit!
      _executeFullDirectNarrativeAndPdf();
    }
  }

  // STEP 6: Pilih Modul P2K2
  void _selectModulP2K2(String modul) {
    SoundService.playConfirmSound();
    setState(() {
      _selectedModulP2K2 = modul;
      _currentStep = 7;
      _assistantHeadline = 'Sesi P2K2 & KPM';
    });

    _speak(
      'Modul dipilih. Sekarang sesi berapa yang dibahas Boss?',
      voiceText: 'Modul dipilih Boss. Sekarang sesi berapa yang dibahas?',
    );
  }

  // STEP 7: Pilih Sesi P2K2 & Detail KPM
  void _selectSesiP2K2(String sesi) {
    SoundService.playConfirmSound();
    setState(() {
      _selectedSesiP2K2 = sesi;
    });

    _speak(
      'Sesi dicatat. Ketuk tombol untuk langsung proses PDF.',
      voiceText: 'Sesi dicatat Boss. Ketuk tombol untuk langsung proses P D F resmi ya Boss.',
    );
  }

  // STEP AKHIR: Eksekusi Langsung Sampai Jadi PDF Resmi & Kembali ke Dashboard dengan Popup Selesai
  Future<void> _executeFullDirectNarrativeAndPdf() async {
    if (_isSubmittingReport) return;

    final auth = context.read<AuthProvider>();
    final formProvider = context.read<FormProvider>();

    // Validasi esensial
    if (_selectedJenisRHK == null || _selectedRencanaAksi == null) {
      _speak('Jenis RHK dan Rencana Aksi wajib dipilih, Boss.');
      return;
    }
    if (_selectedPhotos.isEmpty) {
      _speak('Mohon tambahkan minimal satu foto bukti dukung, Boss.');
      setState(() => _currentStep = 2);
      return;
    }

    setState(() {
      _isSubmittingReport = true;
      _isGeneratingNarrative = true;
      _isGeneratingPdf = false;
      _currentStep = 8;
      _assistantHeadline = 'Membuat Narasi Laporan...';
      _assistantSubText = 'Asisten Pendamping sedang membuat narasi resmi Kemensos...';
    });

    SoundService.playConfirmSound();
    _speak(
      'Sedang merangkai narasi resmi dan membuat file PDF resmi, mohon tunggu sebentar ya Boss...',
      voiceText: 'Sedang merangkai narasi resmi dan membuat file P D F resmi, mohon tunggu sebentar ya Boss...',
    );

    try {
      // 1. Susun Narasi Resmi
      final aiService = AiService();
      final profile = auth.userProfile;
      final model = AppConstants.defaultOpenRouterModel;
      final isLlama = model.toLowerCase().contains('llama');

      final prompt = aiService.buildReportPrompt(
        jenisRHK: _selectedJenisRHK ?? '',
        rencanaAksi: _selectedRencanaAksi ?? '',
        tanggal: _selectedDate.toIso8601String(),
        pukul: _selectedPukul,
        poinKegiatan: _poinKegiatan,
        lokasi: _lokasi,
        kecamatan: profile?.kecamatan,
        kabupatenKota: profile?.kabupatenKota,
        provinsi: profile?.provinsi,
        namaPetugas: profile?.nama,
        jabatanPetugas: profile?.jabatan,
        isLlama: isLlama,
      );

      final stream = aiService.generateNarrativeStream(
        provider: 'openrouter',
        apiKey: AppConstants.defaultOpenRouterApiKey,
        model: model,
        prompt: prompt,
      );

      String compiledNarrative = '';
      await for (final chunk in stream) {
        compiledNarrative += chunk;
        if (mounted) {
          setState(() {
            _narrativeController.text = compiledNarrative;
          });
        }
      }

      // Bersihkan tag lokasi jika ada
      final locRegex = RegExp(r'<lokasi>(.*?)</lokasi>', dotAll: true, caseSensitive: false);
      final locMatch = locRegex.firstMatch(compiledNarrative);
      if (locMatch != null) {
        final extracted = locMatch.group(1)?.trim() ?? '';
        if (_lokasi.isEmpty && extracted.isNotEmpty) {
          _lokasi = extracted;
        }
        compiledNarrative = compiledNarrative.replaceAll(locRegex, '').trim();
      }

      compiledNarrative = compiledNarrative
          .replaceAll('“', '"')
          .replaceAll('”', '"')
          .replaceAll('‘', "'")
          .replaceAll('’', "'")
          .replaceAll('–', '-')
          .replaceAll('—', '-')
          .replaceAll('•', '-');

      // Update state loading ke pembuatan PDF
      if (mounted) {
        setState(() {
          _isGeneratingNarrative = false;
          _isGeneratingPdf = true;
          _assistantHeadline = 'Membuat Dokumen PDF...';
          _assistantSubText = 'Mengunggah foto dan membuat dokumen PDF resmi ke Google Drive...';
        });
      }

      // 2. Data P2K2 jika RHK-2
      P2K2Data? p2k2;
      if (_isRhk2) {
        p2k2 = P2K2Data(
          modul: _selectedModulP2K2 ?? 'MODUL P2K2',
          sesi: _selectedSesiP2K2 ?? _selectedRencanaAksi ?? '',
          jumlahKPM: _jumlahKpm,
          jumlahHadir: _jumlahHadir,
          tempatPelaksanaan: _lokasi,
          namaPemateri: auth.userProfile?.nama ?? '',
          jabatanPemateri: auth.userProfile?.jabatan ?? '',
          isPemateriDiriSendiri: true,
          desaKelurahan: '',
          kecamatan: auth.userProfile?.kecamatan ?? '',
          kabupatenKota: auth.userProfile?.kabupatenKota ?? '',
          provinsi: auth.userProfile?.provinsi ?? '',
        );
      }

      // 3. Submit Laporan Awal (Upload Foto ke Drive & Row di Sheets)
      final reportId = await formProvider.submitReport(
        auth: auth,
        jenisRHK: _selectedJenisRHK!,
        idRHK: _selectedIdRHK ?? '',
        rencanaAksi: _selectedRencanaAksi!,
        tanggal: _selectedDate.toIso8601String(),
        pukul: _selectedPukul,
        poinKegiatan: _poinKegiatan,
        photos: _selectedPhotos,
        p2k2Data: p2k2,
        physicalLokasi: _lokasi,
        showTanggalInPdf: true,
        showPukulInPdf: true,
      );

      if (reportId == null) {
        throw Exception(formProvider.errorMessage ?? 'Gagal membuat laporan dasar.');
      }

      // 4. Simpan Narasi
      if (compiledNarrative.isNotEmpty) {
        await formProvider.saveNarrative(
          auth: auth,
          reportId: reportId,
          narrative: compiledNarrative,
          location: _lokasi,
        );
      }

      // 5. Generate File PDF Resmi & Upload ke Drive Output (Status di Sheets -> 'Selesai')
      final pdfSuccess = await formProvider.generatePdf(
        auth: auth,
        reportId: reportId,
      );

      if (mounted) {
        setState(() {
          _isGeneratingNarrative = false;
          _isGeneratingPdf = false;
          _isSubmittingReport = false;
        });
      }

      // Refresh laporan di dashboard
      context.read<ReportProvider>().loadReports();

      // Cek apakah mencapai batas kuota PDF gratis harian (3x sehari)
      if (!pdfSuccess && formProvider.errorMessage != null && formProvider.errorMessage!.contains('LIMIT_REACHED')) {
        SoundService.stopSound();
        _tts.stop();
        _stt.stop();
        if (mounted) {
          DialogUtils.showPremiumLimitDialog(context);
        }
        return;
      }

      if (!pdfSuccess) {
        throw Exception(formProvider.errorMessage ?? 'Gagal membuat file PDF resmi.');
      }

      // 6. Simpan Riwayat Poin
      if (_selectedIdRHK != null && _selectedIdRHK!.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        final historyKey = 'poin_history_${_selectedIdRHK}';
        final history = prefs.getStringList(historyKey) ?? [];
        final newPoint = _poinKegiatan.trim();
        if (newPoint.isNotEmpty) {
          final isNew = !history.contains(newPoint);
          history.remove(newPoint);
          history.insert(0, newPoint);
          if (history.length > 10) history.removeLast();
          await prefs.setStringList(historyKey, history);

          if (isNew && auth.sheetsService != null && auth.spreadsheetId != null) {
            auth.sheetsService!.appendRow(
              auth.spreadsheetId!,
              AppConstants.sheetRiwayatPoin,
              [_selectedIdRHK, newPoint, DateTime.now().toIso8601String()],
            ).catchError((_) {});
          }
        }
      }

      SoundService.playConfirmSound();
      SoundService.stopSound();

      _tts.stop();
      _stt.stop();

      // 8. LANGSUNG KELUAR KE DASHBOARD DAN TAMPILKAN POPUP SELESAI!
      if (mounted) {
        Navigator.pop(context, {
          'success': true,
          'reportId': reportId,
          'idRHK': _selectedIdRHK,
          'jenisRHK': _selectedJenisRHK,
        });
      }
    } catch (e) {
      debugPrint('Submit & PDF error: $e');
      if (mounted) {
        setState(() {
          _isSubmittingReport = false;
          _isGeneratingNarrative = false;
          _isGeneratingPdf = false;
        });
        final errStr = e.toString().toLowerCase();
        String spokenErr = 'Terjadi kendala saat memproses laporan, Boss.';
        if (errStr.contains('certificate') || errStr.contains('handshake')) {
          spokenErr = 'Tanggal dan waktu di HP belum sinkron dengan server. Silakan aktifkan waktu otomatis di HP, Boss.';
        } else if (errStr.contains('timed out') || errStr.contains('connection') || errStr.contains('network')) {
          spokenErr = 'Koneksi internet terputus atau tidak stabil saat memproses, Boss.';
        }
        _speak(spokenErr);
      }
    }
  }

  void _confirmCancel() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF38BDF8), width: 1),
        ),
        title: const Row(
          children: [
            Icon(Icons.info_outline_rounded, color: Color(0xFF38BDF8), size: 24),
            SizedBox(width: 8),
            Text('Keluar dari Asisten?', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: const Text(
          'Apakah Anda ingin membatalkan dan keluar ke Dashboard?',
          style: TextStyle(color: Colors.white70, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Lanjutkan', style: TextStyle(color: Color(0xFF38BDF8))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              SoundService.stopSound();
              _tts.stop();
              _stt.stop();
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red[800]),
            child: const Text('Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712), // Deep Obsidian Dark
      body: SafeArea(
        child: Stack(
          children: [
            // Ambient Blue Glow
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 280,
              child: IgnorePointer(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: const Alignment(0, 1.2),
                      radius: 1.2,
                      colors: [
                        const Color(0xFF1D4ED8).withOpacity(0.35),
                        const Color(0xFF3B82F6).withOpacity(0.15),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),

            Column(
              children: [
                // Top Bar
                _buildTopBar(),

                // Center Aspend Logo dengan Animasi Teknologi
                _buildHeroArea(),

                // Interactive Content Card
                Expanded(
                  child: _buildStepCardContent(),
                ),

                // Live User Transcription Subtitle
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _isSpeaking
                            ? Icons.volume_up_rounded
                            : (_isListening ? Icons.mic_rounded : Icons.mic_off_rounded),
                        color: _isSpeaking
                            ? const Color(0xFF38BDF8)
                            : (_isListening ? const Color(0xFF10B981) : Colors.white38),
                        size: 15,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          _userTranscriptText.isNotEmpty
                              ? '🗣️ "$_userTranscriptText"'
                              : (_isSpeaking
                                  ? '🔊 Asisten berbicara... (Ketuk tengah untuk menyela)'
                                  : (_isListening
                                      ? '🎙️ Mendengarkan suara Anda...'
                                      : '⏸️ Suara dijeda (ketuk tombol tengah)')),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: _userTranscriptText.isNotEmpty
                                ? const Color(0xFF38BDF8)
                                : (_isSpeaking
                                    ? const Color(0xFF93C5FD)
                                    : (_isListening ? const Color(0xFF10B981) : Colors.white38)),
                            fontSize: 12,
                            fontStyle: _userTranscriptText.isNotEmpty ? FontStyle.italic : FontStyle.normal,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),

                // Bottom Controls: Wave Capsule di Tengah & Tombol Tutup
                _buildBottomBar(),
              ],
            ),

            // Loading Overlays proses pembuatan narasi & PDF (seperti pada pembuatan RHK biasa)
            if (_isGeneratingNarrative)
              const LoadingOverlay(
                message: 'Asisten Pendamping sedang membuat narasi...\nProses ini memerlukan beberapa detik',
                showProgress: true,
              ),
            if (_isGeneratingPdf)
              const LoadingOverlay(
                message: '📄 Membuat PDF...\nMenyimpan ke Google Drive',
              ),
          ],
        ),
      ),
    );
  }

  /// Top Bar Khas Asisten Pendamping
  Widget _buildTopBar() {
    String stepLabel = 'Jenis RHK';
    switch (_currentStep) {
      case 0: stepLabel = 'Jenis RHK'; break;
      case 1: stepLabel = 'Rencana Aksi'; break;
      case 2: stepLabel = 'Foto Bukti Dukung'; break;
      case 3: stepLabel = 'Waktu Kegiatan'; break;
      case 4: stepLabel = 'Lokasi Kegiatan'; break;
      case 5: stepLabel = 'Poin Kegiatan'; break;
      case 6: stepLabel = 'Modul P2K2'; break;
      case 7: stepLabel = 'Sesi P2K2'; break;
      default: stepLabel = 'Memproses PDF'; break;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: _confirmCancel,
            icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 26),
            tooltip: 'Tutup',
          ),

          // Central Step Badge: "Asisten Pendamping"
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B).withOpacity(0.7),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: _isSpeaking
                        ? const Color(0xFF38BDF8)
                        : (_isListening ? const Color(0xFF10B981) : Colors.grey),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Asisten Pendamping • $stepLabel',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          // Sound Toggle
          IconButton(
            onPressed: () {
              setState(() {
                _isMuted = !_isMuted;
                if (_isMuted) _tts.stop();
              });
            },
            icon: Icon(
              _isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
              color: _isMuted ? Colors.redAccent : Colors.white70,
              size: 22,
            ),
            tooltip: _isMuted ? 'Nyalakan Suara' : 'Matikan Suara',
          ),
        ],
      ),
    );
  }

  /// Hero Area: Logo Aspend dengan Animasi Teknologi Berputar & Bercahaya
  Widget _buildHeroArea() {
    return GestureDetector(
      onTap: () {
        if (_isSpeaking) {
          HapticFeedback.lightImpact();
          _toggleListeningMode();
        }
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final pulse = _pulseController.value;
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer cyber rotating glowing ring
                    Transform.rotate(
                      angle: _waveController.value * 2 * math.pi,
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: (_isListening ? const Color(0xFF10B981) : const Color(0xFF00F0FF))
                                .withOpacity(0.4 + 0.4 * pulse),
                            width: 2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (_isListening ? const Color(0xFF10B981) : const Color(0xFF00F0FF))
                                  .withOpacity(0.35 + 0.25 * pulse),
                              blurRadius: 18 + (8 * pulse),
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Inner tech dash ring
                  Transform.rotate(
                    angle: -_waveController.value * 2 * math.pi,
                    child: Container(
                      width: 66,
                      height: 66,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFF38BDF8).withOpacity(0.6),
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),

                  // Central Aspend Logo (Icon Utama Aplikasi)
                  Container(
                    width: 52,
                    height: 52,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF070B19),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Image.asset(
                      'assets/images/app_icon.png',
                      fit: BoxFit.cover,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 12),

          // Clean Headline
          Text(
            _assistantHeadline,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 5),

          // Conversational Sub-text / Prompt
          Text(
            _assistantSubText,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withOpacity(0.78),
              fontSize: 13.5,
              height: 1.35,
            ),
          ),
        ],
      ),
    ),
  );
}

  Widget _buildStepCardContent() {
    switch (_currentStep) {
      case 0:
        return _buildJenisRhkStep();
      case 1:
        return _buildRencanaAksiStep();
      case 2:
        return _buildFotoDukungStep();
      case 3:
        return _buildWaktuStep();
      case 4:
        return _buildLokasiStep();
      case 5:
        return _buildPoinStep();
      case 6:
        return _buildModulP2K2Step();
      case 7:
        return _buildSesiP2K2Step();
      case 8:
        return _buildProgressStep();
      default:
        return const SizedBox.shrink();
    }
  }

  // Step 0: Pilih Jenis RHK
  Widget _buildJenisRhkStep() {
    final list = _getJenisRhkList();
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final item = list[index];
        final isSelected = _selectedJenisRHK == item.title;

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => _selectJenisRHK(item),
              borderRadius: BorderRadius.circular(16),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFF1E293B)
                      : const Color(0xFF111827).withOpacity(0.75),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFF38BDF8)
                        : Colors.white.withOpacity(0.08),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF38BDF8)
                            : const Color(0xFF1F2937),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          item.id.replaceAll(RegExp(r'[^0-9]'), ''),
                          style: TextStyle(
                            color: isSelected ? Colors.black87 : Colors.white70,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.id,
                            style: const TextStyle(
                              color: Color(0xFF38BDF8),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // Step 1: Pilih Rencana Aksi
  Widget _buildRencanaAksiStep() {
    final actions = _getRencanaAksiList();
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      itemCount: actions.length,
      itemBuilder: (context, index) {
        final action = actions[index];
        final isSelected = _selectedRencanaAksi == action;

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => _selectRencanaAksi(action),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFF1E293B)
                      : const Color(0xFF111827).withOpacity(0.75),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFF38BDF8)
                        : Colors.white.withOpacity(0.08),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1F2937),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.4)),
                      ),
                      child: Center(
                        child: Text(
                          '${index + 1}',
                          style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        action,
                        style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // Step 2: Input Foto Dukung
  Widget _buildFotoDukungStep() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _pickPhoto(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_rounded, color: Colors.black87),
                  label: const Text('Buka Kamera', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF38BDF8),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickPhoto(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_rounded, color: Colors.white),
                  label: const Text('Dari Galeri', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF38BDF8)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Grid Foto Terpilih
          Expanded(
            child: _selectedPhotos.isEmpty
                ? Center(
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: const Color(0xFF111827).withOpacity(0.6),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.08)),
                      ),
                      child: const Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add_photo_alternate_outlined, color: Colors.white38, size: 48),
                          SizedBox(height: 10),
                          Text(
                            'Belum ada foto bukti dukung',
                            style: TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Sebutkan "kamera" atau "galeri", atau tekan tombol di atas',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white38, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  )
                : GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: _selectedPhotos.length,
                    itemBuilder: (context, index) {
                      return Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(
                              File(_selectedPhotos[index].path),
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: () => _removePhoto(index),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.redAccent,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close, size: 12, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _selectedPhotos.isNotEmpty ? _proceedToWaktu : null,
              icon: Icon(
                _selectedPhotos.isNotEmpty ? Icons.arrow_forward_rounded : Icons.lock_outline_rounded,
                color: _selectedPhotos.isNotEmpty ? Colors.black87 : Colors.white38,
              ),
              label: Text(
                _selectedPhotos.isEmpty
                    ? 'Foto Bukti Dukung Wajib Diisi'
                    : 'Lanjut ke Waktu Kegiatan (${_selectedPhotos.length} Foto)',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: _selectedPhotos.isNotEmpty ? Colors.black87 : Colors.white38,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _selectedPhotos.isNotEmpty ? const Color(0xFF38BDF8) : Colors.white.withOpacity(0.08),
                disabledBackgroundColor: Colors.white.withOpacity(0.08),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Step 3: Waktu
  Widget _buildWaktuStep() {
    final formattedDate = DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(_selectedDate);

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFF111827).withOpacity(0.8),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.3)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tanggal:', style: TextStyle(color: Colors.white70, fontSize: 13)),
                    Text(formattedDate, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ],
                ),
                const Divider(color: Colors.white12, height: 22),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Pukul:', style: TextStyle(color: Colors.white70, fontSize: 13)),
                    Text('$_selectedPukul WIB', style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => _confirmWaktu(true),
              icon: const Icon(Icons.check_circle_rounded, color: Colors.black87),
              label: const Text('Gunakan Waktu Saat Ini', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF38BDF8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: () async {
              final pickedDate = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime(2020),
                lastDate: DateTime.now().add(const Duration(days: 30)),
              );
              if (pickedDate != null && mounted) {
                final pickedTime = await showTimePicker(
                  context: context,
                  initialTime: const TimeOfDay(hour: 8, minute: 0),
                );
                setState(() {
                  _selectedDate = pickedDate;
                  if (pickedTime != null) {
                    _selectedPukul =
                        '${pickedTime.hour.toString().padLeft(2, '0')}:${pickedTime.minute.toString().padLeft(2, '0')}';
                  }
                });
                _confirmWaktu(false);
              }
            },
            icon: const Icon(Icons.edit_calendar_rounded, size: 16, color: Colors.white70),
            label: const Text('Pilih Tanggal & Jam Lain', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
    );
  }

  // Step 4: Lokasi
  Widget _buildLokasiStep() {
    final recommendations = [
      'Rumah KPM PKH',
      'Balai Desa',
      'Kantor Kecamatan',
      'Balai RW / RT',
      'Kantor Dinas Sosial',
      'Sekolah / Puskesmas',
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _lokasiController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Sebutkan atau ketik lokasi kegiatan...',
              hintStyle: const TextStyle(color: Colors.white38),
              filled: true,
              fillColor: const Color(0xFF111827).withOpacity(0.8),
              prefixIcon: const Icon(Icons.place_rounded, color: Color(0xFF38BDF8)),
              suffixIcon: IconButton(
                icon: const Icon(Icons.send_rounded, color: Color(0xFF38BDF8)),
                onPressed: () {
                  if (_lokasiController.text.trim().isNotEmpty) {
                    _selectLokasi(_lokasiController.text.trim());
                  }
                },
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: const Color(0xFF38BDF8).withOpacity(0.4)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: Color(0xFF38BDF8)),
              ),
            ),
            onSubmitted: (val) {
              if (val.trim().isNotEmpty) _selectLokasi(val.trim());
            },
          ),
          const SizedBox(height: 16),
          const Text(
            'Rekomendasi Cepat:',
            style: TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: recommendations.map((rec) {
              return ActionChip(
                backgroundColor: const Color(0xFF111827),
                side: BorderSide(color: const Color(0xFF38BDF8).withOpacity(0.3)),
                label: Text(rec, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                onPressed: () => _selectLokasi(rec),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // Step 5: Poin Kegiatan
  Widget _buildPoinStep() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Poin-poin Kegiatan:',
                style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              OutlinedButton.icon(
                onPressed: _showRiwayatPoinBottomSheet,
                icon: const Icon(Icons.history_rounded, color: Color(0xFF38BDF8), size: 16),
                label: const Text('Riwayat Poin', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF38BDF8)),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: TextField(
              controller: _poinController,
              style: const TextStyle(color: Colors.white, fontSize: 13.5),
              maxLines: null,
              expands: true,
              textAlignVertical: TextAlignVertical.top,
              decoration: InputDecoration(
                hintText: 'Sebutkan poin kegiatan via suara, atau ketik di sini...\nContoh:\n• Pertemuan rutin bulanan KPM\n• Penjelasan materi modul',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF111827).withOpacity(0.8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: const Color(0xFF38BDF8).withOpacity(0.4)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
                ),
              ),
              onChanged: (val) => _poinKegiatan = val,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _proceedFromPoin,
              icon: const Icon(Icons.arrow_forward_rounded, color: Colors.black87),
              label: Text(
                _isRhk2 ? 'Lanjut ke Modul P2K2' : 'Buat Narasi & PDF Langsung',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF38BDF8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Step 6 (Khusus RHK-2): Pilih Modul P2K2
  Widget _buildModulP2K2Step() {
    final moduls = getUniqueModulP2K2();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24, vertical: 4),
          child: Text(
            'Pilih Modul Pertemuan P2K2:',
            style: TextStyle(color: Color(0xFF38BDF8), fontSize: 13, fontWeight: FontWeight.bold),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
            itemCount: moduls.length,
            itemBuilder: (context, index) {
              final modul = moduls[index];
              final isSelected = _selectedModulP2K2 == modul;

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _selectModulP2K2(modul),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF1E293B)
                            : const Color(0xFF111827).withOpacity(0.75),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF38BDF8)
                              : Colors.white.withOpacity(0.08),
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.school_outlined,
                            color: isSelected ? const Color(0xFF38BDF8) : Colors.white60,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              modul,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 12.5,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // Step 7 (Khusus RHK-2): Pilih Sesi P2K2 & Konfirmasi Jumlah KPM
  Widget _buildSesiP2K2Step() {
    final sessions = _selectedModulP2K2 != null ? getSesiByModul(_selectedModulP2K2!) : <String>[];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Modul: ${_selectedModulP2K2 ?? ""}',
            style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Pilih Sesi yang Disampaikan:',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: ListView.builder(
              itemCount: sessions.length,
              itemBuilder: (context, index) {
                final sesi = sessions[index];
                final isSelected = _selectedSesiP2K2 == sesi;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: () => _selectSesiP2K2(sesi),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF1E293B)
                            : const Color(0xFF111827).withOpacity(0.75),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF38BDF8) : Colors.white.withOpacity(0.08),
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Text(
                        sesi,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12.5,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // Detail KPM Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Jumlah KPM Hadir:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                Text('$_jumlahHadir KPM', style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 13)),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Tombol Eksekusi Langsung ke PDF Resmi
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _executeFullDirectNarrativeAndPdf,
              icon: const Icon(Icons.picture_as_pdf_rounded, color: Colors.black87),
              label: const Text(
                'PROSES & BUAT PDF RESMI SEKARANG',
                style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF38BDF8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }

  // Progress Eksekusi Langsung ke PDF
  Widget _buildProgressStep() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF38BDF8).withOpacity(0.3),
                blurRadius: 24,
                spreadRadius: 4,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 50,
                height: 50,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: Color(0xFF38BDF8),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Memproses Laporan Resmi...',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _narrativeController.text.isNotEmpty
                    ? 'Menyimpan narasi & mengompilasi PDF resmi...'
                    : 'Merangkai narasi dinas resmi...',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 12.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Bottom Bar Bersih: Gelombang Suara Fluida di Tengah & Tombol Tutup (Sesuai Permintaan: Tanpa Foto, Gallery, Mic)
  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 10, 24, 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Kapsul Gelombang Suara Animasi di Tengah (Tekan untuk Jeda / Aktifkan Mendengar)
          GestureDetector(
            onTap: _toggleListeningMode,
            child: AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final glowIntensity = _isListening
                    ? 0.7 + (_pulseController.value * 0.3)
                    : (_isSpeaking ? 0.5 + (_pulseController.value * 0.2) : 0.2);

                final isVoiceActive = _isListening || _isSpeaking;

                return Container(
                  width: 170,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: isVoiceActive
                          ? (_isListening ? const Color(0xFF10B981) : const Color(0xFF38BDF8))
                          : Colors.grey.withOpacity(0.4),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isVoiceActive
                            ? (_isListening ? const Color(0xFF10B981) : const Color(0xFF38BDF8))
                                .withOpacity(glowIntensity)
                            : Colors.transparent,
                        blurRadius: 18,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Center(
                    child: isVoiceActive
                        ? CustomPaint(
                            size: const Size(130, 32),
                            painter: _TechFluidWavePainter(
                              waveProgress: _waveController.value,
                              isSpeaking: _isSpeaking,
                              isListening: _isListening,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.mic_off_rounded, color: Colors.white60, size: 18),
                              SizedBox(width: 8),
                              Text(
                                'Suara Dijeda',
                                style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(width: 14),

          // Tombol Tutup / Keluar
          IconButton(
            onPressed: _confirmCancel,
            icon: const Icon(Icons.close_rounded, color: Colors.white60, size: 26),
            tooltip: 'Tutup Asisten',
          ),
        ],
      ),
    );
  }
}

/// Custom Painter Gelombang Fluida Bernuansa Teknologi
class _TechFluidWavePainter extends CustomPainter {
  final double waveProgress;
  final bool isSpeaking;
  final bool isListening;

  _TechFluidWavePainter({
    required this.waveProgress,
    required this.isSpeaking,
    required this.isListening,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final midY = size.height / 2;
    final width = size.width;

    final primaryPaint = Paint()
      ..color = isListening
          ? const Color(0xFF10B981)
          : (isSpeaking ? const Color(0xFF38BDF8) : const Color(0xFF00F0FF))
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final secondaryPaint = Paint()
      ..color = isListening
          ? const Color(0xFF34D399)
          : const Color(0xFF818CF8)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final primaryPath = Path();
    final secondaryPath = Path();

    final amplitude1 = isSpeaking ? 10.0 : (isListening ? 12.0 : 4.0);
    final amplitude2 = isSpeaking ? 7.0 : (isListening ? 8.0 : 2.5);

    primaryPath.moveTo(0, midY);
    secondaryPath.moveTo(0, midY);

    for (double x = 0; x <= width; x += 2.0) {
      final normX = x / width;
      final window = math.sin(normX * math.pi); // Kurva jendela agar kedua ujung mengecil halus

      final y1 = midY + math.sin((normX * 3.5 * math.pi) + (waveProgress * 2 * math.pi)) * amplitude1 * window;
      final y2 = midY + math.cos((normX * 2.8 * math.pi) - (waveProgress * 2 * math.pi)) * amplitude2 * window;

      primaryPath.lineTo(x, y1);
      secondaryPath.lineTo(x, y2);
    }

    canvas.drawPath(secondaryPath, secondaryPaint);
    canvas.drawPath(primaryPath, primaryPaint);
  }

  @override
  bool shouldRepaint(covariant _TechFluidWavePainter oldDelegate) {
    return oldDelegate.waveProgress != waveProgress ||
        oldDelegate.isSpeaking != isSpeaking ||
        oldDelegate.isListening != isListening;
  }
}
