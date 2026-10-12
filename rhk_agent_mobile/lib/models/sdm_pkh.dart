class SdmPkh {
  final String id;
  final String nama;
  final String nip;

  SdmPkh({
    required this.id,
    required this.nama,
    required this.nip,
  });

  factory SdmPkh.fromJson(Map<String, dynamic> json) {
    return SdmPkh(
      id: json['id']?.toString() ?? '',
      nama: json['nama']?.toString() ?? '',
      nip: json['nip']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nama': nama,
      'nip': nip,
    };
  }

  SdmPkh copyWith({
    String? id,
    String? nama,
    String? nip,
  }) {
    return SdmPkh(
      id: id ?? this.id,
      nama: nama ?? this.nama,
      nip: nip ?? this.nip,
    );
  }
}
