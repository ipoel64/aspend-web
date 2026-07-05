/// Model data untuk modul Keluarga Penerima Manfaat (KPM) PKH

class KpmProfile {
  final KpmCaretaker caretaker;
  final List<KpmComponent> komponenList;
  final KpmHouse house;

  KpmProfile({
    required this.caretaker,
    required this.komponenList,
    required this.house,
  });

  KpmProfile copyWith({
    KpmCaretaker? caretaker,
    List<KpmComponent>? komponenList,
    KpmHouse? house,
  }) {
    return KpmProfile(
      caretaker: caretaker ?? this.caretaker,
      komponenList: komponenList ?? this.komponenList,
      house: house ?? this.house,
    );
  }
}

class KpmCaretaker {
  final String kpmId;
  final String nik;
  final String noKk;
  final String nama;
  final String status; // 'Ketua' atau 'Anggota'
  final String namaKelompok;
  final String pekerjaan;
  final String noHp;
  final String provinsi;
  final String kabKota;
  final String kecamatan;
  final String desaKelurahan;
  final String lingkungan;
  final String fotoWajah;
  final String fotoKtp;
  final String fotoKk;
  final String fotoBukuTabungan;
  final String fotoKks;
  final String tahunDapatBansos;
  final String createdAt;

  KpmCaretaker({
    required this.kpmId,
    required this.nik,
    required this.noKk,
    required this.nama,
    required this.status,
    required this.namaKelompok,
    required this.pekerjaan,
    required this.noHp,
    required this.provinsi,
    required this.kabKota,
    required this.kecamatan,
    required this.desaKelurahan,
    required this.lingkungan,
    required this.fotoWajah,
    required this.fotoKtp,
    required this.fotoKk,
    required this.fotoBukuTabungan,
    required this.fotoKks,
    required this.tahunDapatBansos,
    required this.createdAt,
  });

  factory KpmCaretaker.fromSheetRow(List<dynamic> row) {
    return KpmCaretaker(
      kpmId: row.isNotEmpty ? row[0].toString() : '',
      nik: row.length > 1 ? row[1].toString() : '',
      noKk: row.length > 2 ? row[2].toString() : '',
      nama: row.length > 3 ? row[3].toString() : '',
      status: row.length > 4 ? row[4].toString() : 'Anggota',
      namaKelompok: row.length > 5 ? row[5].toString() : '',
      pekerjaan: row.length > 6 ? row[6].toString() : '',
      noHp: row.length > 7 ? row[7].toString() : '',
      provinsi: row.length > 8 ? row[8].toString() : '',
      kabKota: row.length > 9 ? row[9].toString() : '',
      kecamatan: row.length > 10 ? row[10].toString() : '',
      desaKelurahan: row.length > 11 ? row[11].toString() : '',
      lingkungan: row.length > 12 ? row[12].toString() : '',
      fotoWajah: row.length > 13 ? row[13].toString() : '',
      fotoKtp: row.length > 14 ? row[14].toString() : '',
      fotoKk: row.length > 15 ? row[15].toString() : '',
      fotoBukuTabungan: row.length > 16 ? row[16].toString() : '',
      fotoKks: row.length > 17 ? row[17].toString() : '',
      tahunDapatBansos: row.length > 18 ? row[18].toString() : '',
      createdAt: row.length > 19 ? row[19].toString() : '',
    );
  }

  List<Object?> toSheetRow() {
    return [
      kpmId,
      nik,
      noKk,
      nama,
      status,
      namaKelompok,
      pekerjaan,
      noHp,
      provinsi,
      kabKota,
      kecamatan,
      desaKelurahan,
      lingkungan,
      fotoWajah,
      fotoKtp,
      fotoKk,
      fotoBukuTabungan,
      fotoKks,
      tahunDapatBansos,
      createdAt.isEmpty ? DateTime.now().toIso8601String() : createdAt,
    ];
  }

