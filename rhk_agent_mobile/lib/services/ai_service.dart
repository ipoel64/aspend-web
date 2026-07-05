import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/p2k2_data.dart';

class AiService {
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

    final response = await http.post(
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
    };

    final response = await http.post(
      url,
      headers: {
        'Authorization': 'Bearer $apiKey',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aspend-mobile.app',
        'X-Title': 'Aspend Mobile',
      },
      body: jsonEncode(body),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['choices'][0]['message']['content'];
    } else {
      throw Exception('OpenRouter API Error: ${response.statusCode} - ${response.body}');
    }
  }

  String buildReportPrompt({
    required String jenisRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required bool isLlama,
  }) {
    String formattedTanggal = tanggal;
    try {
      final date = DateTime.parse(tanggal);
      final listBulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      final listHari = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      formattedTanggal = '${listHari[date.weekday]}, ${date.day} ${listBulan[date.month]} ${date.year}';
    } catch (_) {}

    return '''Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi untuk pegawai Kementerian Sosial RI (Program Keluarga Harapan).
Buat narasi laporan yang ekstensif, mendetail, dan komprehensif dalam bahasa Indonesia yang baku, formal, dan profesional.
${isLlama ? 'Anda harus mengekspansi poin-poin yang diberikan menjadi paragraf yang panjang (minimal 3-4 paragraf per bagian B dan C). Jangan menghemat kata, jelaskan dengan sangat rinci.' : 'Buatlah narasi yang komprehensif namun padat, ringkas, dan tepat sasaran. Jabarkan poin-poin secara efektif (sekitar 1-2 paragraf per bagian) tanpa bertele-tele.'}
Berdasarkan data berikut:
- Jenis RHK: $jenisRHK
- Rencana Aksi: $rencanaAksi
- Tanggal: $formattedTanggal
- Pukul: $pukul
- Poin Kegiatan:
$poinKegiatan

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, basa-basi, atau preamble apa pun di awal laporan. Langsung mulai teks Anda dari baris pertama dengan "A. PENDAHULUAN".
2. Format HARUS mengikuti struktur di bawah tanpa tambahan teks apa pun di atasnya.
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk membuat daftar/bullet points. Selalu gunakan tanda hubung (-) atau angka (1, 2, 3) agar formatnya rapi saat dicetak.
4. JANGAN mengulang-ulang kalimat yang sama. Kembangkan konteks pekerjaan sosial.

A. PENDAHULUAN
1. Gambaran Umum: (tuliskan latar belakang singkat dan komprehensif tentang kegiatan ini)
2. Maksud dan Tujuan: (jabarkan apa yang ingin dicapai secara rinci)
3. Ruang Lingkup: (batasan kegiatan yang dilaporkan)
4. Dasar: (JANGAN gunakan referensi "Undang-Undang Nomor...". Gunakan referensi yang lebih umum seperti: Pedoman Umum PKH, Petunjuk Teknis Penyaluran Bantuan Sosial, Pedoman Pelaksanaan Program Keluarga Harapan)

B. KEGIATAN YANG DILAKSANAKAN
(Jelaskan secara sangat deskriptif, panjang, dan terperinci apa saja yang dilakukan. Kembangkan poin kegiatan menjadi minimal 3 paragraf yang mengalir. Jangan sekadar menyalin poin kegiatan, melainkan narasikan layaknya sebuah cerita laporan kegiatan resmi).

C. HASIL
(Uraikan secara mendalam apa output/hasil dari kegiatan tersebut, dampaknya, serta analisis singkat. Panjang narasi bagian ini minimal 2 paragraf).

D. KESIMPULAN DAN SARAN
(Kesimpulan komprehensif dan rekomendasi mendetail untuk tindak lanjut)

E. PENUTUP
(Kalimat penutup resmi, misal: "Demikian laporan ini dibuat untuk dipergunakan sebagaimana mestinya.")

Tambahan: Jika dalam poin kegiatan terdapat nama lokasi atau tempat, tolong ekstrak dan taruh di bagian paling bawah laporan menggunakan tag XML seperti ini: <lokasi>Nama Lokasinya Saja</lokasi>. Jika tidak ada lokasi spesifik, tulis <lokasi>Tidak disebutkan</lokasi>.
''';
  }

  String buildP2K2ReportPrompt({
    required String jenisRHK,
    required String rencanaAksi,
    required String tanggal,
    required String pukul,
    required String poinKegiatan,
    required P2K2Data p2k2Data,
    required bool isLlama,
  }) {
    final basePrompt = buildReportPrompt(
      jenisRHK: jenisRHK,
      rencanaAksi: rencanaAksi,
      tanggal: tanggal,
      pukul: pukul,
      poinKegiatan: poinKegiatan,
      isLlama: isLlama,
    );

    return '''$basePrompt

Pastikan untuk melebur dan menarasikan informasi khusus P2K2 berikut di dalam paragraf pada bagian B. KEGIATAN YANG DILAKSANAKAN:
- Modul: ${p2k2Data.modul}
- Sesi: ${p2k2Data.sesi}
- Kelompok: ${p2k2Data.namaKelompok}
- Ketua Kelompok: ${p2k2Data.ketuaKelompok}
- Kehadiran: ${p2k2Data.jumlahHadir} hadir dari total ${p2k2Data.jumlahKPM} anggota.

Jelaskan juga dalam paragraf bahwa materi telah disampaikan dengan baik kepada KPM yang hadir.
''';
  }

  String buildPengaduanAnalysisPrompt({
    required String aduan,
    required String analisa,
  }) {
    return '''Anda adalah asisten cerdas Kementerian Sosial RI.
Tugas Anda adalah menyusun narasi laporan Pengaduan Masyarakat yang baik, rapi, formal, dan profesional dalam bahasa Indonesia yang baku.

Berdasarkan data berikut:
- Aduan Masyarakat: "$aduan"
- Analisis Awal & Tindak Lanjut: "$analisa"

Buatlah laporan analisis dan tindak lanjut yang komprehensif, terstruktur, dan formal (menggunakan tata bahasa birokrasi pemerintahan Indonesia yang sopan dan lugas).
Fokuskan untuk menggabungkan aduan dan analisis awal tersebut ke dalam poin-poin analisis yang jelas dan rencana aksi tindak lanjut yang nyata.

PENTING: Jangan menyertakan judul "Analisis AI" atau kata-kata "AI". Tulis langsung isi laporannya secara formal.
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
