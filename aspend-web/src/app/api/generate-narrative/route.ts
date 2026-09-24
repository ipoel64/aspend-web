import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const OPENROUTER_DEFAULT_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatTanggalIndo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const hari = NAMA_HARI[d.getDay()];
      const tgl = d.getDate();
      const bln = NAMA_BULAN[d.getMonth()];
      const thn = d.getFullYear();
      return `${hari}, ${tgl} ${bln} ${thn}`;
    }
  } catch {}
  return dateStr;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken is attached in auth.ts
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jenisRHK, idRHK, rencanaAksi, tanggal, pukul, poinKegiatan, p2k2Data } = body;

    if (!jenisRHK || !rencanaAksi || !poinKegiatan) {
      return NextResponse.json({ error: 'Data laporan belum lengkap.' }, { status: 400 });
    }

    const formattedTanggal = formatTanggalIndo(tanggal || new Date().toISOString());
    const timeStr = pukul || '14:00';

    // Susun Prompt Resmi ASPEND Kemensos RI
    let prompt = `Anda adalah asisten cerdas yang bertugas membuat narasi Laporan Rencana Hasil Kerja (RHK) resmi untuk pegawai Kementerian Sosial RI (Program Keluarga Harapan).
Buat narasi laporan yang ekstensif, mendetail, dan komprehensif dalam bahasa Indonesia yang baku, formal, dan profesional.
Buatlah narasi yang komprehensif namun padat, ringkas, dan tepat sasaran. Jabarkan poin-poin secara efektif (sekitar 1-2 paragraf per bagian) tanpa bertele-tele.

Berdasarkan data berikut:
- Jenis RHK: ${jenisRHK} (${idRHK || 'RHK'})
- Rencana Aksi: ${rencanaAksi}
- Tanggal: ${formattedTanggal}
- Pukul: ${timeStr}
- Poin Kegiatan:
${poinKegiatan}

ATURAN SUPER PENTING:
1. JANGAN PERNAH membuat kalimat pengantar, basa-basi, atau preamble apa pun di awal laporan (seperti "Berikut adalah laporan...", "Baik, ini hasil..."). Langsung mulai teks Anda dari baris pertama dengan "A. PENDAHULUAN".
2. Format HARUS mengikuti struktur baku di bawah ini tanpa tambahan teks apa pun di atasnya.
3. JANGAN PERNAH menggunakan simbol asterisk (*) untuk membuat daftar/bullet points. Selalu gunakan tanda hubung (-) atau angka (1, 2, 3) agar formatnya rapi saat dicetak ke PDF.
4. JANGAN membuat tabel markdown (karakter pipa "|"). Seluruh isi laporan harus berupa narasi paragraf dan daftar berbutir tanda hubung (-).
5. Pada bagian 4. Dasar: JANGAN gunakan referensi "Undang-Undang Nomor...". Gunakan referensi yang lebih umum seperti: Pedoman Umum PKH, Petunjuk Teknis Penyaluran Bantuan Sosial, atau Pedoman Pelaksanaan Program Keluarga Harapan.
6. JANGAN menuliskan komentar, konfirmasi pemahaman aturan, atau proses berpikir Anda. HANYA tuliskan teks isi laporan akhirnya saja.
7. Bagian E. PENUTUP ADALAH WAJIB MUTLAK dan HARUS SELALU DITULISKAN di bagian akhir laporan setelah bagian D. KESIMPULAN DAN SARAN. Jangan pernah berhenti di bagian D!

A. PENDAHULUAN
1. Gambaran Umum: (tuliskan latar belakang singkat dan komprehensif tentang kegiatan ini)
2. Maksud dan Tujuan: (jabarkan apa yang ingin dicapai secara rinci)
3. Ruang Lingkup: (batasan kegiatan yang dilaporkan)
4. Dasar: (gunakan referensi pedoman/juknis resmi, bukan UU)

B. KEGIATAN YANG DILAKSANAKAN
(Jelaskan secara sangat deskriptif, mengalir, dan terperinci apa saja yang dilakukan. Kembangkan poin kegiatan menjadi narasi resmi yang runut dan jelas).

C. HASIL
(Uraikan secara mendalam apa output/hasil dari kegiatan tersebut, dampaknya, serta analisis singkat).

D. KESIMPULAN DAN SARAN
(Kesimpulan komprehensif dan rekomendasi mendetail untuk tindak lanjut).

E. PENUTUP
Demikian laporan pelaksanaan kegiatan ini dibuat sebagai bentuk pertanggungjawaban pelaksanaan tugas dan untuk dipergunakan sebagaimana mestinya.

Tambahan: Jika dalam poin kegiatan terdapat nama lokasi atau tempat, tolong ekstrak dan taruh di bagian paling bawah laporan menggunakan tag XML seperti ini: <lokasi>Nama Lokasinya Saja</lokasi>. Jika tidak ada lokasi spesifik, tulis <lokasi>Tidak disebutkan</lokasi>.`;

    if (p2k2Data && (p2k2Data.modul || p2k2Data.sesi)) {
      prompt += `\n\nPastikan untuk melebur dan menarasikan informasi khusus P2K2 berikut di dalam paragraf pada bagian B. KEGIATAN YANG DILAKSANAKAN:
- Modul: ${p2k2Data.modul || '-'}
- Sesi: ${p2k2Data.sesi || '-'}
- Kelompok: ${p2k2Data.namaKelompok || '-'}
- Ketua Kelompok: ${p2k2Data.ketuaKelompok || '-'}
- Kehadiran: ${p2k2Data.jumlahHadir || '0'} hadir dari total ${p2k2Data.jumlahKPM || '0'} anggota.
Jelaskan juga dalam paragraf bahwa materi telah disampaikan dengan baik kepada KPM yang hadir.`;
    }

    let generatedText = '';
    const openRouterKey = process.env.OPENROUTER_API_KEY || OPENROUTER_DEFAULT_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Coba OpenRouter API
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aspend-web.app',
          'X-Title': 'Aspend Web',
        },
        body: JSON.stringify({
          model: OPENROUTER_DEFAULT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        generatedText = data.choices?.[0]?.message?.content || '';
      } else {
        console.warn('OpenRouter API response not ok:', response.status, await response.text());
      }
    } catch (err) {
      console.warn('OpenRouter API request error:', err);
    }

    // 2. Fallback ke OpenRouter model google/gemini-2.0-flash jika model pertama gagal
    if (!generatedText) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://aspend-web.app',
            'X-Title': 'Aspend Web',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 3000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          generatedText = data.choices?.[0]?.message?.content || '';
        }
      } catch (err) {
        console.warn('OpenRouter fallback model error:', err);
      }
    }

    // 3. Fallback ke Google Gemini Direct jika ada GEMINI_API_KEY
    if (!generatedText && geminiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (err) {
        console.warn('Gemini direct API error:', err);
      }
    }

    if (!generatedText) {
      throw new Error('Gagal menghubungkan ke layanan AI. Mohon coba sesaat lagi.');
    }

    // 4. Ekstrak lokasi
    let location = '';
    const locRegex = /<lokasi>([\s\S]*?)<\/lokasi>/i;
    const locMatch = generatedText.match(locRegex);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim();
      if (location.toLowerCase() === 'tidak disebutkan') location = '';
    }
    let cleanNarrative = generatedText.replace(locRegex, '').trim();

    // 5. Bersihkan karakter aneh
    cleanNarrative = cleanNarrative
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')
      .replace(/•/g, '-')
      .replace(/\u00AD/g, '')
      .replace(/\u200B/g, '');

    // 6. Potong preamble jika AI menghasilkan basa-basi sebelum "A. PENDAHULUAN"
    const pendahuluanMatch = cleanNarrative.search(/(?:\*\*)?A\.\s+PENDAHULUAN(?:\*\*)?/i);
    if (pendahuluanMatch !== -1) {
      cleanNarrative = cleanNarrative.substring(pendahuluanMatch);
    }

    // 7. Pastikan seksi E. PENUTUP selalu ada
    const hasPenutup = /(?:\*\*)?E\.\s*PENUTUP(?:\*\*)?/i.test(cleanNarrative);
    if (!hasPenutup) {
      cleanNarrative += '\n\nE. PENUTUP\nDemikian laporan pelaksanaan kegiatan ini dibuat sebagai bentuk pertanggungjawaban pelaksanaan tugas dan untuk dipergunakan sebagaimana mestinya.';
    }

    return NextResponse.json({
      success: true,
      narrative: cleanNarrative,
      lokasi: location,
    });
  } catch (error: any) {
    console.error('Error /api/generate-narrative:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
