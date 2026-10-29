import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import '../models/p2k2_data.dart';
import '../utils/string_utils.dart';

class AiService {
  /// Membuat HTTP Client yang tahan terhadap clock skew / ketidaksesuaian jam perangkat.
  /// Kasus CERTIFICATE_VERIFY_FAILED: certificate is not yet valid(handshake.cc:298)
  /// terjadi jika jam/tanggal HP pengguna diatur mundur (atau baterai habis dan reset),
  /// sehingga sertifikat SSL Cloudflare/OpenRouter yang sah dianggap "belum aktif/berlaku".
  http.Client _createHttpClient() {
    try {
      final ioHttpClient = HttpClient()
        ..badCertificateCallback = (X509Certificate cert, String host, int port) {
          final h = host.toLowerCase();
          if (h == 'openrouter.ai' ||
              h.endsWith('.openrouter.ai') ||
              h == 'api.groq.com' ||
              h.endsWith('.groq.com')) {
            return true;
          }
          return false;
        };
      return IOClient(ioHttpClient);
    } catch (_) {
      return http.Client();
    }
  }

  Future<String> generateNarrative({
    required String provider,
    required String apiKey,
    required String model,
    required String prompt,
    List<String>? imageBase64List,
  }) async {
    if (provider == 'groq') {
      return await _callGroq(apiKey, model, prompt, imageBase64List);
    } else if (provider == 'openrouter') {
      return await _callOpenRouter(apiKey, model, prompt, imageBase64List);
    } else {
      throw Exception('Provider $provider tidak didukung');
    }
  }

