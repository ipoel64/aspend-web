'use client';

import React, { useEffect, useRef, useState } from 'react';

interface KpmPortalLocationMapProps {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
  onGetLocation?: () => void;
  isGettingLocation?: boolean;
}

export default function KpmPortalLocationMap({
  latitude,
  longitude,
  onChange,
  onGetLocation,
  isGettingLocation = false,
}: KpmPortalLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [isMapReady, setIsMapReady] = useState(false);

  // Parse koordinat
  const numLat = parseFloat(latitude);
  const numLng = parseFloat(longitude);
  const hasValidCoords = !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0;

  // Custom Icon untuk Pin Lokasi Rumah KPM
  const createHousePinIcon = (L: any) => {
    return L.divIcon({
      className: 'kpm-portal-pin',
      html: `
        <div style="transform: translate(-50%, -100%); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45)); cursor: grab; transition: transform 0.15s ease;">
          <div style="position: relative; width: 40px; height: 48px;">
            <svg width="40" height="48" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 28 12 28C12 28 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#E11D48"/>
              <circle cx="12" cy="11" r="9" fill="#FFFFFF"/>
              <path d="M12 6.5L7 10.5V15.5H10V13H14V15.5H17V10.5L12 6.5Z" fill="#E11D48"/>
            </svg>
            <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border-radius: 50%; background: #E11D48; border: 2px solid #FFFFFF;"></div>
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      try {
        const L = await import('leaflet');
        leafletRef.current = L;

        if (!isMounted || !mapContainerRef.current) return;

        // Default Pusat Peta
        const initialCenter: [number, number] = hasValidCoords
          ? [numLat, numLng]
          : [3.6040, 98.4850]; // Default Sumut / Binjai

        const map = (L as any).map(mapContainerRef.current, {
          center: initialCenter,
          zoom: hasValidCoords ? 17 : 13,
          zoomControl: false,
          tap: false,
        });

        // Zoom Control di kanan bawah
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Google Maps Street Roadmap
        const streetTiles = L.tileLayer(
          'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          {
            attribution: '&copy; Google Maps',
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          }
        ).addTo(map);

        // Google Maps Satelit Hybrid
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

        // Buat Marker draggable jika sudah ada koordinat
        if (hasValidCoords) {
          const marker = L.marker([numLat, numLng], {
            icon: createHousePinIcon(L),
            draggable: true,
            title: 'Geser pin untuk memindahkan posisi rumah',
          }).addTo(map);

          marker.on('dragend', (e: any) => {
            const pos = e.target.getLatLng();
            onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
          });

          markerRef.current = marker;
        }

        // Klik pada peta untuk memindahkan / membuat marker
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          onChange(lat.toFixed(6), lng.toFixed(6));
        });

        setIsMapReady(true);
      } catch (err) {
        console.error('Error initializing KPM location map:', err);
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

  // Update Pergantian Layer Jalanan vs Satelit
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

  // Sinkronisasi Posisi Marker & View Peta saat Latitude/Longitude berubah
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current?.map || !leafletRef.current) return;
    const L = leafletRef.current;
    const { map } = mapInstanceRef.current;

    if (hasValidCoords) {
      if (markerRef.current) {
        markerRef.current.setLatLng([numLat, numLng]);
      } else {
        const marker = L.marker([numLat, numLng], {
          icon: createHousePinIcon(L),
          draggable: true,
          title: 'Geser pin untuk memindahkan posisi rumah',
        }).addTo(map);

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });

        markerRef.current = marker;
      }

      // Animasi gerak ke titik baru jika jarak cukup jauh
      const currentCenter = map.getCenter();
      const dist = map.distance(currentCenter, [numLat, numLng]);
      if (dist > 30) {
        map.setView([numLat, numLng], Math.max(map.getZoom(), 17), { animate: true });
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [numLat, numLng, hasValidCoords, isMapReady]);

  return (
    <div className="w-full space-y-2 mt-2">
      {/* Kontrol Atas Peta */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
          <button
            type="button"
            onClick={() => setMapType('streets')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapType === 'streets'
                ? 'bg-white text-cyan-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Peta Jalan
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              mapType === 'satellite'
                ? 'bg-white text-cyan-800 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🛰️ Satelit
          </button>
        </div>

        {onGetLocation && (
          <button
            type="button"
            onClick={onGetLocation}
            disabled={isGettingLocation}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isGettingLocation ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Mendeteksi GPS...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">my_location</span>
                <span>Ambil Lokasi Saya</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Frame Peta */}
      <div className="relative w-full h-[270px] sm:h-[320px] rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-inner bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Petunjuk Penggunaan Pin di Atas Peta */}
        <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none flex justify-center">
          <div className="bg-slate-900/85 backdrop-blur-xs text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-1.5 pointer-events-auto">
            <span className="material-symbols-outlined text-rose-400 text-sm animate-bounce">location_on</span>
            <span>Geser pin merah atau ketuk pada peta untuk menentukan posisi rumah Anda</span>
          </div>
        </div>

        {/* Status Koordinat di Bawah Kiri Peta */}
        <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-xs text-gray-800 text-[10.5px] px-2.5 py-1 rounded-xl shadow border border-gray-200 font-mono flex items-center gap-1 pointer-events-auto">
            <span className="font-bold text-cyan-800">Koordinat:</span>
            {hasValidCoords ? (
              <span>{numLat.toFixed(6)}, {numLng.toFixed(6)}</span>
            ) : (
              <span className="text-amber-700 italic">Belum ditentukan</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
