'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface KpmMapMarker {
  kpmId?: string;
  nik?: string;
  noKK: string;
  namaPengurus: string;
  kelompok?: string;
  alamat?: string;
  statusData?: string;
  statusKepesertaan?: string;
  fotoRumah?: string;
  lat: number;
  lng: number;
}

interface KpmLeafletMapProps {
  markers: KpmMapMarker[];
  selectedMarker: KpmMapMarker | null;
  onSelectMarker: (marker: KpmMapMarker) => void;
}

function createCustomPinIcon(L: any, m: KpmMapMarker, isSelected: boolean) {
  const isGrad =
    m.statusKepesertaan === 'Graduasi' ||
    m.statusKepesertaan === 'Tidak Aktif';

  const pinColor = isGrad ? '#9333ea' : '#0891b2';
  const strokeColor = isSelected ? '#ef4444' : '#ffffff';
  const size = isSelected ? 38 : 28;
  const shadow = isSelected
    ? 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.95))'
    : 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))';

  return L.divIcon({
    className: 'kpm-custom-pin',
    html: `
      <div style="transform: translate(-50%, -100%); filter: ${shadow}; cursor: pointer; transition: all 0.2s ease;">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${pinColor}" stroke="${strokeColor}" stroke-width="${isSelected ? 3 : 1.5}"/>
          <circle cx="12" cy="9" r="3.5" fill="#ffffff"/>
          <circle cx="12" cy="9" r="2" fill="${pinColor}"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createPopupContent(m: KpmMapMarker) {
  const isGrad =
    m.statusKepesertaan === 'Graduasi' ||
    m.statusKepesertaan === 'Tidak Aktif';

  const photoSrc = m.fotoRumah
    ? (m.fotoRumah.startsWith('http') ? m.fotoRumah : `/api/image-proxy?id=${m.fotoRumah}`)
    : '';

  const photoHtml = photoSrc
    ? `<div style="width: 100%; height: 115px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #e2e8f0; position: relative; border: 1px solid #cbd5e1;">
         <img src="${photoSrc}" alt="Foto Rumah" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none';" />
       </div>`
    : `<div style="width: 100%; height: 50px; border-radius: 8px; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 8px; color: #64748b; font-size: 11px;">
         <span>🏠 Foto Rumah Belum Tersedia</span>
       </div>`;

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 210px; max-width: 250px; padding: 2px;">
      ${photoHtml}
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.2;">
          ${m.namaPengurus}
        </div>
        <span style="font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; background: ${isGrad ? '#f3e8ff' : '#d1fae5'}; color: ${isGrad ? '#7e22ce' : '#047857'}; border: 1px solid ${isGrad ? '#e9d5ff' : '#a7f3d0'}; white-space: nowrap;">
          ${isGrad ? 'Graduasi' : 'Aktif'}
        </span>
      </div>
      <div style="font-size: 11px; font-weight: 600; color: #0891b2; margin-bottom: 3px;">
        Kelompok: ${m.kelompok || '—'}
      </div>
      <div style="font-size: 10px; color: #475569; margin-bottom: 7px; line-height: 1.35;">
        ${m.alamat || '—'}
      </div>
      <div style="padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; font-size: 10px;">
        <span style="font-family: monospace; color: #64748b; font-size: 9px;">
          ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}
        </span>
        <a href="https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 2px;">
          Google Maps ↗
        </a>
      </div>
    </div>
  `;
}

export default function KpmLeafletMap({
  markers,
  selectedMarker,
  onSelectMarker,
}: KpmLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerObjectsRef = useRef<Map<string, { marker: any; data: KpmMapMarker }>>(new Map());
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [isMapReady, setIsMapReady] = useState(false);

  // Inisialisasi Peta Leaflet dengan Tile Google Maps Resmi
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      try {
        const L = await import('leaflet');
        leafletRef.current = L;

        if (!isMounted || !mapContainerRef.current) return;

        // Default Pusat: Binjai Barat, Sumatera Utara
        const defaultCenter: [number, number] = [3.6040, 98.4850];

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          zoomControl: false,
        });

        // Pindahkan zoom control ke kanan bawah
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Google Maps Standar (Jalanan / Street Roadmap)
        const streetTiles = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          {
            attribution: '&copy; Google Maps',
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          }
        ).addTo(map);

        // Google Maps Satelit Hybrid (Citra Satelit + Nama Jalan & Tempat)
        const satTiles = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          {
            attribution: '&copy; Google Maps',
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          }
        );

        mapInstanceRef.current = {
          map,
          streetTiles,
          satTiles,
        };

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;

        setIsMapReady(true);
      } catch (err) {
        console.error('Error initializing Leaflet map:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Ganti Layer Jalanan vs Satelit
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const { map, streetTiles, satTiles } = mapInstanceRef.current;

    if (mapType === 'satellite') {
      if (map.hasLayer(streetTiles)) map.removeLayer(streetTiles);
      if (!map.hasLayer(satTiles)) satTiles.addTo(map);
    } else {
      if (map.hasLayer(satTiles)) map.removeLayer(satTiles);
      if (!map.hasLayer(streetTiles)) streetTiles.addTo(map);
    }
  }, [mapType, isMapReady]);

  // Render Markers
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current?.map || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapInstanceRef.current.map;
    const layer = markersLayerRef.current;

    layer.clearLayers();
    markerObjectsRef.current.clear();

    if (markers.length === 0) return;

    const boundsPoints: [number, number][] = [];

    markers.forEach((m) => {
      const isSelected = Boolean(
        selectedMarker &&
          (selectedMarker.noKK === m.noKK ||
            (m.kpmId && selectedMarker.kpmId === m.kpmId))
      );

      const customIcon = createCustomPinIcon(L, m, isSelected);
      const marker = L.marker([m.lat, m.lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 0,
      });

      const popupContent = createPopupContent(m);
      const size = isSelected ? 38 : 28;
      marker.bindPopup(popupContent, { offset: [0, -size + 4] });

      marker.on('click', () => {
        onSelectMarker(m);
      });

      marker.addTo(layer);

      const markerKey = m.kpmId || m.noKK;
      markerObjectsRef.current.set(markerKey, { marker, data: m });

      // Kumpulkan titik valid di wilayah Sumatera Utara
      if (m.lat >= 1.0 && m.lat <= 5.0 && m.lng >= 96.0 && m.lng <= 101.0) {
        boundsPoints.push([m.lat, m.lng]);
      }
    });

    // Sesuaikan zoom dan batas awal agar mencakup seluruh titik cluster KPM
    if (boundsPoints.length > 0 && !selectedMarker) {
      const binjaiCluster = boundsPoints.filter(
        ([lat, lng]) => lat >= 3.4 && lat <= 3.8 && lng >= 98.3 && lng <= 98.7
      );
      const pointsToFit = binjaiCluster.length > 0 ? binjaiCluster : boundsPoints;
      const bounds = L.latLngBounds(pointsToFit);
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    }
  }, [markers, isMapReady]);

  // Tangani Interaksi ketika selectedMarker Berubah (Update Pin, Fly to marker & Buka Popup)
  useEffect(() => {
    if (!leafletRef.current) return;
    const L = leafletRef.current;

    // Update styling semua marker untuk sorot pin terpilih
    markerObjectsRef.current.forEach(({ marker, data }) => {
      const isSelected = Boolean(
        selectedMarker &&
          (selectedMarker.noKK === data.noKK ||
            (data.kpmId && selectedMarker.kpmId === data.kpmId))
      );
      marker.setIcon(createCustomPinIcon(L, data, isSelected));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });

    if (selectedMarker && mapInstanceRef.current?.map) {
      const map = mapInstanceRef.current.map;
      const markerKey = selectedMarker.kpmId || selectedMarker.noKK;
      const entry = markerObjectsRef.current.get(markerKey);

      map.flyTo([selectedMarker.lat, selectedMarker.lng], 16, {
        animate: true,
        duration: 1.0,
      });

      if (entry?.marker) {
        setTimeout(() => {
          entry.marker.openPopup();
        }, 400);
      }
    }
  }, [selectedMarker]);

  // Fungsi untuk kembali ke view keseluruhan
  const handleResetView = () => {
    if (!mapInstanceRef.current?.map || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapInstanceRef.current.map;

    const validPoints = markers
      .filter((m) => m.lat >= 3.4 && m.lat <= 3.8 && m.lng >= 98.3 && m.lng <= 98.7)
      .map((m) => [m.lat, m.lng] as [number, number]);

    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints);
      map.flyToBounds(bounds, { padding: [35, 35], duration: 1 });
    } else {
      map.flyTo([3.6040, 98.4850], 13, { duration: 1 });
    }
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {/* Container Peta Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-100" />

      {/* Floating Map Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs p-1 rounded-xl shadow-md border border-gray-200">
        <button
          type="button"
          onClick={() => setMapType('streets')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            mapType === 'streets'
              ? 'bg-cyan-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Tampilan Peta Jalan Google Maps"
        >
          Jalan
        </button>
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            mapType === 'satellite'
              ? 'bg-cyan-600 text-white shadow-2xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Tampilan Citra Satelit Google Maps"
        >
          Satelit
        </button>
        <div className="h-4 w-px bg-gray-200 mx-0.5" />
        <button
          type="button"
          onClick={handleResetView}
          className="p-1 text-gray-600 hover:text-cyan-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          title="Pusatkan Seluruh Titik KPM"
        >
          <span className="material-symbols-outlined text-[17px] block">crop_free</span>
        </button>
      </div>

      {/* Badge Legenda & Counter Titik */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl shadow-md border border-gray-200 text-[11px]">
        <div className="flex items-center gap-1 font-semibold text-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0891b2] border border-white shadow-xs"></span>
          <span>Aktif</span>
        </div>
        <div className="flex items-center gap-1 font-semibold text-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 border border-white shadow-xs"></span>
          <span>Graduasi</span>
        </div>
        <div className="h-3 w-px bg-gray-200" />
        <span className="font-bold text-cyan-900 font-mono">
          {markers.length} Titik
        </span>
      </div>
    </div>
  );
}