  Future<String> _callGroq(String apiKey, String model, String prompt, List<String>? images) async {
    final url = Uri.parse('https://api.groq.com/openai/v1/chat/completions');
    
    dynamic content;
    if (images != null && images.isNotEmpty) {
      final listContent = <Map<String, dynamic>>[
        {'type': 'text', 'text': prompt}
      ];
      for (var img in images) {
        listContent.add({
          'type': 'image_url',
          'image_url': {'url': 'data:image/jpeg;base64,$img'}
        });
      }
      content = listContent;
    } else {
      content = prompt;
    }

    final body = {
      'model': model,
      'messages': [
        {'role': 'user', 'content': content}
      ],
      'temperature': 0.7,
      'max_tokens': 2000,
    };

    final client = _createHttpClient();
    try {
      final response = await client.post(
        url,
        headers: {
          'Authorization': 'Bearer $apiKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['choices'][0]['message']['content'];
      } else {
        throw Exception('Groq API Error: ${response.statusCode} - ${response.body}');
      }
    } finally {
      client.close();
    }
  }

  Future<String> _callOpenRouter(String apiKey, String model, String prompt, List<String>? images) async {
    final url = Uri.parse('https://openrouter.ai/api/v1/chat/completions');
    
    dynamic content;
    if (images != null && images.isNotEmpty) {
      final listContent = <Map<String, dynamic>>[
        {'type': 'text', 'text': prompt}
      ];
      for (var img in images) {
        listContent.add({
          'type': 'image_url',
          'image_url': {'url': 'data:image/jpeg;base64,$img'}
        });
      }
      content = listContent;
    } else {
      content = prompt;
    }

    final body = {
      'model': model,
      'messages': [
        {'role': 'user', 'content': content}
      ],
      'max_tokens': 8192,
      // Disable thinking/reasoning tokens for faster & cheaper response
      'reasoning': {'effort': 'none'},
    };

    const int maxAttempts = 3;
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      http.Client? client;
      try {
        client = _createHttpClient();
        final response = await client.post(
          url,
          headers: {
            'Authorization': 'Bearer $apiKey',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aspend-mobile.app',
            'X-Title': 'Aspend Mobile',
            'Connection': 'keep-alive',
            'Accept': 'application/json',
          },
          body: jsonEncode(body),
        ).timeout(const Duration(seconds: 45));

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          final choices = data['choices'] as List?;
          if (choices != null && choices.isNotEmpty) {
            final resContent = choices[0]['message']?['content'];
            if (resContent != null && (resContent as String).trim().isNotEmpty) {
              return resContent;
            }
          }
          throw Exception('Respon narasi kosong dari AI');
        } else {
          final errorBody = response.body;
          throw Exception('OpenRouter API Error: ${response.statusCode} - $errorBody');
        }
      } catch (e) {
        if (attempt == maxAttempts) {
          rethrow;
        }
        await Future.delayed(Duration(milliseconds: 1000 * attempt));
      } finally {
        client?.close();
      }
    }
    throw Exception('Gagal menghubungi AI setelah beberapa percobaan');
  }

  Stream<String> generateNarrativeStream({
    required String provider,
    required String apiKey,
    required String model,
    required String prompt,
    List<String>? imageBase64List,
  }) async* {
    if (provider == 'groq') {
      yield* _callGroqStream(apiKey, model, prompt, imageBase64List);
    } else if (provider == 'openrouter') {
      yield* _callOpenRouterStream(apiKey, model, prompt, imageBase64List);
    } else {
      throw Exception('Provider $provider tidak didukung');
    }
  }

  Stream<String> _callGroqStream(String apiKey, String model, String prompt, List<String>? images) async* {
    final url = Uri.parse('https://api.groq.com/openai/v1/chat/completions');
    
    dynamic content;
    if (images != null && images.isNotEmpty) {
      final listContent = <Map<String, dynamic>>[
        {'type': 'text', 'text': prompt}
      ];
      for (var img in images) {
        listContent.add({
          'type': 'image_url',
          'image_url': {'url': 'data:image/jpeg;base64,$img'}
        });
      }
      content = listContent;
    } else {
      content = prompt;
    }

    final body = {
      'model': model,
      'messages': [
        {'role': 'user', 'content': content}
      ],
      'temperature': 0.7,
      'max_tokens': 2000,
      'stream': true,
    };

    final request = http.Request('POST', url)
      ..headers.addAll({
        'Authorization': 'Bearer $apiKey',
        'Content-Type': 'application/json',
      })
      ..body = jsonEncode(body);

    final client = _createHttpClient();
    try {
      final response = await client.send(request);
      if (response.statusCode != 200) {
        final errorBody = await response.stream.bytesToString();
        throw Exception('Groq API Error: ${response.statusCode} - $errorBody');
      }

      final stream = response.stream.transform(utf8.decoder).transform(const LineSplitter());
      await for (var line in stream) {
        if (line.startsWith('data: ') && line != 'data: [DONE]') {
          final dataStr = line.substring(6);
          if (dataStr.isEmpty) continue;
          try {
            final data = jsonDecode(dataStr);
            final content = data['choices'][0]['delta']['content'];
            if (content != null) {
              yield content;
            }
          } catch (_) {}
        }
      }
    } finally {
      client.close();
    }
  }

  Stream<String> _callOpenRouterStream(String apiKey, String model, String prompt, List<String>? images) async* {
    final url = Uri.parse('https://openrouter.ai/api/v1/chat/completions');
    
    dynamic content;
    if (images != null && images.isNotEmpty) {
      final listContent = <Map<String, dynamic>>[
        {'type': 'text', 'text': prompt}
      ];
      for (var img in images) {
        listContent.add({
          'type': 'image_url',
          'image_url': {'url': 'data:image/jpeg;base64,$img'}
        });
      }
      content = listContent;
    } else {
      content = prompt;
    }

    final body = {
      'model': model,
      'messages': [
        {'role': 'user', 'content': content}
      ],
      'max_tokens': 8192,
      'stream': true,
      // Disable thinking/reasoning tokens for faster & cheaper response
      'reasoning': {'effort': 'none'},
    };

    const int maxAttempts = 3;
    bool hasYielded = false;

    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      http.Client? client;
      try {
        final request = http.Request('POST', url)
          ..headers.addAll({
            'Authorization': 'Bearer $apiKey',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aspend-mobile.app',
            'X-Title': 'Aspend Mobile',
            'Connection': 'keep-alive',
            'Accept': 'text/event-stream',
          })
          ..body = jsonEncode(body);

        client = _createHttpClient();
        final response = await client.send(request).timeout(const Duration(seconds: 40));
        if (response.statusCode != 200) {
          final errorBody = await response.stream.bytesToString();
          throw Exception('OpenRouter API Error: ${response.statusCode} - $errorBody');
        }

        final stream = response.stream.transform(utf8.decoder).transform(const LineSplitter());
        await for (var line in stream) {
          if (line.startsWith('data: ') && line != 'data: [DONE]') {
            final dataStr = line.substring(6).trim();
            if (dataStr.isEmpty) continue;
            try {
              final data = jsonDecode(dataStr);
              final contentChunk = data['choices']?[0]?['delta']?['content'];
              if (contentChunk != null && (contentChunk as String).isNotEmpty) {
                hasYielded = true;
                yield contentChunk;
              }
            } catch (_) {}
          }
        }
        return; // Success
      } catch (e) {
        client?.close();
        if (hasYielded || attempt == maxAttempts) {
          rethrow;
        }
        await Future.delayed(Duration(milliseconds: 1000 * attempt));
      } finally {
        client?.close();
      }
    }
  }

  String buildReportPrompt({
    required String jenisRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    String? lokasi,
    String? kecamatan,
    String? kabupatenKota,
    String? provinsi,
    String? namaPetugas,
    String? jabatanPetugas,
    required bool isLlama,
  }) {
    String formattedTanggal = tanggal;
    String tanggalLengkap = tanggal;
    try {
      final date = DateTime.parse(tanggal);
      final listBulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      final listHari = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      formattedTanggal = '${listHari[date.weekday]}, ${date.day} ${listBulan[date.month]} ${date.year}';
      tanggalLengkap = '${date.day.toString().padLeft(2, '0')} ${listBulan[date.month]} ${date.year}';
    } catch (_) {}

    final lokasiText = (lokasi != null && lokasi.trim().isNotEmpty) ? '- Lokasi Kegiatan: ${lokasi.trim()}' : '';
    final wilayahKec = formatTitleCase((kecamatan != null && kecamatan.trim().isNotEmpty) ? kecamatan.trim() : '');
    final wilayahKab = formatTitleCase((kabupatenKota != null && kabupatenKota.trim().isNotEmpty) ? kabupatenKota.trim() : '');
    final wilayahProv = formatTitleCase((provinsi != null && provinsi.trim().isNotEmpty) ? provinsi.trim() : '');
    final nama = (namaPetugas != null && namaPetugas.trim().isNotEmpty) ? namaPetugas.trim() : '';
    final jabatan = (jabatanPetugas != null && jabatanPetugas.trim().isNotEmpty) ? jabatanPetugas.trim() : 'Pendamping Sosial';

    final wilayahStr = [
      if (wilayahKec.isNotEmpty) 'Kecamatan $wilayahKec',
      if (wilayahKab.isNotEmpty) 'Kabupaten/Kota $wilayahKab',
      if (wilayahProv.isNotEmpty) 'Provinsi $wilayahProv',
    ].join(' ');

    return '''Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi untuk pegawai Kementerian Sosial RI.
Tugas Anda adalah membuat narasi laporan yang lengkap, terstruktur, mendalam, dan profesional dalam bahasa Indonesia yang baku.

Berdasarkan data berikut:
- Jenis RHK: $jenisRHK
- Rencana Aksi: $rencanaAksi
- Tanggal: $formattedTanggal ($tanggalLengkap)
- Pukul: $pukul WIB
${lokasiText.isNotEmpty ? '$lokasiText\n' : ''}${wilayahStr.isNotEmpty ? '- Wilayah Penugasan: $wilayahStr\n' : ''}${nama.isNotEmpty ? '- Petugas Pelaksana: $nama ($jabatan)\n' : ''}- Poin Kegiatan:
$poinKegiatan

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, salam, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai baris pertama dengan "A. PENDAHULUAN".
2. Format HARUS persis mengikuti struktur di bawah (A, B, C, D, E).
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk daftar/bullet points. Selalu gunakan penomoran huruf (a., b., c.) atau tanda hubung biasa (-).
4. JANGAN gunakan tanda strip panjang (en-dash atau em-dash) atau simbol aneh. Selalu gunakan tanda hubung biasa (-) standar ASCII untuk rentang waktu (contoh: 08.00 - 10.00 WIB).
5. JANGAN menuliskan komentar, penjelasan, atau proses berpikir Anda. HANYA tuliskan teks laporan final.

A. PENDAHULUAN
1. Gambaran Umum:
(Tuliskan latar belakang resmi yang komprehensif dalam 2 PARAGRAF LENGKAP yang berbobot:
Paragraf 1: Menguraikan konteks kebijakan perlindungan sosial dan pengentasan kemiskinan Kementerian Sosial RI, pentingnya pelayanan dan pembinaan berkelanjutan bagi keluarga penerima manfaat, serta peran aktif pendamping sosial dalam memfasilitasi program ${wilayahStr.isNotEmpty ? 'di wilayah $wilayahStr' : ''} secara berkala.
Paragraf 2: Menguraikan pertanggungjawaban pelaksanaan tugas kedinasan pada tanggal $formattedTanggal dalam melaksanakan rencana aksi "$rencanaAksi", sasaran penerima manfaat dampingan, serta metode kerja pendampingan yang diterapkan di lapangan).

2. Maksud dan Tujuan:
Maksud dan tujuan dari pelaksanaan kegiatan ini meliputi:
a. Mendukung pencapaian target rencana hasil kerja (RHK) dan efektivitas pelaksanaan program perlindungan sosial di lapangan.
b. Memberikan bimbingan, verifikasi, atau pelayanan pendampingan secara langsung dan terukur kepada keluarga sasaran.
c. Mengidentifikasi kendala atau kebutuhan sosial penerima manfaat serta merumuskan langkah tindak lanjut penyelesaiannya secara tepat.
d. Memastikan seluruh proses pendampingan berjalan sesuai standar operasional prosedur Kementerian Sosial RI menuju kemandirian keluarga.

3. Ruang Lingkup:
Ruang lingkup kegiatan ini meliputi sasaran penerima manfaat dampingan, materi/fokus penanganan terkait "$rencanaAksi", wilayah penugasan ${wilayahStr.isNotEmpty ? 'di $wilayahStr' : ''}, koordinasi dengan pihak-pihak terkait, serta langkah-langkah kerja teknis pendampingan yang dilaksanakan.

4. Dasar:
Pelaksanaan kegiatan ini didasarkan pada:
a. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial.
b. Peraturan Menteri Sosial Republik Indonesia Nomor 8 Tahun 2026 tentang Program Keluarga Harapan.
c. Keputusan Direktur Jenderal Perlindungan dan Jaminan Sosial Nomor 20/3/HK.01/3/2025.

B. KEGIATAN YANG DILAKSANAKAN
(Tuliskan CUKUP TEPAT 2 PARAGRAF yang padat dan komprehensif merangkum jalannya seluruh rangkaian kegiatan yang dilaksanakan secara teratur, interaksi di lapangan, dan peran petugas).

C. HASIL
(Wajib ditulis CUKUP TEPAT 2 PARAGRAF SAJA, dilarang kurang atau lebih dari 2 paragraf. Isinya penting, berbobot, dan mendalam:
- Paragraf 1: Menguraikan capaian output konkret pelaksanaan kegiatan, tingkat partisipasi penerima manfaat, dan data/fakta temuan penting di lapangan.
- Paragraf 2: Menguraikan komitmen konkret atau solusi yang berhasil disepakati bersama, tindak lanjut yang direncanakan, serta dampak nyata bagi kemandirian keluarga penerima manfaat).

D. KESIMPULAN DAN SARAN
(Tuliskan 1 paragraf ringkas berisi kesimpulan utama pelaksanaan tugas dan saran/rekomendasi tindak lanjut).

E. PENUTUP
Demikian laporan pelaksanaan kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.

Tambahan: Jika dalam data atau poin kegiatan terdapat lokasi atau tempat kegiatan, cantumkan di baris paling akhir laporan dengan format XML: <lokasi>Nama Lokasi</lokasi>. Jika tidak ada, tulis <lokasi>Tidak disebutkan</lokasi>.
''';
  }

  String buildP2K2ReportPrompt({
    required String jenisRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required P2K2Data p2k2Data,
    String? kecamatan,
    String? kabupatenKota,
    String? provinsi,
    String? namaPetugas,
    String? jabatanPetugas,
    required bool isLlama,
  }) {
    String formattedTanggal = tanggal;
    String tanggalLengkap = tanggal;
    try {
      final date = DateTime.parse(tanggal);
      final listBulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      final listHari = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      formattedTanggal = '${listHari[date.weekday]}, ${date.day} ${listBulan[date.month]} ${date.year}';
      tanggalLengkap = '${date.day.toString().padLeft(2, '0')} ${listBulan[date.month]} ${date.year}';
    } catch (_) {}

    final wilayahKec = formatTitleCase((kecamatan != null && kecamatan.trim().isNotEmpty) ? kecamatan.trim() : '');
    final wilayahKab = formatTitleCase((kabupatenKota != null && kabupatenKota.trim().isNotEmpty) ? kabupatenKota.trim() : '');
    final wilayahProv = formatTitleCase((provinsi != null && provinsi.trim().isNotEmpty) ? provinsi.trim() : '');
    final nama = (namaPetugas != null && namaPetugas.trim().isNotEmpty) ? namaPetugas.trim() : '';
    final jabatan = (jabatanPetugas != null && jabatanPetugas.trim().isNotEmpty) ? jabatanPetugas.trim() : 'Pendamping PKH';

    final pemateri = (p2k2Data.isPemateriDiriSendiri || p2k2Data.namaPemateri.trim().isEmpty)
        ? (nama.isNotEmpty ? nama : 'Pendamping Sosial PKH')
        : p2k2Data.namaPemateri.trim();
    final jabatanPem = (p2k2Data.isPemateriDiriSendiri || p2k2Data.jabatanPemateri.trim().isEmpty)
        ? (jabatan.isNotEmpty ? jabatan : 'Pendamping PKH')
        : p2k2Data.jabatanPemateri.trim();

    final jamSelesaiStr = p2k2Data.jamSelesai.trim().isNotEmpty ? p2k2Data.jamSelesai.trim() : 'selesai';
    final tempatStr = p2k2Data.tempatPelaksanaan.trim().isNotEmpty ? p2k2Data.tempatPelaksanaan.trim() : 'Lokasi Kelompok';
    final kelompokStr = p2k2Data.namaKelompok.trim().isNotEmpty ? p2k2Data.namaKelompok.trim() : 'Kelompok KPM';
    final ketuaStr = p2k2Data.ketuaKelompok.trim().isNotEmpty ? p2k2Data.ketuaKelompok.trim() : '';

    final bool isSupervisi = p2k2Data.isSupervisi || rencanaAksi == 'Melakukan Supervisi pelaksanaan P2K2 kepada ASN PPPK';

    if (isSupervisi) {
      return _buildP2K2SupervisiReportPrompt(
        jenisRHK: jenisRHK,
        rencanaAksi: rencanaAksi,
        tanggal: tanggal,
        pukul: pukul,
        poinKegiatan: poinKegiatan,
        p2k2Data: p2k2Data,
        kecamatan: kecamatan,
        kabupatenKota: kabupatenKota,
        provinsi: provinsi,
        namaPetugas: namaPetugas,
        jabatanPetugas: jabatanPetugas,
        isLlama: isLlama,
      );
    }

    return '''Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi kegiatan Pertemuan Peningkatan Kemampuan Keluarga (P2K2) / Family Development Session (FDS) untuk pegawai Kementerian Sosial RI.
Tugas Anda adalah membuat narasi laporan yang lengkap, terstruktur, mendalam, dan profesional dalam bahasa Indonesia yang baku sesuai pedoman resmi Kementerian Sosial RI.

Data Pelaksanaan P2K2:
- Jenis RHK: $jenisRHK
- Rencana Aksi: $rencanaAksi
- Modul: ${p2k2Data.modul}
- Sesi / Materi: ${p2k2Data.sesi}
- Tanggal Pelaksanaan: $formattedTanggal ($tanggalLengkap)
- Waktu: Pukul $pukul - $jamSelesaiStr WIB (gunakan tanda hubung '-')
- Tempat / Lokasi: $tempatStr
- Wilayah Tugas: Kecamatan $wilayahKec, Kabupaten/Kota $wilayahKab, Provinsi $wilayahProv
- Kelompok: $kelompokStr
${ketuaStr.isNotEmpty ? "- Ketua Kelompok: Ibu $ketuaStr\n" : ""}- Kehadiran: ${p2k2Data.jumlahHadir} hadir, ${p2k2Data.jumlahSakit} sakit, ${p2k2Data.jumlahAlpa} alpa dari total ${p2k2Data.jumlahKPM} KPM peserta dampingan
- Fasilitator / Pemateri: $pemateri ($jabatanPem)
- Poin Kegiatan Tambahan:
$poinKegiatan

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, salam, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai baris pertama dengan "A. PENDAHULUAN".
2. Format laporan HARUS persis mengikuti struktur resmi berikut (A, B, C, D, E).
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk daftar. Gunakan huruf abjad (a., b., c.) atau tanda hubung biasa (-).
4. JANGAN gunakan tanda strip panjang (en-dash atau em-dash) atau simbol aneh. Selalu gunakan tanda hubung biasa (-) standar ASCII untuk rentang waktu (contoh: 08.00 - 10.00 WIB).
5. JANGAN menuliskan komentar, penjelasan, atau proses berpikir Anda. HANYA tuliskan teks laporan final.

STRUKTUR RESMI NARASI LAPORAN:

A. PENDAHULUAN
1. Gambaran Umum:
Pertemuan Peningkatan Kemampuan Keluarga (P2K2) merupakan proses belajar terstruktur untuk mempercepat perubahan perilaku Keluarga Penerima Manfaat (KPM) PKH dalam bidang Kesehatan, Pendidikan, Ekonomi, Perlindungan Anak, dan Kesejahteraan Sosial dan merupakan salah satu kegiatan utama dalam Program Keluarga Harapan (PKH) yang bertujuan menyediakan wadah belajar bagi KPM PKH, menambah wawasan dan mengubah perilaku, melaksanakan edukasi secara berkala kepada KPM PKH, dan memberikan dukungan kepada KPM untuk menuju kemandirian khususnya di Kecamatan $wilayahKec Kabupaten/Kota $wilayahKab Provinsi $wilayahProv yang dilakukan secara rutin sesuai jadwal yang telah ditetapkan.

Laporan ini disusun sebagai bentuk pertanggungjawaban dan dokumentasi kegiatan P2K2 yang telah dilaksanakan pada $tanggalLengkap. Pelaksanaan P2K2 melibatkan pendamping sosial PKH sebagai fasilitator dan KPM kelompok $kelompokStr di Kecamatan $wilayahKec Kabupaten/Kota $wilayahKab Provinsi $wilayahProv sebagai peserta pertemuan. Kegiatan berlangsung dengan metode diskusi kelompok, penyampaian materi ${p2k2Data.modul}, tanya jawab, dan simulasi dengan tema modul ${p2k2Data.modul} sesi ${p2k2Data.sesi} yang ditetapkan oleh Kementerian Sosial, maupun materi tambahan mengenai wawasan terkait isu-isu yang relevan di masyarakat sesuai dengan kondisi terkini atau sesuai kebutuhan.

2. Maksud dan Tujuan:
Maksud dan tujuan pelaksanaan kegiatan P2K2 ini meliputi:
a. Memberikan pemahaman dan edukasi mendalam kepada KPM dampingan mengenai materi ${p2k2Data.modul} sesi ${p2k2Data.sesi} untuk dipraktikkan dalam kehidupan keluarga sehari-hari.
b. Mendorong perubahan pola pikir dan perilaku positif KPM dalam peningkatan kualitas kesehatan, pendidikan anak, serta tata kelola ekonomi keluarga.
c. Memperkuat komitmen KPM dalam memenuhi kewajiban kepesertaan Program Keluarga Harapan menuju kemandirian dan graduasi sejahtera.
d. Menyediakan ruang interaktif bagi KPM untuk mendiskusikan kendala atau isu-isu yang dihadapi dalam pemenuhan komitmen program dan mencari pemecahan masalah bersama.

3. Ruang Lingkup:
Ruang lingkup kegiatan P2K2 yang dilaksanakan meliputi sasaran KPM dampingan kelompok $kelompokStr${ketuaStr.isNotEmpty ? " (Ketua: Ibu $ketuaStr)" : ""} di $tempatStr, dengan cakupan kegiatan:
a. Persiapan materi ${p2k2Data.modul} dan jadwal pertemuan.
b. Koordinasi dengan KPM mengenai lokasi dan waktu pelaksanaan.
c. Pelaksanaan pertemuan sesuai modul ${p2k2Data.modul} sesi ${p2k2Data.sesi}.
d. Fasilitasi diskusi, penyampaian materi ${p2k2Data.modul}, dan praktik sederhana.
e. Dokumentasi pertemuan dan pengisian daftar hadir peserta.
f. Rekapitulasi hadir peserta dan evaluasi komitmen KPM.

4. Dasar:
Pelaksanaan kegiatan ini didasarkan pada:
a. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial.
b. Peraturan Menteri Sosial Republik Indonesia Nomor 8 Tahun 2026 tentang Program Keluarga Harapan.
c. Keputusan Direktur Jenderal Perlindungan dan Jaminan Sosial Nomor 20/3/HK.01/3/2025.

B. KEGIATAN YANG DILAKSANAKAN
(Tuliskan CUKUP TEPAT 2 PARAGRAF yang padat dan komprehensif. Paragraf pertama menguraikan pembukaan, perkenalan tujuan, dinamika pemaparan materi ${p2k2Data.modul} sesi ${p2k2Data.sesi} oleh pemateri $pemateri, serta keaktifan KPM dalam diskusi kelompok. Paragraf kedua menguraikan sesi tanya jawab, simulasi praktik materi, penegasan komitmen peserta, dan penutupan acara).

C. HASIL
(Wajib ditulis CUKUP TEPAT 2 PARAGRAF SAJA, dilarang kurang atau lebih dari 2 paragraf. Isinya penting, berbobot, dan mendalam:
- Paragraf 1: Menguraikan output nyata capaian kegiatan, tingkat kehadiran (${p2k2Data.jumlahHadir} hadir dari total ${p2k2Data.jumlahKPM} KPM) dan antusiasme aktif peserta, serta sejauh mana pemahaman peserta terhadap materi ${p2k2Data.modul} sesi ${p2k2Data.sesi} yang telah dibahas.
- Paragraf 2: Menguraikan komitmen perubahan perilaku positif anggota KPM di rumah tangga masing-masing setelah mempelajari modul tersebut, solusi konkret yang disepakati atas kendala keluarga dampingan di lapangan, serta dampak langsung kegiatan ini terhadap upaya kemandirian keluarga penerima manfaat).

D. KESIMPULAN DAN SARAN
(Tuliskan 1 paragraf ringkas berisi kesimpulan utama pelaksanaan pertemuan P2K2 dan rekomendasi/tindak lanjut untuk pendampingan pertemuan sesi berikutnya).

E. PENUTUP
Demikian laporan pelaksanaan kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.

Tambahan: Cantumkan di baris paling akhir laporan dengan format XML: <lokasi>$tempatStr</lokasi>.
''';
  }

  String _buildP2K2SupervisiReportPrompt({
    required String jenisRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required P2K2Data p2k2Data,
    String? kecamatan,
    String? kabupatenKota,
    String? provinsi,
    String? namaPetugas,
    String? jabatanPetugas,
    required bool isLlama,
  }) {
    String formattedTanggal = tanggal;
    String tanggalLengkap = tanggal;
    try {
      final date = DateTime.parse(tanggal);
      final listBulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      final listHari = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      formattedTanggal = '${listHari[date.weekday]}, ${date.day} ${listBulan[date.month]} ${date.year}';
      tanggalLengkap = '${date.day.toString().padLeft(2, '0')} ${listBulan[date.month]} ${date.year}';
    } catch (_) {}

    final wilayahKab = formatTitleCase(p2k2Data.kabupatenKota.trim().isNotEmpty
        ? p2k2Data.kabupatenKota.trim()
        : (kabupatenKota?.trim().isNotEmpty == true ? kabupatenKota!.trim() : ''));
    final wilayahProv = formatTitleCase(p2k2Data.provinsi.trim().isNotEmpty
        ? p2k2Data.provinsi.trim()
        : (provinsi?.trim().isNotEmpty == true ? provinsi!.trim() : ''));
    final wilayahKec = formatTitleCase(p2k2Data.kecamatan.trim().isNotEmpty
        ? p2k2Data.kecamatan.trim()
        : (kecamatan?.trim().isNotEmpty == true ? kecamatan!.trim() : ''));
    final wilayahDesa = formatTitleCase(p2k2Data.desaKelurahan.trim());

    final namaKatim = p2k2Data.namaKetuaTim.trim().isNotEmpty
        ? p2k2Data.namaKetuaTim.trim()
        : (namaPetugas?.trim().isNotEmpty == true ? namaPetugas!.trim() : 'Ketua Tim');
    final jabatanKatim = jabatanPetugas?.trim().isNotEmpty == true ? jabatanPetugas!.trim() : 'Ketua Tim';

    final namaPendamping = p2k2Data.namaPendamping.trim().isNotEmpty
        ? p2k2Data.namaPendamping.trim()
        : (p2k2Data.namaPemateri.trim().isNotEmpty ? p2k2Data.namaPemateri.trim() : 'Pendamping Sosial PKH');

    final jamSelesaiStr = p2k2Data.jamSelesai.trim().isNotEmpty ? p2k2Data.jamSelesai.trim() : 'selesai';
    final tempatStr = p2k2Data.tempatPelaksanaan.trim().isNotEmpty ? p2k2Data.tempatPelaksanaan.trim() : 'Lokasi Kegiatan';
    final kelompokStr = p2k2Data.namaKelompok.trim().isNotEmpty ? p2k2Data.namaKelompok.trim() : 'Kelompok KPM';
    final ketuaStr = p2k2Data.ketuaKelompok.trim().isNotEmpty ? p2k2Data.ketuaKelompok.trim() : '';

    return '''Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi kegiatan Supervisi Pertemuan Peningkatan Kemampuan Keluarga (P2K2) kepada ASN PPPK / Pendamping Sosial PKH oleh Ketua Tim (Katim) Kementerian Sosial RI.
Tugas Anda adalah membuat narasi laporan supervisi yang lengkap, terstruktur, mendalam, dan profesional dalam bahasa Indonesia yang baku sesuai pedoman resmi Kementerian Sosial RI.

Data Pelaksanaan Supervisi P2K2:
- Jenis RHK: $jenisRHK
- Rencana Aksi: $rencanaAksi
- Modul P2K2: ${p2k2Data.modul}
- Sesi / Materi P2K2: ${p2k2Data.sesi}
- Tanggal Supervisi: $formattedTanggal ($tanggalLengkap)
- Waktu: Pukul $pukul - $jamSelesaiStr WIB (gunakan tanda hubung '-')
- Tempat / Lokasi: $tempatStr
- Wilayah Supervisi: Desa/Kelurahan $wilayahDesa, Kecamatan $wilayahKec, Kabupaten/Kota $wilayahKab, Provinsi $wilayahProv
- Nama Ketua Tim (Penyelia/Supervisor): $namaKatim ($jabatanKatim)
- Nama Pendamping yang Disupervisi: $namaPendamping
- Kelompok Dampingan: $kelompokStr
${ketuaStr.isNotEmpty ? "- Ketua Kelompok: Ibu $ketuaStr\n" : ""}- Kehadiran KPM: ${p2k2Data.jumlahHadir} hadir, ${p2k2Data.jumlahSakit} sakit, ${p2k2Data.jumlahAlpa} alpa dari total ${p2k2Data.jumlahKPM} KPM peserta dampingan
- Poin Kegiatan Khusus:
$poinKegiatan

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, salam, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai baris pertama dengan "A. PENDAHULUAN".
2. Format laporan HARUS persis mengikuti struktur resmi baku di bawah (A, B, C, D, E).
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk daftar. Gunakan huruf abjad (a., b., c.) atau penomoran angka biasa.
4. JANGAN gunakan tanda strip panjang (en-dash atau em-dash) atau simbol aneh. Selalu gunakan tanda hubung biasa (-) standar ASCII untuk rentang waktu (contoh: 08.00 - 10.00 WIB).
5. JANGAN menuliskan komentar, penjelasan, atau proses berpikir Anda. HANYA tuliskan teks laporan final.

STRUKTUR RESMI NARASI LAPORAN SUPERVISI:

A. PENDAHULUAN
1. Umum
Pertemuan Peningkatan Kemampuan Keluarga (P2K2) merupakan proses belajar terstruktur untuk mempercepat perubahan perilaku Keluarga Penerima Manfaat (KPM) PKH dalam bidang Kesehatan, Pendidikan, Ekonomi, Perlindungan Anak, dan Kesejahteraan Sosial dan merupakan salah satu kegiatan utama dalam Program Keluarga Harapan (PKH) yang bertujuan menyediakan wadah belajar bagi KPM PKH, menambah wawasan dan mengubah perilaku, melaksanakan edukasi secara berkala kepada KPM PKH, dan memberikan dukungan kepada KPM untuk menuju kemandirian khususnya di Kabupaten/Kota $wilayahKab Provinsi $wilayahProv yang dilakukan secara rutin sesuai jadwal yang telah ditetapkan.

Kegiatan Supervisi Pertemuan Peningkatan Kemampuan Keluarga (P2K2) dalam Program Keluarga Harapan (PKH) dilaksanakan dalam rangka memastikan kualitas pelaksanaan pendampingan dan meningkatkan efektivitas perubahan perilaku Keluarga Penerima Manfaat (KPM). Supervisi ini berfungsi sebagai mekanisme kontrol kualitas (quality assurance) dan pembinaan langsung bagi Pendamping Sosial PKH.

Laporan ini disusun sebagai bentuk pertanggungjawaban dan dokumentasi kegiatan Supervisi P2K2 yang telah dilaksanakan pada $tanggalLengkap. Pelaksanaan Supervisi P2K2 dilakukan oleh Ketua Tim (Katim) selaku penyelia terhadap pendamping sosial PKH ($namaPendamping) sebagai fasilitator dan KPM di Kabupaten/Kota $wilayahKab Provinsi $wilayahProv sebagai peserta pertemuan. Kegiatan berlangsung dengan metode diskusi kelompok dan tanya jawab.

2. Maksud Dan Tujuan
a. Memberikan informasi lengkap mengenai pelaksanaan P2K2 di Kabupaten/Kota $wilayahKab Provinsi $wilayahProv.
b. Menjadi bahan evaluasi terhadap hasil capaian pelaksanaan kegiatan P2K2.
c. Meningkatkan penguatan kapasitas Pendamping dengan memberikan saran, tindak lanjut terhadap temuan, bimbingan teknis, serta evaluasi langsung terhadap keterampilan fasilitasi Pendamping Sosial PKH di lapangan.

3. Ruang Lingkup
Ruang lingkup pelaksanaan kegiatan supervisi P2K2 kepada ASN PPPK / Pendamping Sosial PKH mencakup:
a. Verifikasi kesiapan administrasi kelompok, daftar hadir KPM, dan kelengkapan media peraga/buku kerja P2K2 modul ${p2k2Data.modul}.
b. Observasi dan evaluasi kesesuaian metode fasilitasi materi sesi ${p2k2Data.sesi} dengan standar operasional prosedur (SOP).
c. Pemantauan tingkat kehadiran, partisipasi aktif, serta pemahaman KPM terhadap materi yang disampaikan.
d. Pemberian bimbingan teknis langsung dan coaching keterampilan fasilitasi kepada pendamping sosial di lokasi dampingan.
e. Perumusan catatan evaluasi, penyusunan rencana tindak lanjut pembinaan, dan dokumentasi hasil supervisi.

4. Dasar
a. Undang-Undang Nomor 11 Tahun 2009 tentang Kesejahteraan Sosial.
b. Peraturan Menteri Sosial Republik Indonesia Nomor 8 Tahun 2026 tentang Program Keluarga Harapan.
c. Keputusan Direktur Jenderal Perlindungan dan Jaminan Sosial Nomor 20/3/HK.01/3/2025.

B. KEGIATAN YANG DILAKSANAKAN
(Tuliskan CUKUP TEPAT 2 PARAGRAF yang padat dan komprehensif. Paragraf pertama menguraikan jalannya kegiatan supervisi oleh Ketua Tim terhadap penyampaian materi ${p2k2Data.modul} sesi ${p2k2Data.sesi} oleh pendamping sosial $namaPendamping kepada kelompok KPM $kelompokStr di $tempatStr. Paragraf kedua menguraikan proses observasi metode fasilitasi, interaksi tanya jawab antara KPM dan pendamping, serta arahan supervisi pembinaan yang diberikan Ketua Tim).

C. HASIL
(Wajib ditulis CUKUP TEPAT 2 PARAGRAF SAJA, dilarang kurang atau lebih dari 2 paragraf. Isinya penting, berbobot, dan mendalam:
- Paragraf 1: Menguraikan hasil penilaian supervisi terhadap keterampilan fasilitasi pendamping sosial $namaPendamping, tingkat kehadiran KPM (${p2k2Data.jumlahHadir} dari ${p2k2Data.jumlahKPM} KPM) dan keaktifan peserta, serta kesesuaian penyampaian materi modul dengan standar operasional prosedur (SOP).
- Paragraf 2: Menguraikan poin bimbingan teknis dan saran konstruktif yang diberikan kepada pendamping sosial, komitmen tindak lanjut pembinaan SDM, serta rekomendasi untuk meningkatkan efektivitas pertemuan P2K2 berikutnya).

D. KESIMPULAN DAN SARAN
(Tuliskan 1 paragraf ringkas berisi kesimpulan utama hasil supervisi dan rekomendasi pembinaan keberlanjutan bagi pendamping sosial PKH).

E. PENUTUP
Demikian laporan pelaksanaan supervisi kegiatan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.

Tambahan: Cantumkan di baris paling akhir laporan dengan format XML: <lokasi>$tempatStr</lokasi>.
''';
  }

  String buildPengaduanAnalysisPrompt({
    required String aduan,
    required String analisa,
  }) {
    return '''Anda adalah asisten cerdas Kementerian Sosial RI.
Tugas Anda adalah menyusun narasi laporan Analisis & Tindak Lanjut Pengaduan Masyarakat yang formal, rapi, dan profesional dalam bahasa Indonesia yang baku.

Berdasarkan data berikut:
- Aduan Masyarakat: "$aduan"
- Analisis Awal & Tindak Lanjut: "$analisa"

Buatlah narasi analisis dan tindak lanjut yang komprehensif, terstruktur, dan formal (menggunakan tata bahasa birokrasi pemerintahan Indonesia yang sopan dan lugas).

ATURAN STRUKTUR DAN FORMAT (SANGAT PENTING):
1. DILARANG MENYERTAKAN KOP/HEADER METADATA LAPORAN:
   - DILARANG menulis baris judul seperti "**LAPORAN ANALISIS DAN TINDAK LANJUT...**"
   - DILARANG menulis rincian header seperti "**Perihal** : ...", "**Sumber Pengaduan** : ...", "**Nomor Registrasi** : ...", "**Tanggal Laporan** : ...", atau garis pemisah ("---").
2. DILARANG MENYERTAKAN PENUTUP/TANDA TANGAN:
   - DILARANG menulis bagian penutup seperti "V. Penutup", "Jakarta, [tanggal]", "Direktur...", "ttd.", "[Nama Pejabat]", "NIP. [nomor]". Penutup dan tanda tangan resmi sudah otomatis disediakan oleh aplikasi.
3. FORMAT SUB-POIN DAN BULLET POINT:
   - Gunakan penomoran Romawi untuk bab utama:
     ### I. Uraian Pengaduan
     ### II. Analisis Awal
     ### III. Tindak Lanjut yang Telah/Akan Dilakukan
     ### IV. Rencana Aksi Lanjutan
   - Untuk poin-poin utama di bawah bab (seperti di bawah IV. Rencana Aksi Lanjutan), gunakan angka (1., 2., 3.).
   - Untuk rincian/detail di dalam poin-poin tersebut, GUNAKAN BULLET STRIP ("- "), DILARANG MENGGUNAKAN ANGKA BERTINGKAT (seperti 1., 2., 3. lagi).
     Contoh format yang BENAR:
     1. Peningkatan Sistem Monitoring Distribusi KKS
        - Mengoptimalkan aplikasi SIKS-NG untuk memberikan notifikasi real-time jika KKS tidak terkirim.
        - Mewajibkan bank penyalur melaporkan status pengiriman kartu setiap bulan.
     2. Edukasi dan Sosialisasi kepada Penerima Manfaat
        - Melalui pendamping sosial dan dinas sosial daerah, memberikan informasi...
        - Menyediakan hotline pengaduan khusus...
4. PENTING: Jangan menyertakan kata-kata "AI" atau "Analisis AI". Tulis langsung isi narasi laporan secara formal mulai dari "### I. Uraian Pengaduan".
''';
  }

  Future<Map<String, dynamic>> testConnection(String provider, String apiKey, String model) async {
    try {
      final start = DateTime.now();
      final res = await generateNarrative(
        provider: provider,
        apiKey: apiKey,
        model: model,
        prompt: 'Say "hello world" in 2 words.',
      );
      final duration = DateTime.now().difference(start).inMilliseconds;
      return {
        'success': true,
        'message': 'Connected ($duration ms): $res',
      };
    } catch (e) {
      return {
        'success': false,
        'message': e.toString(),
      };
    }
  }

  /// Mengekstrak data terstruktur (JSON) dari foto KTP atau KK menggunakan Gemini AI
  Future<Map<String, String>> extractDocumentData({
    required File imageFile,
    required String provider,
    required String apiKey,
    required String model,
    required bool isKtp,
  }) async {
    final bytes = await imageFile.readAsBytes();
    final base64Image = base64Encode(bytes);

    final String docName = isKtp ? "KTP (ID Card)" : "Kartu Keluarga (Family Card)";
    final String jsonSchema = isKtp
        ? '{"nik": "16-digit NIK number", "nama": "Full Name", "alamat": "Street Address/Lingkungan", "kelDesa": "Kelurahan or Desa", "kecamatan": "Kecamatan", "kabKota": "Kabupaten or Kota", "provinsi": "Provinsi"}'
        : '{"noKk": "16-digit KK number", "nama": "Name of Head of Family"}';

    final prompt = '''Analyze this image of an Indonesian $docName. 
Extract the data fields and return them strictly as a valid, raw JSON object matching this schema:
$jsonSchema

Rules:
1. ONLY return the raw JSON object. Do not wrap it in markdown code blocks like ```json ... ```. Do not include any introductory or concluding text.
2. If a field cannot be read or is not present, return an empty string for that field.
3. Keep the NIK/KK numbers as pure strings of numbers (without spaces or dashes).
4. Capitalize name and address values correctly.
''';

    final String responseText = await generateNarrative(
      provider: provider,
      apiKey: apiKey,
      model: model,
      prompt: prompt,
      imageBase64List: [base64Image],
    );

    try {
      String cleanJson = responseText.trim();
      final startIndex = cleanJson.indexOf('{');
      final endIndex = cleanJson.lastIndexOf('}');
      if (startIndex != -1 && endIndex != -1 && endIndex > startIndex) {
        cleanJson = cleanJson.substring(startIndex, endIndex + 1).trim();
      }
      
      final Map<String, dynamic> decoded = jsonDecode(cleanJson);
      final Map<String, String> result = {};

      String? findValue(List<String> variations) {
        for (var v in variations) {
          final val = decoded[v] ?? decoded[v.toLowerCase()] ?? decoded[v.toUpperCase()];
          if (val != null) return val.toString();
        }
        for (var entry in decoded.entries) {
          if (variations.any((v) => entry.key.toLowerCase() == v.toLowerCase())) {
            return entry.value.toString();
          }
        }
        return null;
      }

      if (isKtp) {
        result['nik'] = findValue(['nik', 'NIK']) ?? '';
        result['nama'] = findValue(['nama', 'name', 'Nama']) ?? '';
        result['alamat'] = findValue(['alamat', 'address', 'Alamat']) ?? '';
        result['kelDesa'] = findValue(['kelDesa', 'kelurahan', 'desa', 'kel_desa', 'kel/desa', 'keldesa']) ?? '';
        result['kecamatan'] = findValue(['kecamatan', 'kec', 'Kecamatan']) ?? '';
        result['kabKota'] = findValue(['kabKota', 'kabupaten', 'kota', 'kab_kota', 'kab/kota', 'kabkota']) ?? '';
        result['provinsi'] = findValue(['provinsi', 'prov', 'Provinsi']) ?? '';
      } else {
        result['noKk'] = findValue(['noKk', 'nokk', 'no_kk', 'no kk', 'KK']) ?? '';
        result['nama'] = findValue(['nama', 'name', 'Nama']) ?? '';
      }

      return result;
    } catch (e) {
      throw Exception('Gagal mengekstrak data berkas: format respons Asisten Pendamping tidak valid. Res: $responseText');
    }
  }
}

