import 'dart:convert';

class P2K2Data {
  final String modul;
  final String sesi;
  final String jumlahKPM;
  final String jumlahHadir;
  final String jumlahSakit;
  final String jumlahAlpa;
  final String namaKelompok;
  final String ketuaKelompok;
  final String jamSelesai;
  final String tempatPelaksanaan;
  final String namaPemateri;
  final String jabatanPemateri;
  final bool isPemateriDiriSendiri;

  // Khusus Supervisi Katim Kab/Kota & Katim Provinsi
  final String namaKetuaTim;
  final String desaKelurahan;
  final String kecamatan;
  final String kabupatenKota;
  final String provinsi;
  final String namaPendamping;
  final String nipPendamping;
  final bool isSupervisi;

  P2K2Data({
    required this.modul,
    required this.sesi,
    required this.jumlahKPM,
    required this.jumlahHadir,
    this.jumlahSakit = '0',
    this.jumlahAlpa = '0',
    this.namaKelompok = '',
    this.ketuaKelompok = '',
    this.jamSelesai = '',
    this.tempatPelaksanaan = '',
    this.namaPemateri = '',
    this.jabatanPemateri = '',
    this.isPemateriDiriSendiri = true,
    this.namaKetuaTim = '',
    this.desaKelurahan = '',
    this.kecamatan = '',
    this.kabupatenKota = '',
    this.provinsi = '',
    this.namaPendamping = '',
    this.nipPendamping = '',
    this.isSupervisi = false,
  });

  factory P2K2Data.fromJson(Map<String, dynamic> json) {
    return P2K2Data(
      modul: json['modul']?.toString() ?? '',
      sesi: json['sesi']?.toString() ?? '',
      jumlahKPM: json['jumlahKPM']?.toString() ?? '',
      jumlahHadir: json['jumlahHadir']?.toString() ?? '',
      jumlahSakit: json['jumlahSakit']?.toString() ?? '0',
      jumlahAlpa: json['jumlahAlpa']?.toString() ?? '0',
      namaKelompok: json['namaKelompok']?.toString() ?? '',
      ketuaKelompok: json['ketuaKelompok']?.toString() ?? '',
      jamSelesai: json['jamSelesai']?.toString() ?? '',
      tempatPelaksanaan: json['tempatPelaksanaan']?.toString() ?? '',
      namaPemateri: json['namaPemateri']?.toString() ?? '',
      jabatanPemateri: json['jabatanPemateri']?.toString() ?? '',
      isPemateriDiriSendiri: json['isPemateriDiriSendiri'] == true || json['isPemateriDiriSendiri'] == 'true',
      namaKetuaTim: json['namaKetuaTim']?.toString() ?? '',
      desaKelurahan: json['desaKelurahan']?.toString() ?? '',
      kecamatan: json['kecamatan']?.toString() ?? '',
      kabupatenKota: json['kabupatenKota']?.toString() ?? '',
      provinsi: json['provinsi']?.toString() ?? '',
      namaPendamping: json['namaPendamping']?.toString() ?? '',
      nipPendamping: json['nipPendamping']?.toString() ?? '',
      isSupervisi: json['isSupervisi'] == true || json['isSupervisi'] == 'true',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'modul': modul,
      'sesi': sesi,
      'jumlahKPM': jumlahKPM,
      'jumlahHadir': jumlahHadir,
      'jumlahSakit': jumlahSakit,
      'jumlahAlpa': jumlahAlpa,
      'namaKelompok': namaKelompok,
      'ketuaKelompok': ketuaKelompok,
      'jamSelesai': jamSelesai,
      'tempatPelaksanaan': tempatPelaksanaan,
      'namaPemateri': namaPemateri,
      'jabatanPemateri': jabatanPemateri,
      'isPemateriDiriSendiri': isPemateriDiriSendiri,
      'namaKetuaTim': namaKetuaTim,
      'desaKelurahan': desaKelurahan,
      'kecamatan': kecamatan,
      'kabupatenKota': kabupatenKota,
      'provinsi': provinsi,
      'namaPendamping': namaPendamping,
      'nipPendamping': nipPendamping,
      'isSupervisi': isSupervisi,
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
