import { Stop } from '../types';

const OSRM_BASE_URLS = [
  'https://routing.openstreetmap.de/routed-car',
  'https://router.project-osrm.org'
];

// Helper to limit promise execution time without freezing the UI
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function decodePolyline(str: string, precision: number = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change; lng += longitude_change;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

function simplifyPolyline(points: number[][], tolerance: number): number[][] {
  if (points.length <= 2) return points;
  const result = [points[0]];
  let lastPoint = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const dist = Math.sqrt(Math.pow(point[0] - lastPoint[0], 2) + Math.pow(point[1] - lastPoint[1], 2));
    if (dist > tolerance) {
      result.push(point);
      lastPoint = point;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// Cache to avoid repeated heavy queries to Overpass
const OVERPASS_CACHE = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

// Track instance health to avoid 429 loops
const OVERPASS_INSTANCE_STATUS = new Map<string, { lastFail: number, failCount: number, isRateLimited?: boolean }>();
const BLACKLIST_TIME = 1000 * 60 * 2; // 2 minutes penalty

// Global Semaphore to ensure only one Overpass request is active at a time
// This prevents 429/504 errors by sequencing requests
class Semaphore {
  private queue: (() => void)[] = [];
  private activeCount = 0;
  private maxActive = 1;

  async acquire() {
    if (this.activeCount < this.maxActive) {
      this.activeCount++;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.activeCount--;
    }
  }
}

const overpassSemaphore = new Semaphore();

function processGroupedTolls(sortedEncounters: any[], returnVertexIndex: number = -1) {
  const groupedTolls: { lat: number; lng: number; name: string; direction: 'ida' | 'volta' | 'ambos'; firstEncounter: number }[] = [];
  
  sortedEncounters.forEach(enc => {
    const direction: 'ida' | 'volta' = (returnVertexIndex !== -1 && enc.progressIndex > returnVertexIndex) ? 'volta' : 'ida';
    
    const existing = groupedTolls.find(t => 
      Math.abs(t.lat - enc.lat) < 0.0001 && Math.abs(t.lng - enc.lng) < 0.0001
    );
    
    if (existing) {
      if (existing.direction !== direction) {
        existing.direction = 'ambos';
      }
    } else {
      groupedTolls.push({
        lat: enc.lat,
        lng: enc.lng,
        name: enc.name,
        direction: direction,
        firstEncounter: enc.progressIndex
      });
    }
  });
  return groupedTolls;
}

async function fetchFromOverpass(query: string, signal?: AbortSignal) {
  // Check cache first
  const cached = OVERPASS_CACHE.get(query);
  if (cached && (now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  await overpassSemaphore.acquire();
  
  try {
    let lastError = null;
    const nowTimestamp = now();

    // Filter out blacklisted instances
    const availableInstances = OVERPASS_INSTANCES.filter(inst => {
      const status = OVERPASS_INSTANCE_STATUS.get(inst);
      if (!status) return true;
      return (nowTimestamp - status.lastFail) > BLACKLIST_TIME;
    });

    const instancesToTry = availableInstances.length > 0 
      ? [...availableInstances].sort(() => Math.random() - 0.5)
      : [...OVERPASS_INSTANCES].sort(() => Math.random() - 0.5);

    let delay = 300; 

    for (let i = 0; i < instancesToTry.length; i++) {
      if (signal?.aborted) {
        const e = new Error('AbortError');
        e.name = 'AbortError';
        throw e;
      }
      const instance = instancesToTry[i];
      const controller = new AbortController();
      
      const onExternalAbort = () => controller.abort();
      if (signal) signal.addEventListener('abort', onExternalAbort);

      // Aumentado para 15s para lidar melhor com rotas longas no Overpass
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; 
        }

        const response = await fetch(instance, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onExternalAbort);

        if (response.ok) {
          const data = await response.json();
          OVERPASS_CACHE.set(query, { data, timestamp: now() });
          OVERPASS_INSTANCE_STATUS.delete(instance);
          return data;
        }

        if (response.status === 429 || response.status >= 500) {
          const isRateLimited = response.status === 429;
          OVERPASS_INSTANCE_STATUS.set(instance, { 
            lastFail: now(), 
            failCount: (OVERPASS_INSTANCE_STATUS.get(instance)?.failCount || 0) + 1,
            isRateLimited
          });
          if (isRateLimited) {
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onExternalAbort);

        lastError = error;
        
        if (signal?.aborted) {
          const e = new Error('AbortError');
          e.name = 'AbortError';
          throw e;
        }

        // Se foi timeout interno (504 ou timeout), apenas registra falha e tenta próximo servidor
        OVERPASS_INSTANCE_STATUS.set(instance, { 
          lastFail: now(), 
          failCount: (OVERPASS_INSTANCE_STATUS.get(instance)?.failCount || 0) + 1,
          isRateLimited: false
        });
      }
    }

    return { elements: [] };
  } finally {
    overpassSemaphore.release();
  }
}

// Utility to keep current timestamp
function now() { return Date.now(); }

async function fetchTollsFromOverpass(geometry: string, signal?: AbortSignal) {
  try {
    const coords = decodePolyline(geometry);
    if (coords.length === 0) return [];

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    coords.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    // Buffer de ~5km para garantir que pegamos pedágios próximos
    minLat -= 0.05; maxLat += 0.05;
    minLng -= 0.05; maxLng += 0.05;

    const area = (maxLat - minLat) * (maxLng - minLng);
    let query = '';
    
    // Se a área for muito grande (rota longa), usamos o 'around' na linha simplificada
    if (area > 50) {
      const simplified = simplifyPolyline(coords, 0.05); 
      const polyStr = simplified.map(p => `${p[0]},${p[1]}`).join(' ');

      query = `
        [out:json][timeout:25];
        (
          node["barrier"="toll_booth"](around:5000,${polyStr});
          way["barrier"="toll_booth"](around:5000,${polyStr});
        );
        out center;
      `;
    } else {
      query = `
        [out:json][timeout:15];
        (
          node["barrier"="toll_booth"](${minLat},${minLng},${maxLat},${maxLng});
          way["barrier"="toll_booth"](${minLat},${minLng},${maxLat},${maxLng});
        );
        out center;
      `;
    }

    const data = await fetchFromOverpass(query, signal);
    if (!data || !data.elements) return [];
    
    return data.elements.map((e: any) => ({
      lat: e.lat || e.center?.lat,
      lng: e.lon || e.center?.lon,
      name: e.tags?.name || 'Pedágio'
    })).filter((e: any) => e.lat && e.lng);
  } catch (error) {
    if ((error as any).name === 'AbortError' || (error as any).message === 'AbortError') throw error;
    console.warn('Fallback: Error fetching tolls from Overpass:', error);
    return [];
  }
}

async function fetchUnpavedFromOverpass(geometry: string, signal?: AbortSignal) {
  try {
    const coords = decodePolyline(geometry);
    if (coords.length === 0) return { segments: [], totalDistance: 0 };

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    coords.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    minLat -= 0.05; maxLat += 0.05;
    minLng -= 0.05; maxLng += 0.05;

    let query = `
      [out:json][timeout:15];
      (
        way["highway"~"track|unclassified|path"]["surface"~"unpaved|dirt|earth|ground|gravel|sand|clay|fine_gravel|wood|grass|mud"](${minLat},${minLng},${maxLat},${maxLng});
        way["highway"="track"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
      >;
      out skel qt;
    `;

    const data = await fetchFromOverpass(query, signal);
    if (!data || !data.elements) return { segments: [], totalDistance: 0 };

    const nodesMap: Record<number, [number, number]> = {};
    data.elements.forEach((e: any) => {
      if (e.type === 'node') {
        nodesMap[e.id] = [e.lat, e.lon];
      }
    });

    const unpavedWays = data.elements
      .filter((e: any) => e.type === 'way')
      .map((w: any) => ({
        nodes: w.nodes.map((nodeId: number) => nodesMap[nodeId]).filter(Boolean),
        bbox: calculateBBox(w.nodes.map((nodeId: number) => nodesMap[nodeId]).filter(Boolean))
      }));

    const THRESHOLD = 0.000005; // approx 250m^2
    const unpavedSegments: { coordinates: [number, number][]; distance: number }[] = [];
    let totalUnpavedDistance = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      if (signal?.aborted) throw new Error('AbortError');
      if (i % 200 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const v = coords[i];
      const w = coords[i + 1];
      const segBBox = calculateBBox([v, w]);
      const p = [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2];

      let isUnpaved = false;
      for (const way of unpavedWays) {
        if (!bboxesIntersect(segBBox, way.bbox, 0.01)) continue;

        for (let j = 0; j < way.nodes.length - 1; j++) {
          const wv = way.nodes[j];
          const ww = way.nodes[j + 1];

          const cosLat = Math.cos(p[0] * Math.PI / 180);
          const dx = (ww[1] - wv[1]) * cosLat;
          const dy = ww[0] - wv[0];
          const l2 = dx * dx + dy * dy;

          const px = (p[1] - wv[1]) * cosLat;
          const py = p[0] - wv[0];

          let dist2 = 0;
          if (l2 === 0) {
            dist2 = px * px + py * py;
          } else {
            let t = Math.max(0, Math.min(1, (px * dx + py * dy) / l2));
            dist2 = Math.pow(px - (t * dx), 2) + Math.pow(py - (t * dy), 2);
          }

          if (dist2 < THRESHOLD) {
            isUnpaved = true;
            break;
          }
        }
        if (isUnpaved) break;
      }

      if (isUnpaved) {
        const d = calculateDistance(v, w);
        totalUnpavedDistance += d;
        unpavedSegments.push({ coordinates: [v, w], distance: d });
      }
    }

    return { segments: unpavedSegments, totalDistance: totalUnpavedDistance };
  } catch (error) {
    if ((error as any).name === 'AbortError' || (error as any).message === 'AbortError') throw error;
    console.warn('Fallback: Error fetching unpaved from Overpass:', error);
    return { segments: [], totalDistance: 0 };
  }
}

function calculateBBox(points: [number, number][]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  points.forEach(p => {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  });
  return { minLat, maxLat, minLng, maxLng };
}

function bboxesIntersect(a: any, b: any, buffer = 0) {
  return !(a.maxLat + buffer < b.minLat || 
           a.minLat - buffer > b.maxLat || 
           a.maxLng + buffer < b.minLng || 
           a.minLng - buffer > b.maxLng);
}

function calculateDistance(v: [number, number], w: [number, number]) {
  const R = 6371e3;
  const φ1 = v[0] * Math.PI / 180;
  const φ2 = w[0] * Math.PI / 180;
  const Δφ = (w[0] - v[0]) * Math.PI / 180;
  const Δλ = (w[1] - v[1]) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Shared logic to detect and group tolls effectively
 */
async function handleTollDetection(geometry: string, osrmTolls: any[], stops: Stop[], isRoundTrip: boolean, signal?: AbortSignal) {
  const [overpassTolls, unpavedData] = await Promise.all([
    withTimeout(fetchTollsFromOverpass(geometry, signal), 25000, []),
    withTimeout(fetchUnpavedFromOverpass(geometry, signal), 25000, { segments: [], totalDistance: 0 })
  ]);

  const routeCoords = decodePolyline(geometry);

  // Find the vertex index for the return leg
  // Strategy: The return point is the stop geographically FURTHEST from the base (stops[0])
  let returnVertexIndex = -1;
  if (isRoundTrip && stops.length >= 2) {
    const base = stops[0];
    let maxDist = -1;
    let furthestStop = stops[1] || stops[0];

    // Find stop that is geographically most distant from base
    for (let i = 1; i < stops.length - 1; i++) {
        const d = calculateDistance([base.lat, base.lng], [stops[i].lat, stops[i].lng]);
        if (d > maxDist) {
            maxDist = d;
            furthestStop = stops[i];
        }
    }

    // Now find the LAST occurrence of this furthest point in the geometry 
    // to determine where the return journey theoretically begins
    let minDist = Infinity;
    const startSearchIdx = Math.floor(routeCoords.length / 4); // Optimization
    for (let i = startSearchIdx; i < routeCoords.length; i++) {
        const d = Math.pow(routeCoords[i][0] - furthestStop.lat, 2) + Math.pow(routeCoords[i][1] - furthestStop.lng, 2);
        if (d <= minDist) {
            minDist = d;
            returnVertexIndex = i;
        }
    }
  }

  const encounters: { lat: number; lng: number; name: string; progressIndex: number }[] = [];
  const allCandidates = [...osrmTolls, ...overpassTolls];
  
  const uniqueStations: any[] = [];
  allCandidates.forEach(cand => {
    const isDuplicate = uniqueStations.some(s => {
      const dLat = s.lat - cand.lat;
      const dLng = s.lng - cand.lng;
      return (dLat * dLat + dLng * dLng) < 0.000005; // ~200m
    });
    if (!isDuplicate) uniqueStations.push(cand);
  });

  const THRESHOLD = 0.0000005; // ~80m radius
  uniqueStations.forEach(station => {
    const p = [station.lat, station.lng];
    const cosLat = Math.cos(p[0] * Math.PI / 180);
    const stationBBox = { 
      minLat: p[0] - 0.01, maxLat: p[0] + 0.01, 
      minLng: p[1] - 0.01, maxLng: p[1] + 0.01 
    };

    let lastEncounterIndex = -100;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      if (i < lastEncounterIndex + 50) continue; 
      const v = routeCoords[i];
      const w = routeCoords[i + 1];
      
      const segBBox = {
        minLat: Math.min(v[0], w[0]), maxLat: Math.max(v[0], w[0]),
        minLng: Math.min(v[1], w[1]), maxLng: Math.max(v[1], w[1])
      };

      if (!bboxesIntersect(segBBox, stationBBox)) continue;

      const dx = (w[1] - v[1]) * cosLat;
      const dy = w[0] - v[0];
      const l2 = dx * dx + dy * dy;

      const px = (p[1] - v[1]) * cosLat;
      const py = p[0] - v[0];

      let dist2 = 0;
      if (l2 === 0) {
        dist2 = px * px + py * py;
      } else {
        let t = Math.max(0, Math.min(1, (px * dx + py * dy) / l2));
        dist2 = Math.pow(px - (t * dx), 2) + Math.pow(py - (t * dy), 2);
      }

      if (dist2 < THRESHOLD) {
        encounters.push({ ...station, progressIndex: i });
        lastEncounterIndex = i;
      }
    }
  });

  const sortedEncounters = encounters.sort((a, b) => a.progressIndex - b.progressIndex);
  const groupedTolls = processGroupedTolls(sortedEncounters, returnVertexIndex);
  
  // Enriquecer nomes com Photon de forma sequencial para evitar 429
  await enrichTollNames(groupedTolls, signal);

  return { 
    groupedTolls, 
    tollCount: encounters.length,
    unpavedData
  };
}

/**
 * Sequential geocoding with throttling to respect Photon API
 */
async function enrichTollNames(tolls: any[], signal?: AbortSignal) {
  for (let i = 0; i < tolls.length; i++) {
    if (signal?.aborted) throw new Error('AbortError');
    const t = tolls[i];
    
    // Jacarezinho fallback
    const isJacarezinho = (Math.abs(t.lat - (-23.143)) < 0.05 && Math.abs(t.lng - (-49.972)) < 0.05) ||
                        (Math.abs(t.lat - (-23.15)) < 0.05 && Math.abs(t.lng - (-49.98)) < 0.05);

    try {
      // Throttle: 200ms delay between calls
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 200));

      const response = await fetch(`https://photon.komoot.io/reverse?lon=${t.lng}&lat=${t.lat}`, { signal });
      if (response.ok) {
        const data = await response.json();
        if (data?.features?.length > 0) {
          const props = data.features[0].properties;
          let city = props.city || props.town || props.village || props.county || props.municipality;
          const state = props.state;
          if (city) {
            if (isJacarezinho || city.toLowerCase().includes('jacarezinho')) {
              t.name = `Pedágio - Jacarezinho / Ourinhos (SP/PR)`;
            } else {
              t.name = `Pedágio - Próximo a ${city}${state ? ` (${state})` : ''}`;
            }
            continue;
          }
        }
      }
    } catch (e) {
      if ((e as any).name === 'AbortError') throw e;
    }

    if (isJacarezinho) {
      t.name = `Pedágio - Jacarezinho / Ourinhos (SP/PR)`;
    }
  }
}

export const getRoute = async (stops: Stop[], avoidUnpaved: boolean = false, signal?: AbortSignal) => {
  if (stops.length < 2) return null;

  const coordinates = stops.map(s => `${s.lng},${s.lat}`).join(';');

  try {
    let data = null;
    let lastError = null;

    let urlsToTry = [...OSRM_BASE_URLS];
    if (avoidUnpaved) {
      urlsToTry = ['https://routing.openstreetmap.de/routed-car', 'https://router.project-osrm.org'];
    }

    for (const baseUrl of urlsToTry) {
      if (signal?.aborted) throw new Error('AbortError');
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let url = `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline&steps=true&annotations=true`;
          const response = await fetch(url, { signal });
          if (response.ok) {
            data = await response.json();
            if (data.code === 'Ok') break;
          }
        } catch (err: any) {
          lastError = err;
          if (err.name === 'AbortError') throw err;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (data?.code === 'Ok') break;
    }

    if (!data || data.code !== 'Ok') throw lastError || new Error('OSRM Failed');

    const osrmTolls: any[] = [];
    const legs = data.routes[0].legs || [];
    legs.forEach((leg: any) => {
      leg.steps?.forEach((step: any) => {
        const nameLower = (step.name || '').toLowerCase();
        const hasToll = step.intersections?.some((i: any) => i.classes?.includes('toll')) ||
                       nameLower.includes('pedágio') || nameLower.includes('pedagio') || nameLower.includes('toll');
        if (hasToll) {
          const loc = step.maneuver?.location;
          if (loc) osrmTolls.push({ lat: loc[1], lng: loc[0], name: step.name || 'Pedágio' });
        }
      });
    });

    const geometry = data.routes[0].geometry;
    const isRoundTripInternal = stops.length > 2 && stops[0].lat === stops[stops.length - 1].lat && stops[0].lng === stops[stops.length - 1].lng;
    const { groupedTolls, tollCount, unpavedData } = await handleTollDetection(geometry, osrmTolls, stops, isRoundTripInternal, signal);

    return {
      distance: data.routes[0].distance,
      duration: data.routes[0].duration,
      geometry,
      stops,
      tollCount,
      tolls: groupedTolls,
      unpavedSegments: unpavedData.segments,
      totalUnpavedDistance: unpavedData.totalDistance
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') throw error;
    console.error('Erro OSRM Route:', error);
    return null;
  }
};
;

export const optimizeRoute = async (stops: Stop[], avoidUnpaved: boolean = false, isRoundTrip: boolean = true, signal?: AbortSignal) => {
  if (stops.length < 2) return null;

  const coordinates = stops.map(s => `${s.lng},${s.lat}`).join(';');

  try {
    let data = null;
    let lastError = null;

    let urlsToTry = [...OSRM_BASE_URLS];
    if (avoidUnpaved) {
      urlsToTry = ['https://routing.openstreetmap.de/routed-car', 'https://router.project-osrm.org'];
    }

    for (const baseUrl of urlsToTry) {
      if (signal?.aborted) throw new Error('AbortError');
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let url = `${baseUrl}/trip/v1/driving/${coordinates}?source=first&overview=full&geometries=polyline&steps=true&annotations=true`;
          url += isRoundTrip ? '&roundtrip=true' : '&roundtrip=false&destination=any';

          const response = await fetch(url, { signal });
          if (response.ok) {
            data = await response.json();
            if (data.code === 'Ok') break;
          }
        } catch (err: any) {
          lastError = err;
          if (err.name === 'AbortError') throw err;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (data?.code === 'Ok') break;
    }

    if (!data || data.code !== 'Ok') throw lastError || new Error('Optimization Failed');

    const reorderedStops = data.waypoints
      .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index)
      .map((wp: any) => stops[wp.waypoint_index]);

    const osrmTolls: any[] = [];
    const trip = data.trips[0];
    trip.legs?.forEach((leg: any) => {
      leg.steps?.forEach((step: any) => {
        const nameLower = (step.name || '').toLowerCase();
        const hasToll = step.intersections?.some((i: any) => i.classes?.includes('toll')) ||
                       nameLower.includes('pedágio') || nameLower.includes('pedagio') || nameLower.includes('toll');
        if (hasToll) {
          const loc = step.maneuver?.location;
          if (loc) osrmTolls.push({ lat: loc[1], lng: loc[0], name: step.name || 'Pedágio' });
        }
      });
    });

    const geometry = trip.geometry;
    const { groupedTolls, tollCount, unpavedData } = await handleTollDetection(geometry, osrmTolls, reorderedStops, isRoundTrip, signal);

    return {
      distance: trip.distance,
      duration: trip.duration,
      geometry,
      stops: reorderedStops,
      tollCount,
      tolls: groupedTolls,
      unpavedSegments: unpavedData.segments,
      totalUnpavedDistance: unpavedData.totalDistance
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') throw error;
    console.error('Erro OSRM Optimize:', error);
    return null;
  }
};
;
