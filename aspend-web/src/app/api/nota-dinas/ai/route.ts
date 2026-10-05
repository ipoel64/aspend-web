import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_KEY_B64 = 'c2stb3ItdjEtMDMxMjU3NDI2NjQwYTM3NWEyYjExMDM3ZmQ0YWE1NWM4MjQ1ZTVlZjkxNzM1NzU5NjcyOWM3NThlOTZiYTI0Nw==';
const OPENROUTER_DEFAULT_KEY = Buffer.from(DEFAULT_KEY_B64, 'base64').toString('utf-8');
const OPENROUTER_DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

export async function POST(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - accessToken in jwt
    const accessToken = session?.accessToken;
    if (!session || !accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      yth = '',
      dari = '',
      hal = '',
      tanggal = '',
      poinDraft = '',
    } = body;

    if (!poinDraft.trim()) {
      return NextResponse.json({ error: 'Poin draft kegiatan wajib diisi' }, { status: 400 });
    }

    const prompt = `Anda adalah asisten administrasi profesional di Kementerian Sosial RI.
Tugas Anda adalah menulis teks isi surat Nota Dinas resmi berdasarkan informasi berikut:
- Kepada Yth: ${yth || 'Kepala Dinas Sosial'}
- Dari: ${dari || 'Pendamping Sosial PKH'}
- Perihal (Hal): ${hal || 'Laporan Pelaksanaan Tugas'}
- Tanggal: ${tanggal || new Date().toLocaleDateString('id-ID')}
- Poin-poin Draft Kegiatan/Isi:
${poinDraft}

Aturan Penulisan:
1. Gunakan bahasa Indonesia yang baku, sangat formal, sopan, dan sesuai dengan tata bahasa birokrasi pemerintahan (Ejaan Yang Disempurnakan).
2. Mulai langsung dengan isi surat (paragraf pembuka, penjelasan poin draf secara deskriptif, dan paragraf penutup).
3. JANGAN menyertakan KOP, judul "NOTA DINAS", ataupun baris Nomor/Kepada/Dari/Hal/Tanggal di awal teks yang Anda hasilkan karena hal tersebut sudah dibuat oleh template PDF.
4. JANGAN menuliskan tanda tangan di akhir teks.
5. Format teks yang dihasilkan harus berupa paragraf-paragraf bersih tanpa formatting markdown seperti **bold** atau bullet points, agar rapi saat dicetak ke PDF.
`;

    const openRouterKey = process.env.OPENROUTER_API_KEY || OPENROUTER_DEFAULT_KEY;
    const model = process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL;

    let generatedText = '';

    // 1. Call OpenRouter
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aspend-web.vercel.app',
          'X-Title': 'ASPEND Web - Nota Dinas AI',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        generatedText = data.choices?.[0]?.message?.content || '';
      }
    } catch (err) {
      console.warn('OpenRouter API error in Nota Dinas:', err);
    }

    // 2. Fallback Groq jika OpenRouter gagal
    if (!generatedText && process.env.GROQ_API_KEY) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          generatedText = data.choices?.[0]?.message?.content || '';
        }
      } catch (err) {
        console.warn('Groq API error in Nota Dinas:', err);
      }
    }

    if (!generatedText) {
      throw new Error('Gagal menyusun narasi dengan AI. Silakan periksa koneksi internet atau isi narasi secara manual.');
    }

    // Pembersihan teks dari markdown bold/italic agar siap cetak
    let cleanText = generatedText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_{2}(.*?)_{2}/g, '$1')
      .replace(/_{1}(.*?)_{1}/g, '$1')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .trim();

    return NextResponse.json({
      success: true,
      text: cleanText,
    });
  } catch (error: any) {
    console.error('Error /api/nota-dinas/ai:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
