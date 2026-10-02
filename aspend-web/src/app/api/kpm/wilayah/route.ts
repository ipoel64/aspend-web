import { NextResponse } from 'next/server';
import { capitalizeEachWord } from '@/lib/format-utils';

// In-memory cache untuk performa tinggi & hemat bandwidth
const cache: Record<string, { timestamp: number; data: any[] }> = {};
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 jam

const BASE_URL = 'https://emsifa.github.io/api-wilayah-indonesia/api';

// Fallback data standar (Sumatera Utara / Binjai / Langkat / Medan) jika offline atau rate-limit
const DEFAULT_PROVINCES = [
  { id: '11', name: 'Aceh' },
  { id: '12', name: 'Sumatera Utara' },
  { id: '13', name: 'Sumatera Barat' },
  { id: '14', name: 'Riau' },
  { id: '15', name: 'Jambi' },
  { id: '16', name: 'Sumatera Selatan' },
  { id: '17', name: 'Bengkulu' },
  { id: '18', name: 'Lampung' },
  { id: '31', name: 'DKI Jakarta' },
  { id: '32', name: 'Jawa Barat' },
  { id: '33', name: 'Jawa Tengah' },
  { id: '34', name: 'DI Yogyakarta' },
  { id: '35', name: 'Jawa Timur' },
  { id: '36', name: 'Banten' },
  { id: '51', name: 'Bali' },
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
      const rawData = await response.json();
      const data = Array.isArray(rawData)
        ? rawData.map(item => ({
            ...item,
            name: capitalizeEachWord(item.name)
          }))
        : rawData;
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
