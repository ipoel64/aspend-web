import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Parameter lat dan lng wajib diisi' }, { status: 400 });
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return NextResponse.json({ error: 'Format koordinat tidak valid' }, { status: 400 });
    }

    let address = '';
    let road = '';
    let village = '';
    let district = '';
    let city = '';

    // 1. Coba Nominatim OpenStreetMap
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLng}&addressdetails=1&zoom=18`;
      const res = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'AspendWeb-App/1.0 (https://aspend-web.vercel.app)',
          'Accept-Language': 'id',
        },
        next: { revalidate: 3600 },
      });

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        road = addr.road || addr.residential || addr.street || addr.pedestrian || addr.path || addr.footway || '';
        village = addr.village || addr.suburb || addr.neighbourhood || addr.quarter || addr.hamlet || '';
        district = addr.city_district || addr.county || addr.district || '';
        city = addr.city || addr.town || addr.municipality || '';
        const state = addr.state || '';

        const parts = [road, village, district, city, state].filter(Boolean);
        if (parts.length > 0) {
          address = parts.join(', ');
        } else if (data.display_name) {
          address = data.display_name;
        }
      }
    } catch (nominatimErr) {
      console.warn('Nominatim reverse geocode error:', nominatimErr);
    }

    // 2. Fallback ke BigDataCloud jika Nominatim kosong / gagal
    if (!address) {
      try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${numLat}&longitude=${numLng}&localityLanguage=id`;
        const res = await fetch(bdcUrl, { next: { revalidate: 3600 } });
        if (res.ok) {
          const bdc = await res.json();
          district = bdc.locality || '';
          city = bdc.city || '';
          const state = bdc.principalSubdivision || '';
          const parts = [district, city, state].filter(Boolean);
          address = parts.join(', ');
        }
      } catch (bdcErr) {
        console.warn('BigDataCloud reverse geocode error:', bdcErr);
      }
    }

    return NextResponse.json({
      address: address || `${numLat.toFixed(6)}, ${numLng.toFixed(6)}`,
      road,
      village,
      district,
      city,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
