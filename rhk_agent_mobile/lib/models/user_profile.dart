class UserProfile {
  final String email;
  final String nama;
  final String nip;
  final String jabatan;
  final String kabupatenKota;
  final String signatureFileId;
  final String photoFileId;
  final String logoFileId;
  final String jenisSdm;
  final String provinsi;
  final String kecamatan;
  final String jabatanAsn;

  UserProfile({
    required this.email,
    required this.nama,
    required this.nip,
    required this.jabatan,
    required this.kabupatenKota,
    required this.signatureFileId,
    required this.photoFileId,
    required this.logoFileId,
    required this.jenisSdm,
    this.provinsi = '',
    this.kecamatan = '',
    this.jabatanAsn = '',
  });

  factory UserProfile.fromSheetRow(List<Object?> row) {
    String safeString(int index) {
      if (index < row.length && row[index] != null) {
        return row[index].toString();
      }
      return '';
    }

    return UserProfile(
      email: safeString(0),
      nama: safeString(1),
      nip: safeString(2),
      jabatan: safeString(3),
      kabupatenKota: safeString(4),
      signatureFileId: safeString(5),
      photoFileId: safeString(6),
      logoFileId: safeString(7),
      jenisSdm: safeString(8),
      provinsi: safeString(9),
      kecamatan: safeString(10),
      jabatanAsn: safeString(11),
    );
  }

  List<Object?> toSheetRow() {
    return [
      email,
      nama,
      nip,
      jabatan,
      kabupatenKota,
      signatureFileId,
      photoFileId,
      logoFileId,
      jenisSdm,
      provinsi,
      kecamatan,
      jabatanAsn,
    ];
  }

  UserProfile copyWith({
    String? email,
    String? nama,
    String? nip,
    String? jabatan,
    String? kabupatenKota,
    String? signatureFileId,
    String? photoFileId,
    String? logoFileId,
    String? jenisSdm,
    String? provinsi,
    String? kecamatan,
    String? jabatanAsn,
  }) {
    return UserProfile(
      email: email ?? this.email,
      nama: nama ?? this.nama,
      nip: nip ?? this.nip,
      jabatan: jabatan ?? this.jabatan,
      kabupatenKota: kabupatenKota ?? this.kabupatenKota,
      signatureFileId: signatureFileId ?? this.signatureFileId,
      photoFileId: photoFileId ?? this.photoFileId,
      logoFileId: logoFileId ?? this.logoFileId,
      jenisSdm: jenisSdm ?? this.jenisSdm,
      provinsi: provinsi ?? this.provinsi,
      kecamatan: kecamatan ?? this.kecamatan,
      jabatanAsn: jabatanAsn ?? this.jabatanAsn,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'nama': nama,
      'nip': nip,
      'jabatan': jabatan,
      'kabupatenKota': kabupatenKota,
      'signatureFileId': signatureFileId,
      'photoFileId': photoFileId,
      'logoFileId': logoFileId,
      'jenisSdm': jenisSdm,
      'provinsi': provinsi,
      'kecamatan': kecamatan,
      'jabatanAsn': jabatanAsn,
    };
  }

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      email: json['email']?.toString() ?? '',
      nama: json['nama']?.toString() ?? '',
      nip: json['nip']?.toString() ?? '',
      jabatan: json['jabatan']?.toString() ?? '',
      kabupatenKota: json['kabupatenKota']?.toString() ?? '',
      signatureFileId: json['signatureFileId']?.toString() ?? '',
      photoFileId: json['photoFileId']?.toString() ?? '',
      logoFileId: json['logoFileId']?.toString() ?? '',
      jenisSdm: json['jenisSdm']?.toString() ?? 'SDM PKH',
      provinsi: json['provinsi']?.toString() ?? '',
      kecamatan: json['kecamatan']?.toString() ?? '',
      jabatanAsn: json['jabatanAsn']?.toString() ?? '',
    );
  }
}
