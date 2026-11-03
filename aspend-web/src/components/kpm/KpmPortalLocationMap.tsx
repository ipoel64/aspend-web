'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

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
  const [isInternalLocating, setIsInternalLocating] = useState(false);

  // Alamat terdeteksi dari koordinat
  const [detectedAddress, setDetectedAddress] = useState<string>('');
  const [detectedRoad, setDetectedRoad] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Parse koordinat
  const numLat = parseFloat(latitude);
  const numLng = parseFloat(longitude);
  const hasValidCoords = !isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0;

  // Custom Icon untuk Pin Lokasi Rumah KPM
  const createHousePinIcon = (L: any) => {
    return L.divIcon({
      className: 'kpm-portal-pin',
      html: `
        <div style="transform: translate(-50%, -100%); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5)); cursor: grab; transition: transform 0.15s ease;">
          <div style="position: relative; width: 42px; height: 50px;">
            <svg width="42" height="50" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  // Ambil Alamat (Reverse Geocoding)
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

    try {
      setIsLoadingAddress(true);
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setDetectedAddress(data.address || '');
        setDetectedRoad(data.road || '');
      }
    } catch (err) {
      console.warn('Gagal memuat alamat:', err);
    } finally {
      setIsLoadingAddress(false);
    }
  }, []);

  // Handler Mandiri Ambil Lokasi GPS (High Accuracy dengan Fallback Instan)
  const handleInternalGetLocation = () => {
    if (onGetLocation) {
      onGetLocation();
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Browser Anda tidak mendukung deteksi lokasi GPS.');
      return;
    }

    setIsInternalLocating(true);

    const onLocationSuccess = (pos: GeolocationPosition) => {
      const latStr = pos.coords.latitude.toFixed(6);
      const lngStr = pos.coords.longitude.toFixed(6);
      setIsInternalLocating(false);
      onChange(latStr, lngStr);

      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.invalidateSize();
        mapInstanceRef.current.map.flyTo([pos.coords.latitude, pos.coords.longitude], 18, {
          duration: 1.2,
        });
      }
      fetchAddress(pos.coords.latitude, pos.coords.longitude);
    };

    // Tahap 1: Coba GPS Akurat (maks 6 detik)
    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      (err) => {
        console.warn('GPS akurasi tinggi lambat/gagal, beralih ke jaringan:', err.message);
        // Tahap 2: Fallback ke Lokasi Jaringan (WiFi / BTS - instan dan berfungsi di dalam rumah)
        navigator.geolocation.getCurrentPosition(
          onLocationSuccess,
          (fallbackErr) => {
            setIsInternalLocating(false);
            alert(
              `Gagal mendeteksi lokasi GPS: ${fallbackErr.message || err.message}. Pastikan GPS dan izin lokasi browser telah diaktifkan.`
            );
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
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
          zoom: hasValidCoords ? 18 : 13,
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
            map.panTo(pos, { animate: true });
            fetchAddress(pos.lat, pos.lng);
          });

          markerRef.current = marker;
          fetchAddress(numLat, numLng);
        }

        // Klik pada peta untuk memindahkan / membuat marker
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          onChange(lat.toFixed(6), lng.toFixed(6));
          map.panTo([lat, lng], { animate: true });
          fetchAddress(lat, lng);
        });

        // Pastikan ukuran Leaflet pas setelah ter-render
        setTimeout(() => {
          if (isMounted && map) {
            map.invalidateSize();
          }
        }, 300);

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

    map.invalidateSize();

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
          map.panTo(pos, { animate: true });
          fetchAddress(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      }

      // Selalu pusatkan peta ke titik koordinat
      const currentCenter = map.getCenter();
      const dist = map.distance(currentCenter, [numLat, numLng]);
      if (dist > 5 || map.getZoom() < 17) {
        map.setView([numLat, numLng], Math.max(map.getZoom(), 18), { animate: true });
      }

      // Ambil alamat jika belum pernah diambil untuk koordinat ini
      fetchAddress(numLat, numLng);
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      setDetectedAddress('');
      setDetectedRoad('');
    }
  }, [numLat, numLng, hasValidCoords, isMapReady, fetchAddress]);

  const locating = isGettingLocation || isInternalLocating;

  return (
    <div className="w-full space-y-3 mt-2">
      {/* Kontrol Atas Peta */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs shadow-2xs">
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

        {/* Tombol Ambil Lokasi Saya yang Menonjol & Responsif */}
        <button
          type="button"
          onClick={handleInternalGetLocation}
          disabled={locating}
          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          {locating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Mendeteksi Lokasi GPS...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">my_location</span>
              <span>Ambil Lokasi Saya</span>
            </>
          )}
        </button>
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
              <span>
                {numLat.toFixed(6)}, {numLng.toFixed(6)}
              </span>
            ) : (
              <span className="text-amber-700 italic">Belum ditentukan</span>
            )}
          </div>
        </div>
      </div>

      {/* Kotak Informasi Alamat & Jalan Terdeteksi */}
      <div className="bg-gradient-to-r from-cyan-50/90 via-teal-50/70 to-emerald-50/80 border border-cyan-200/90 rounded-2xl p-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <span className="material-symbols-outlined text-lg">location_on</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-cyan-950 uppercase tracking-wider flex items-center gap-1">
                <span>Alamat & Lokasi Jalan Terdeteksi</span>
                {isLoadingAddress && (
                  <span className="text-[10px] text-cyan-700 font-normal lowercase animate-pulse">
                    (mencari alamat...)
                  </span>
                )}
              </span>
              {hasValidCoords && (
                <a
                  href={`https://www.google.com/maps?q=${numLat},${numLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-cyan-700 hover:text-cyan-900 font-bold flex items-center gap-0.5 hover:underline"
                  title="Lihat titik ini di Google Maps"
                >
                  <span>Buka di Google Maps</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              )}
            </div>

            {isLoadingAddress ? (
              <div className="flex items-center gap-2 mt-1.5 text-xs text-cyan-700 font-medium">
                <div className="w-3.5 h-3.5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Mendeteksi nama jalan dan wilayah dari titik koordinat...</span>
              </div>
            ) : detectedAddress ? (
              <div className="mt-1 space-y-1">
                {detectedRoad && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-200/70 text-cyan-900 text-[10.5px]">
                      Jalan / Gang
                    </span>
                    <span className="text-cyan-950 font-semibold">{detectedRoad}</span>
                  </div>
                )}
                <p className="text-xs text-gray-700 leading-snug">
                  {detectedAddress}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1 italic">
                {hasValidCoords
                  ? 'Sedang mengidentifikasi alamat wilayah...'
                  : 'Geser pin merah atau tekan tombol "Ambil Lokasi Saya" di atas untuk mengetahui nama jalan dan wilayah rumah Anda.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
