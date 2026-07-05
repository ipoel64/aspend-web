class NotaDinas {
  final String id;
  final String email;
  final String nomor;
  final String yth;
  final String dari;
  final String hal;
  final String lampiran;
  final String sifat;
  final String tanggal;
  final String poinDraft;
  final String isiNotaDinas;
  final String pdfFileId;
  final String createdAt;
  final String buktiDukung;

  NotaDinas({
    required this.id,
    required this.email,
    required this.nomor,
    required this.yth,
    required this.dari,
    required this.hal,
    required this.lampiran,
    required this.sifat,
    required this.tanggal,
    required this.poinDraft,
    required this.isiNotaDinas,
    required this.pdfFileId,
    required this.createdAt,
    this.buktiDukung = '',
  });

  factory NotaDinas.fromSheetRow(List<Object?> row) {
    String safeString(int index) {
      if (index < row.length && row[index] != null) {
        return row[index].toString();
      }
      return '';
    }

    return NotaDinas(
      id: safeString(0),
      email: safeString(1),
      nomor: safeString(2),
      yth: safeString(3),
      dari: safeString(4),
      hal: safeString(5),
      lampiran: safeString(6),
      sifat: safeString(7),
      tanggal: safeString(8),
      poinDraft: safeString(9),
      isiNotaDinas: safeString(10),
      pdfFileId: safeString(11),
      createdAt: safeString(12),
      buktiDukung: safeString(13),
    );
  }

  List<Object?> toSheetRow() {
    return [
      id,
      email,
      nomor,
      yth,
      dari,
      hal,
      lampiran,
      sifat,
      tanggal,
      poinDraft,
      isiNotaDinas,
      pdfFileId,
      createdAt,
      buktiDukung,
    ];
  }

  NotaDinas copyWith({
    String? id,
    String? email,
    String? nomor,
    String? yth,
    String? dari,
    String? hal,
    String? lampiran,
    String? sifat,
    String? tanggal,
    String? poinDraft,
    String? isiNotaDinas,
    String? pdfFileId,
    String? createdAt,
    String? buktiDukung,
  }) {
    return NotaDinas(
      id: id ?? this.id,
      email: email ?? this.email,
      nomor: nomor ?? this.nomor,
      yth: yth ?? this.yth,
      dari: dari ?? this.dari,
      hal: hal ?? this.hal,
      lampiran: lampiran ?? this.lampiran,
      sifat: sifat ?? this.sifat,
      tanggal: tanggal ?? this.tanggal,
      poinDraft: poinDraft ?? this.poinDraft,
      isiNotaDinas: isiNotaDinas ?? this.isiNotaDinas,
      pdfFileId: pdfFileId ?? this.pdfFileId,
      createdAt: createdAt ?? this.createdAt,
      buktiDukung: buktiDukung ?? this.buktiDukung,
    );
  }
}
