import 'dart:convert';

class P2K2Data {
  final String modul;
  final String sesi;
  final String jumlahKPM;
  final String jumlahHadir;
  final String namaKelompok;
  final String ketuaKelompok;

  P2K2Data({
    required this.modul,
    required this.sesi,
    required this.jumlahKPM,
    required this.jumlahHadir,
    required this.namaKelompok,
    required this.ketuaKelompok,
  });

  factory P2K2Data.fromJson(Map<String, dynamic> json) {
    return P2K2Data(
      modul: json['modul']?.toString() ?? '',
      sesi: json['sesi']?.toString() ?? '',
      jumlahKPM: json['jumlahKPM']?.toString() ?? '',
      jumlahHadir: json['jumlahHadir']?.toString() ?? '',
      namaKelompok: json['namaKelompok']?.toString() ?? '',
      ketuaKelompok: json['ketuaKelompok']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'modul': modul,
      'sesi': sesi,
      'jumlahKPM': jumlahKPM,
      'jumlahHadir': jumlahHadir,
      'namaKelompok': namaKelompok,
      'ketuaKelompok': ketuaKelompok,
    };
  }

  static P2K2Data? fromJsonString(String? jsonString) {
    if (jsonString == null || jsonString.isEmpty) return null;
    try {
      final Map<String, dynamic> data = jsonDecode(jsonString);
      return P2K2Data.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  String toJsonString() {
    return jsonEncode(toJson());
  }
}