  KpmCaretaker copyWith({
    String? kpmId,
    String? nik,
    String? noKk,
    String? nama,
    String? status,
    String? namaKelompok,
    String? pekerjaan,
    String? noHp,
    String? provinsi,
    String? kabKota,
    String? kecamatan,
    String? desaKelurahan,
    String? lingkungan,
    String? fotoWajah,
    String? fotoKtp,
    String? fotoKk,
    String? fotoBukuTabungan,
    String? fotoKks,
    String? tahunDapatBansos,
    String? createdAt,
  }) {
    return KpmCaretaker(
      kpmId: kpmId ?? this.kpmId,
      nik: nik ?? this.nik,
      noKk: noKk ?? this.noKk,
      nama: nama ?? this.nama,
      status: status ?? this.status,
      namaKelompok: namaKelompok ?? this.namaKelompok,
      pekerjaan: pekerjaan ?? this.pekerjaan,
      noHp: noHp ?? this.noHp,
      provinsi: provinsi ?? this.provinsi,
      kabKota: kabKota ?? this.kabKota,
      kecamatan: kecamatan ?? this.kecamatan,
      desaKelurahan: desaKelurahan ?? this.desaKelurahan,
      lingkungan: lingkungan ?? this.lingkungan,
      fotoWajah: fotoWajah ?? this.fotoWajah,
      fotoKtp: fotoKtp ?? this.fotoKtp,
      fotoKk: fotoKk ?? this.fotoKk,
      fotoBukuTabungan: fotoBukuTabungan ?? this.fotoBukuTabungan,
      fotoKks: fotoKks ?? this.fotoKks,
      tahunDapatBansos: tahunDapatBansos ?? this.tahunDapatBansos,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class KpmComponent {
  final String komponenId;
  final String kpmId;
  final String nama;
  final String jenisKelamin; // 'L' atau 'P'
  final String hubunganKeluarga; // 'Anak', 'Istri', dll.
  final String jenisKomponen; // 'SD', 'SMP', 'SMA', 'USIA DINI', 'BUMIL', 'LANSIA', 'DISABILITAS'
  final String kelas; // Pilihan kelas bagi yang sekolah
  final String posyandu; // Data posyandu bagi balita/bumil
  final String createdAt;

  KpmComponent({
    required this.komponenId,
    required this.kpmId,
    required this.nama,
    required this.jenisKelamin,
    required this.hubunganKeluarga,
    required this.jenisKomponen,
    required this.kelas,
    required this.posyandu,
    required this.createdAt,
  });

  factory KpmComponent.fromSheetRow(List<dynamic> row) {
    return KpmComponent(
      komponenId: row.isNotEmpty ? row[0].toString() : '',
      kpmId: row.length > 1 ? row[1].toString() : '',
      nama: row.length > 2 ? row[2].toString() : '',
      jenisKelamin: row.length > 3 ? row[3].toString() : 'L',
      hubunganKeluarga: row.length > 4 ? row[4].toString() : 'Anak',
      jenisKomponen: row.length > 5 ? row[5].toString() : 'SD',
      kelas: row.length > 6 ? row[6].toString() : '',
      posyandu: row.length > 7 ? row[7].toString() : '',
      createdAt: row.length > 8 ? row[8].toString() : '',
    );
  }

  List<Object?> toSheetRow() {
    return [
      komponenId,
      kpmId,
      nama,
      jenisKelamin,
      hubunganKeluarga,
      jenisKomponen,
      kelas,
      posyandu,
      createdAt.isEmpty ? DateTime.now().toIso8601String() : createdAt,
    ];
  }

  KpmComponent copyWith({
    String? komponenId,
    String? kpmId,
    String? nama,
    String? jenisKelamin,
    String? hubunganKeluarga,
    String? jenisKomponen,
    String? kelas,
    String? posyandu,
    String? createdAt,
  }) {
    return KpmComponent(
      komponenId: komponenId ?? this.komponenId,
      kpmId: kpmId ?? this.kpmId,
      nama: nama ?? this.nama,
      jenisKelamin: jenisKelamin ?? this.jenisKelamin,
      hubunganKeluarga: hubunganKeluarga ?? this.hubunganKeluarga,
      jenisKomponen: jenisKomponen ?? this.jenisKomponen,
      kelas: kelas ?? this.kelas,
      posyandu: posyandu ?? this.posyandu,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class KpmHouse {
  final String rumahId;
  final String kpmId;
  final String punyaUsaha; // 'Y' atau 'T'
  final String namaUsaha;
  final String fotoUsaha;
  final String fotoRumahLuar;
  final String fotoRumahTamu;
  final String fotoKamarMandi;
  final double latitude;
  final double longitude;
  final String pernyataan; // Pernyataan kemandirian/kemiskinan
  final String bansosLain; // Komplementaritas bansos lain (CSV format/comma separated)
  final String createdAt;

  KpmHouse({
    required this.rumahId,
    required this.kpmId,
    required this.punyaUsaha,
    required this.namaUsaha,
    required this.fotoUsaha,
    required this.fotoRumahLuar,
    required this.fotoRumahTamu,
    required this.fotoKamarMandi,
    required this.latitude,
    required this.longitude,
    required this.pernyataan,
    required this.bansosLain,
    required this.createdAt,
  });

  factory KpmHouse.fromSheetRow(List<dynamic> row) {
    return KpmHouse(
      rumahId: row.isNotEmpty ? row[0].toString() : '',
      kpmId: row.length > 1 ? row[1].toString() : '',
      punyaUsaha: row.length > 2 ? row[2].toString() : 'T',
      namaUsaha: row.length > 3 ? row[3].toString() : '',
      fotoUsaha: row.length > 4 ? row[4].toString() : '',
      fotoRumahLuar: row.length > 5 ? row[5].toString() : '',
      fotoRumahTamu: row.length > 6 ? row[6].toString() : '',
      fotoKamarMandi: row.length > 7 ? row[7].toString() : '',
      latitude: row.length > 8 ? (double.tryParse(row[8].toString().replaceAll(',', '.')) ?? 0.0) : 0.0,
      longitude: row.length > 9 ? (double.tryParse(row[9].toString().replaceAll(',', '.')) ?? 0.0) : 0.0,
      pernyataan: row.length > 10 ? row[10].toString() : '',
      bansosLain: row.length > 11 ? row[11].toString() : '',
      createdAt: row.length > 12 ? row[12].toString() : '',
    );
  }

  List<Object?> toSheetRow() {
    return [
      rumahId,
      kpmId,
      punyaUsaha,
      namaUsaha,
      fotoUsaha,
      fotoRumahLuar,
      fotoRumahTamu,
      fotoKamarMandi,
      latitude,
      longitude,
      pernyataan,
      bansosLain,
      createdAt.isEmpty ? DateTime.now().toIso8601String() : createdAt,
    ];
  }

  KpmHouse copyWith({
    String? rumahId,
    String? kpmId,
    String? punyaUsaha,
    String? namaUsaha,
    String? fotoUsaha,
    String? fotoRumahLuar,
    String? fotoRumahTamu,
    String? fotoKamarMandi,
    double? latitude,
    double? longitude,
    String? pernyataan,
    String? bansosLain,
    String? createdAt,
  }) {
    return KpmHouse(
      rumahId: rumahId ?? this.rumahId,
      kpmId: kpmId ?? this.kpmId,
      punyaUsaha: punyaUsaha ?? this.punyaUsaha,
      namaUsaha: namaUsaha ?? this.namaUsaha,
      fotoUsaha: fotoUsaha ?? this.fotoUsaha,
      fotoRumahLuar: fotoRumahLuar ?? this.fotoRumahLuar,
      fotoRumahTamu: fotoRumahTamu ?? this.fotoRumahTamu,
      fotoKamarMandi: fotoKamarMandi ?? this.fotoKamarMandi,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      pernyataan: pernyataan ?? this.pernyataan,
      bansosLain: bansosLain ?? this.bansosLain,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
