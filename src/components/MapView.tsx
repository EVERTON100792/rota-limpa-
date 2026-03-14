import React, { useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'polyline-encoded';
import 'leaflet/dist/leaflet.css';
import { Stop, RouteData } from '../types';
import { Map as MapIcon, Navigation, Home } from 'lucide-react';
import { getGoogleMapsUrl } from '../services/utils';

// Custom Numbered Icon
const createNumberedIcon = (number: number | 'base', isFirst: boolean, isLast: boolean) => {
  const isBase = number === 'base';
  const color = isBase ? '#6366f1' : isFirst ? '#3b82f6' : isLast ? '#ef4444' : '#10b981';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">
        ${isBase ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' : number}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};
// Custom Toll Icon
const createTollIcon = (direction: 'ida' | 'volta' | 'ambos' = 'ida') => {
  const isRoundTrip = direction === 'ambos';
  const isVolta = direction === 'volta';
  const color1 = direction === 'ida' ? '#10b981' : direction === 'volta' ? '#ef4444' : '#3b82f6'; // Emerald, Red, Blue
  const color2 = direction === 'ida' ? '#059669' : direction === 'volta' ? '#b91c1c' : '#2563eb';
  const shadowColor = direction === 'ida' ? 'rgba(16,185,129,0.5)' : direction === 'volta' ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.5)';

  return L.divIcon({
    className: 'custom-toll-icon bg-transparent border-none',
    html: `
      <div style="position: relative; width: 48px; height: 56px; display: flex; align-items: flex-start; justify-content: center; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));">
        <!-- Pulse animation for better visibility -->
        <div class="pulse-animation" style="position: absolute; top: 1px; width: 40px; height: 40px; background: ${shadowColor}; border-radius: 50%; animation: pulse 2s infinite;"></div>
        
        <!-- Main Circular Body -->
        <div style="position: relative; z-index: 10; width: 40px; height: 40px; background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%); border-radius: 50%; border: 2.5px solid white; box-shadow: inset 0 2px 4px rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; color: white;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0;">
            ${direction === 'ambos' ? `
              <div style="display: flex; gap: 2px; margin-bottom: -1px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m17 11-5-5-5 5M12 18V6"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m7 13 5 5 5-5M12 6v12"/>
                </svg>
              </div>
            ` : direction === 'ida' ? `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
                <path d="m17 11-5-5-5 5M12 18V6"/>
              </svg>
            ` : `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
                <path d="m7 13 5 5 5-5M12 6v12"/>
              </svg>
            `}
          </div>
        </div>
        
        <!-- Triangle Pointer -->
        <div style="position: absolute; top: 38px; z-index: 5; width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 14px solid ${color2};"></div>

        <style>
          @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            70% { transform: scale(1.3); opacity: 0; }
            100% { transform: scale(0.95); opacity: 0; }
          }
        </style>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56]
  });
};

const tollIconCache = new Map<string, L.DivIcon>();
const getTollIcon = (direction: 'ida' | 'volta' | 'ambos'): L.DivIcon => {
  const key = `toll-${direction}`;
  let icon = tollIconCache.get(key);
  if (!icon) {
    icon = createTollIcon(direction);
    tollIconCache.set(key, icon);
  }
  return icon;
};

// Cache to prevent recreating identical icons on every render, which causes severe map freezing
const numberedIconCache = new Map<string, L.DivIcon>();
const getNumberedIcon = (number: number | 'base', isFirst: boolean, isLast: boolean): L.DivIcon => {
  const key = `${number}-${isFirst}-${isLast}`;
  let icon = numberedIconCache.get(key);
  if (!icon) {
    icon = createNumberedIcon(number, isFirst, isLast);
    numberedIconCache.set(key, icon);
  }
  return icon;
};

interface MapViewProps {
  stops: Stop[];
  baseStop: Stop | null;
  routeData: RouteData | null;
  isRoundTrip: boolean;
  activeTab?: string;
}

// Component to auto-fit bounds when stops change
function ChangeView({ stops, baseStop, activeTab, routeData }: { stops: Stop[], baseStop: Stop | null, activeTab?: string, routeData: RouteData | null }) {
  const map = useMap();

  useEffect(() => {
    // Fix for map rendering issues when container size changes (e.g. tabs)
    // We need a small delay to let the DOM update before invalidating size
    const timeout = setTimeout(() => {
      map.invalidateSize();

      let pointsToFit: [number, number][] = [];

      if (baseStop) pointsToFit.push([baseStop.lat, baseStop.lng]);

      stops.forEach(s => pointsToFit.push([s.lat, s.lng]));

      if (routeData?.tolls) {
        routeData.tolls.forEach(toll => {
          pointsToFit.push([toll.lat, toll.lng]);
        });
      }

      if (pointsToFit.length > 0) {
        const bounds = L.latLngBounds(pointsToFit);
        // Only fit if bounds have changed significantly or it's a new route
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [
    map,
    activeTab,
    baseStop?.lat,
    baseStop?.lng,
    stops.length,
    // We only want to refit if route data changes significantly
    routeData?.geometry?.length,
    routeData?.tollCount
  ]);

  return null;
}

const MapViewComponent: React.FC<MapViewProps> = ({ stops, baseStop, routeData, isRoundTrip, activeTab }) => {
  // OSRM returns polyline (precision 5)
  const polylinePoints = useMemo(() => {
    if (!routeData?.geometry) return [];
    try {
      // @ts-ignore - fromEncoded is added by polyline-encoded side effect
      const poly = (L.Polyline as any).fromEncoded(routeData.geometry);
      return poly.getLatLngs();
    } catch (error) {
      console.error('Error decoding polyline:', error);
      return [];
    }
  }, [routeData?.geometry]);

  // Memoize unpaved segments paths to avoid expensive recalculation on every render
  const unpavedPositions = useMemo(() => {
    if (!routeData?.unpavedSegments) return [];
    return routeData.unpavedSegments.map(seg => seg.coordinates);
  }, [routeData?.unpavedSegments]);

  const totalUnpavedDistance = useMemo(() => {
    if (!routeData?.unpavedSegments) return 0;
    return routeData.unpavedSegments.reduce((sum, seg) => sum + seg.distance, 0);
  }, [routeData?.unpavedSegments]);

  const handleOpenMaps = () => {
    const url = getGoogleMapsUrl(stops, isRoundTrip, baseStop);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-23.5505, -46.6333]} // São Paulo default
        zoom={13}
        scrollWheelZoom={true}
        preferCanvas={true}
        bounceAtZoomLimits={false}
        inertia={true}
        inertiaResistance={3000}
        updateWhenZooming={false}
        className="z-0 h-full w-full"
        style={{ height: '100%', width: '100%' }} // Explicitly set height and width
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ChangeView stops={stops} baseStop={baseStop} activeTab={activeTab} routeData={routeData} />

        {/* Base Marker */}
        {baseStop && (
          <Marker
            position={[baseStop.lat, baseStop.lng]}
            icon={getNumberedIcon('base', false, false)}
          >
            <Popup>
              <div className="text-zinc-900 font-sans p-1 min-w-[150px]">
                <p className="font-bold text-sm border-b border-zinc-100 pb-1 mb-1">Base / Ponto de Partida</p>
                <p className="text-xs text-zinc-600 leading-tight">{baseStop.address}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Delivery Markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={getNumberedIcon(index + 1, index === 0, index === stops.length - 1)}
          >
            <Popup>
              <div className="text-zinc-900 font-sans p-1 min-w-[150px]">
                <p className="font-bold text-sm border-b border-zinc-100 pb-1 mb-1">Entrega {index + 1}</p>
                <p className="text-xs text-zinc-600 leading-tight">{stop.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Toll Markers (Custom DivIcon for Premium look) */}
        {routeData?.tolls?.map((toll, index) => (
          <Marker
            key={`toll-${index}`}
            position={[toll.lat, toll.lng]}
            icon={getTollIcon(toll.direction || 'ida')}
          >
            <Popup>
              <div className="text-zinc-900 font-sans p-1 min-w-[150px]">
                <p className="font-bold text-sm border-b border-zinc-100 pb-1 mb-1 text-amber-600 flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  Pedágio
                </p>
                <p className="text-xs text-zinc-600 font-medium mb-1">{toll.name}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {routeData && polylinePoints.length > 0 && (
          <Polyline
            key={routeData.geometry} // Force re-render when geometry changes
            positions={polylinePoints as any}
            pathOptions={{
              color: '#3b82f6',
              weight: 6,
              opacity: 0.8,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
        )}

        {/* Unpaved Segments MultiPolyline (Rendered as a single layer instead of multiple for MASSIVE performance boost) */}
        {routeData && unpavedPositions.length > 0 && (
          <Polyline
            key={`unpaved-multi-${routeData.geometry}`}
            positions={unpavedPositions as any}
            pathOptions={{
              color: '#f97316',
              weight: 8,
              opacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round',
              dashArray: '5, 10'
            }}
          >
            <Popup>
              <div className="text-zinc-900 font-sans p-1">
                <p className="font-bold text-xs text-orange-600">Trechos de Terra</p>
                <p className="text-[10px] text-zinc-500">
                  Total de {totalUnpavedDistance.toFixed(0)} metros divididos em {unpavedPositions.length} partes.
                </p>
              </div>
            </Popup>
          </Polyline>
        )}
      </MapContainer>

      {/* Floating Action Button for Google Maps */}
      {stops.length >= 2 && (
        <button
          onClick={handleOpenMaps}
          className="absolute bottom-20 md:bottom-6 right-6 z-[1000] bg-brand-blue hover:bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-2 font-bold transition-all hover:scale-105 active:scale-95"
          title="Abrir no Google Maps"
        >
          <Navigation className="w-5 h-5" />
          <span className="hidden sm:inline">Navegar no Maps</span>
        </button>
      )}
    </div>
  );
};

export const MapView = memo(MapViewComponent);


