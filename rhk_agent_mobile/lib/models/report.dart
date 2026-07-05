import 'dart:convert';
import 'p2k2_data.dart';

class Report {
  final String id;
  final String tanggal;
  final String jenisRHK;
  final String idRHK;
  final String rencanaAksi;
  final String pukul;
  final String poinKegiatan;
  final String narasiAI;
  final String narasiEdited;
  final String status;
  final String pdfFileId;
  final List<String> fotoIds;
  final P2K2Data? p2k2Data;
  final String physicalLokasi;
  final String createdAt;

  Report({
    required this.id,
    required this.tanggal,
    required this.jenisRHK,
    required this.idRHK,
    required this.rencanaAksi,
    required this.pukul,
    required this.poinKegiatan,
    required this.narasiAI,
    required this.narasiEdited,
    required this.status,
    required this.pdfFileId,
    required this.fotoIds,
    this.p2k2Data,
    required this.physicalLokasi,
    required this.createdAt,
  });

  String? get thumbnailUrl {
    if (fotoIds.isNotEmpty) {
      return 'https://drive.google.com/thumbnail?id=${fotoIds.first}&sz=w300';
    }
    return null;
  }

  factory Report.fromSheetRow(List<Object?> row) {
    String safeString(int index) {
      if (index < row.length && row[index] != null) {
        return row[index].toString();
      }
      return '';
    }

    List<String> parseFotoIds(String jsonString) {
      if (jsonString.isEmpty) return [];
      try {
        final List<dynamic> decoded = jsonDecode(jsonString);
        return decoded.map((e) => e.toString()).toList();
      } catch (e) {
        return [];
      }
    }

    return Report(
      id: safeString(0),
      tanggal: safeString(1),
      jenisRHK: safeString(2),
      idRHK: safeString(3),
      rencanaAksi: safeString(4),
      pukul: safeString(5),
      poinKegiatan: safeString(6),
      narasiAI: safeString(7),
      narasiEdited: safeString(8),
      status: safeString(9),
      pdfFileId: safeString(10),
      fotoIds: parseFotoIds(safeString(11)),
      p2k2Data: P2K2Data.fromJsonString(safeString(12)),
      physicalLokasi: safeString(13),
      createdAt: safeString(14),
    );
  }

  List<Object?> toSheetRow() {
    return [
      id,
      tanggal,
      jenisRHK,
      idRHK,
      rencanaAksi,
      pukul,
      poinKegiatan,
      narasiAI,
      narasiEdited,
      status,
      pdfFileId,
      jsonEncode(fotoIds),
      p2k2Data?.toJsonString() ?? '',
      physicalLokasi,
      createdAt,
    ];
  }

  Report copyWith({
    String? narasiAI,
    String? narasiEdited,
    String? status,
    String? pdfFileId,
    String? physicalLokasi,
  }) {
    return Report(
      id: id,
      tanggal: tanggal,
      jenisRHK: jenisRHK,
      idRHK: idRHK,
      rencanaAksi: rencanaAksi,
      pukul: pukul,
      poinKegiatan: poinKegiatan,
      narasiAI: narasiAI ?? this.narasiAI,
      narasiEdited: narasiEdited ?? this.narasiEdited,
      status: status ?? this.status,
      pdfFileId: pdfFileId ?? this.pdfFileId,
      fotoIds: fotoIds,
      p2k2Data: p2k2Data,
      physicalLokasi: physicalLokasi ?? this.physicalLokasi,
      createdAt: createdAt,
    );
  }
}
