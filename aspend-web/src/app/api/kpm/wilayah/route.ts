import { NextResponse } from 'next/server';

// In-memory cache untuk performa tinggi & hemat bandwidth
const cache: Record<string, { timestamp: number; data: any[] }> = {};
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 jam

const BASE_URL = 'https://emsifa.github.io/api-wilayah-indonesia/api';

// Fallback data standar (Sumatera Utara / Binjai / Langkat / Medan) jika offline atau rate-limit
const DEFAULT_PROVINCES = [
  { id: '11', name: 'ACEH' },
  { id: '12', name: 'SUMATERA UTARA' },
  { id: '13', name: 'SUMATERA BARAT' },
  { id: '14', name: 'RIAU' },
  { id: '15', name: 'JAMBI' },
  { id: '16', name: 'SUMATERA SELATAN' },
  { id: '17', name: 'BENGKULU' },
  { id: '18', name: 'LAMPUNG' },
  { id: '31', name: 'DKI JAKARTA' },
  { id: '32', name: 'JAWA BARAT' },
  { id: '33', name: 'JAWA TENGAH' },
  { id: '34', name: 'DI YOGYAKARTA' },
  { id: '35', name: 'JAWA TIMUR' },
  { id: '36', name: 'BANTEN' },
  { id: '51', name: 'BALI' },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'provinces';
    const provinceId = searchParams.get('provinceId');
    const regencyId = searchParams.get('regencyId');
    const districtId = searchParams.get('districtId');

    let targetUrl = '';
    let cacheKey = '';

    if (level === 'provinces') {
      targetUrl = `${BASE_URL}/provinces.json`;
      cacheKey = 'provinces';
    } else if (level === 'regencies' && provinceId) {
      targetUrl = `${BASE_URL}/regencies/${provinceId}.json`;
      cacheKey = `regencies_${provinceId}`;
    } else if (level === 'districts' && regencyId) {
      targetUrl = `${BASE_URL}/districts/${regencyId}.json`;
      cacheKey = `districts_${regencyId}`;
    } else if (level === 'villages' && districtId) {
      targetUrl = `${BASE_URL}/villages/${districtId}.json`;
      cacheKey = `villages_${districtId}`;
    } else {
      return NextResponse.json({ error: 'Parameter level atau ID tidak lengkap' }, { status: 400 });
    }

    const now = Date.now();
    if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ data: cache[cacheKey].data });
    }

    try {
      const response = await fetch(targetUrl, {
        next: { revalidate: 86400 },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      cache[cacheKey] = { timestamp: now, data };
      return NextResponse.json({ data });
    } catch (fetchError) {
      console.warn(`Gagal fetch wilayah dari remote (${targetUrl}), gunakan fallback:`, fetchError);
      if (level === 'provinces') {
        return NextResponse.json({ data: DEFAULT_PROVINCES });
      }
      return NextResponse.json({ data: [] });
    }
  } catch (error) {
    console.error('Wilayah API error:', error);
    return NextResponse.json({ error: 'Gagal memproses data wilayah' }, { status: 500 });
  }
}
