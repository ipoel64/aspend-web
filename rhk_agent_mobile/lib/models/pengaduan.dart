class Pengaduan {
  final String id;
  final String email;
  final String nik;
  final String nama;
  final String alamat;
  final String desaKelurahan;
  final String kecamatan;
  final String kabKota;
  final String aduan;
  final String hasilAnalisa;
  final double latitude;
  final double longitude;
  final String fotoKtp;
  final String screenshotSiks;
  final String pdfFileId;
  final String createdAt;

  Pengaduan({
    required this.id,
    required this.email,
    required this.nik,
    required this.nama,
    required this.alamat,
    required this.desaKelurahan,
    required this.kecamatan,
    required this.kabKota,
    required this.aduan,
    required this.hasilAnalisa,
    required this.latitude,
    required this.longitude,
    required this.fotoKtp,
    required this.screenshotSiks,
    required this.pdfFileId,
    required this.createdAt,
  });

  factory Pengaduan.fromSheetRow(List<Object?> row) {
    String safeString(int index) {
      if (index < row.length && row[index] != null) {
        return row[index].toString();
      }
      return '';
    }

    double safeDouble(int index) {
      if (index < row.length && row[index] != null) {
        final strVal = row[index].toString().replaceAll(',', '.');
        return double.tryParse(strVal) ?? 0.0;
      }
      return 0.0;
    }

    return Pengaduan(
      id: safeString(0),
      email: safeString(1),
      nik: safeString(2),
      nama: safeString(3),
      alamat: safeString(4),
      desaKelurahan: safeString(5),
      kecamatan: safeString(6),
      kabKota: safeString(7),
      aduan: safeString(8),
      hasilAnalisa: safeString(9),
      latitude: safeDouble(10),
      longitude: safeDouble(11),
      fotoKtp: safeString(12),
      screenshotSiks: safeString(13),
      pdfFileId: safeString(14),
      createdAt: safeString(15),
    );
  }

  List<Object?> toSheetRow() {
    return [
      id,
      email,
      nik,
      nama,
      alamat,
      desaKelurahan,
      kecamatan,
      kabKota,
      aduan,
      hasilAnalisa,
      latitude,
      longitude,
      fotoKtp,
      screenshotSiks,
      pdfFileId,
      createdAt,
    ];
  }

  Pengaduan copyWith({
    String? id,
    String? email,
    String? nik,
    String? nama,
    String? alamat,
    String? desaKelurahan,
    String? kecamatan,
    String? kabKota,
    String? aduan,
    String? hasilAnalisa,
    double? latitude,
    double? longitude,
    String? fotoKtp,
    String? screenshotSiks,
    String? pdfFileId,
    String? createdAt,
  }) {
    return Pengaduan(
      id: id ?? this.id,
      email: email ?? this.email,
      nik: nik ?? this.nik,
      nama: nama ?? this.nama,
      alamat: alamat ?? this.alamat,
      desaKelurahan: desaKelurahan ?? this.desaKelurahan,
      kecamatan: kecamatan ?? this.kecamatan,
      kabKota: kabKota ?? this.kabKota,
      aduan: aduan ?? this.aduan,
      hasilAnalisa: hasilAnalisa ?? this.hasilAnalisa,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      fotoKtp: fotoKtp ?? this.fotoKtp,
      screenshotSiks: screenshotSiks ?? this.screenshotSiks,
      pdfFileId: pdfFileId ?? this.pdfFileId,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
