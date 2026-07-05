class UserProfile {
  final String email;
  final String nama;
  final String nip;
  final String jabatan;
  final String kabupatenKota;
  final String signatureFileId;
  final String photoFileId;
  final String logoFileId;

  UserProfile({
    required this.email,
    required this.nama,
    required this.nip,
    required this.jabatan,
    required this.kabupatenKota,
    required this.signatureFileId,
    required this.photoFileId,
    required this.logoFileId,
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
    );
  }
}
