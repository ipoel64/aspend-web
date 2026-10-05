export interface NotaDinasItem {
  id: string;
  email: string;
  nomor: string;
  yth: string;
  dari: string;
  hal: string;
  lampiran: string;
  sifat: string;
  tanggal: string;
  poinDraft: string;
  isiNotaDinas: string;
  pdfFileId: string;
  createdAt: string;
  buktiDukung: string; // Comma-separated Google Drive file IDs or URLs
}

export const SHEET_NOTA_DINAS = 'Nota_Dinas';

export const NOTA_DINAS_HEADERS = [
  'NotaDinasId',
  'Email',
  'Nomor',
  'Yth',
  'Dari',
  'Hal',
  'Lampiran',
  'Sifat',
  'Tanggal',
  'PoinDraft',
  'IsiNotaDinas',
  'PdfFileId',
  'CreatedAt',
  'BuktiDukung',
];

export const SIFAT_NOTA_DINAS_OPTIONS = ['Biasa', 'Penting', 'Rahasia', 'Segera'];

export function generateNotaDinasId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `ND-${y}${m}${d}-${h}${min}${s}`;
}

export function parseNotaDinasRow(row: any[]): NotaDinasItem {
  const safeStr = (idx: number) => (row && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '');
  return {
    id: safeStr(0),
    email: safeStr(1),
    nomor: safeStr(2),
    yth: safeStr(3),
    dari: safeStr(4),
    hal: safeStr(5),
    lampiran: safeStr(6) || '-',
    sifat: safeStr(7) || 'Biasa',
    tanggal: safeStr(8),
    poinDraft: safeStr(9),
    isiNotaDinas: safeStr(10),
    pdfFileId: safeStr(11),
    createdAt: safeStr(12) || new Date().toISOString(),
    buktiDukung: safeStr(13),
  };
}

export function notaDinasToRow(item: NotaDinasItem): string[] {
  return [
    item.id,
    item.email || '',
    item.nomor || '',
    item.yth || '',
    item.dari || '',
    item.hal || '',
    item.lampiran || '-',
    item.sifat || 'Biasa',
    item.tanggal || '',
    item.poinDraft || '',
    item.isiNotaDinas || '',
    item.pdfFileId || '',
    item.createdAt || new Date().toISOString(),
    item.buktiDukung || '',
  ];
}
