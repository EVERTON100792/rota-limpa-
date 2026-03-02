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

async function fetchFromOverpass(query: string) {
  let lastError = null;

  // Shuffle instances to distribute load and avoid immediate 429 on the main instance
  const instancesToTry = [...OVERPASS_INSTANCES].sort(() => Math.random() - 0.5);
  let delay = 1000;

  // Try different instances
  for (let i = 0; i < instancesToTry.length; i++) {
    const instance = instancesToTry[i];
    const controller = new AbortController();
    // Increase timeout to 20s as most queries are complex
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      // Delay before trying next instance, increasing exponentially
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff for next iteration
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

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429 || response.status === 504 || response.status === 502 || response.status === 503) {
        // Silenciando o alerta no console, visto que o fallback já lida perfeitamente com 429 mudando a instância
        // console.warn(`Overpass instance ${instance} failed with status ${response.status}, trying next...`);
        continue;
      }

      console.warn(`Overpass instance ${instance} failed with status ${response.status}`);
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;
      if (error.name === 'AbortError') {
        console.warn(`Overpass instance ${instance} timed out (30s), trying next...`);
      } else {
        console.warn(`Overpass instance ${instance} failed:`, error);
      }
    }
  }

  throw lastError || new Error('All Overpass instances failed');
}

async function fetchTollsFromOverpass(geometry: string) {
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

    // Add a small buffer to the bounding box (approx 5km)
    minLat -= 0.05; maxLat += 0.05;
    minLng -= 0.05; maxLng += 0.05;

    const area = (maxLat - minLat) * (maxLng - minLng);

    let query = '';
    if (area > 50) {
      // For very long routes, use polyline around query to avoid timeouts
      const simplified = simplifyPolyline(coords, 0.05); // ~5km tolerance
      const polyStr = simplified.map(p => `${p[0]},${p[1]}`).join(',');

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

    const data = await fetchFromOverpass(query);
    const allTolls = data.elements.map((e: any) => ({
      lat: e.lat || e.center?.lat,
      lng: e.lon || e.center?.lon,
      name: e.tags?.name || 'Pedágio'
    })).filter((e: any) => e.lat && e.lng);

    // Filter tolls close to the route
    const THRESHOLD = 0.0000002; // approx 50 meters radius (degrees squared)

    const routeTolls = allTolls.filter((toll: any) => {
      const p = [toll.lat, toll.lng];
      const cosLat = Math.cos(p[0] * Math.PI / 180);

      for (let i = 0; i < coords.length - 1; i++) {
        const v = coords[i];
        const w = coords[i + 1];

        const dx = (w[1] - v[1]) * cosLat;
        const dy = w[0] - v[0];
        const l2 = dx * dx + dy * dy;

        const px = (p[1] - v[1]) * cosLat;
        const py = p[0] - v[0];

        let dist2 = 0;
        if (l2 === 0) {
          dist2 = px * px + py * py;
        } else {
          let t = (px * dx + py * dy) / l2;
          t = Math.max(0, Math.min(1, t));
          const projX = t * dx;
          const projY = t * dy;
          dist2 = Math.pow(px - projX, 2) + Math.pow(py - projY, 2);
        }

        if (dist2 < THRESHOLD) {
          return true;
        }
      }
      return false;
    });

    // Deduplicate tolls that are very close to each other (e.g. opposite directions)
    const uniqueTolls: any[] = [];
    routeTolls.forEach((toll: any) => {
      const isDuplicate = uniqueTolls.some(u => {
        const dLat = u.lat - toll.lat;
        const dLng = u.lng - toll.lng;
        return (dLat * dLat + dLng * dLng) < 0.00001; // approx 300m
      });
      if (!isDuplicate) {
        uniqueTolls.push(toll);
      }
    });

    // Return unique tolls directly since we already have the name from Overpass
    return uniqueTolls;
  } catch (error) {
    console.error('Error fetching tolls from Overpass:', error);
    return [];
  }
}

async function fetchUnpavedFromOverpass(geometry: string) {
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

    // Add a small buffer to the bounding box (approx 5km)
    minLat -= 0.05; maxLat += 0.05;
    minLng -= 0.05; maxLng += 0.05;

    const area = (maxLat - minLat) * (maxLng - minLng);

    let query = '';
    if (area > 20) {
      const simplified = simplifyPolyline(coords, 0.05); // ~5km tolerance
      const polyStr = simplified.map(p => `${p[0]},${p[1]}`).join(',');

      query = `
        [out:json][timeout:25];
        (
          way["highway"~"track|unclassified|path"]["surface"~"unpaved|dirt|earth|ground|gravel|sand|clay|fine_gravel|wood|grass|mud"](around:5000,${polyStr});
          way["highway"="track"](around:5000,${polyStr});
        );
        out body;
        >;
        out skel qt;
      `;
    } else {
      query = `
        [out:json][timeout:15];
        (
          way["highway"~"track|unclassified|path"]["surface"~"unpaved|dirt|earth|ground|gravel|sand|clay|fine_gravel|wood|grass|mud"](${minLat},${minLng},${maxLat},${maxLng});
          way["highway"="track"](${minLat},${minLng},${maxLat},${maxLng});
        );
        out body;
        >;
        out skel qt;
      `;
    }

    const data = await fetchFromOverpass(query);
    const nodesMap: Record<number, [number, number]> = {};
    data.elements.forEach((e: any) => {
      if (e.type === 'node') {
        nodesMap[e.id] = [e.lat, e.lon];
      }
    });

    const unpavedWays = data.elements
      .filter((e: any) => e.type === 'way')
      .map((w: any) => w.nodes.map((nodeId: number) => nodesMap[nodeId]).filter(Boolean));

    const THRESHOLD = 0.000005; // approx 250 meters squared
    const unpavedSegments: { coordinates: [number, number][]; distance: number }[] = [];
    let totalUnpavedDistance = 0;

    // For each segment in the route, check if it's close to any unpaved way
    for (let i = 0; i < coords.length - 1; i++) {
      // Prevent UI freeze: allow the event loop to breathe every 100 segments
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const v = coords[i];
      const w = coords[i + 1];
      const p = [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2]; // Midpoint of segment

      let isUnpaved = false;
      for (const way of unpavedWays) {
        for (let j = 0; j < way.length - 1; j++) {
          const wv = way[j];
          const ww = way[j + 1];

          // Distance from midpoint p to segment (wv, ww)
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
            let t = (px * dx + py * dy) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = t * dx;
            const projY = t * dy;
            dist2 = Math.pow(px - projX, 2) + Math.pow(py - projY, 2);
          }

          if (dist2 < THRESHOLD) {
            isUnpaved = true;
            break;
          }
        }
        if (isUnpaved) break;
      }

      if (isUnpaved) {
        // Calculate distance of this segment
        const R = 6371e3; // metres
        const φ1 = v[0] * Math.PI / 180;
        const φ2 = w[0] * Math.PI / 180;
        const Δφ = (w[0] - v[0]) * Math.PI / 180;
        const Δλ = (w[1] - v[1]) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;

        totalUnpavedDistance += d;
        unpavedSegments.push({
          coordinates: [v, w],
          distance: d
        });
      }
    }

    return { segments: unpavedSegments, totalDistance: totalUnpavedDistance };
  } catch (error) {
    console.error('Error fetching unpaved from Overpass:', error);
    return { segments: [], totalDistance: 0 };
  }
}

export const getRoute = async (stops: Stop[], avoidUnpaved: boolean = false) => {
  if (stops.length < 2) return null;

  const coordinates = stops
    .map(s => `${s.lng},${s.lat}`)
    .join(';');

  try {
    let response = null;
    let data = null;
    let lastError = null;

    let urlsToTry = [...OSRM_BASE_URLS];
    if (avoidUnpaved) {
      // Prioritize openstreetmap.de which supports exclude=unpaved
      urlsToTry = [
        'https://routing.openstreetmap.de/routed-car',
        'https://router.project-osrm.org'
      ];
    }

    for (const baseUrl of urlsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let url = `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline&steps=true&annotations=true`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max para OSRM

          // console.log(`OSRM Request (${baseUrl}): ${url}`);
          response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            data = await response.json();
            if (data.code === 'Ok') break;
          } else {
            const errorText = await response.text();
            console.warn(`OSRM server ${baseUrl} returned ${response.status}: ${errorText}`);
          }
        } catch (err) {
          lastError = err;
          console.error(`OSRM attempt ${attempt + 1} failed for ${baseUrl}:`, err);
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      if (data && data.code === 'Ok') break;
    }

    if (!data || data.code !== 'Ok') {
      throw lastError || new Error('Falha ao calcular rota em todos os servidores');
    }

    // Count tolls by checking intersections in steps (grouping contiguous toll steps)
    let tollCount = 0;
    let inTollZone = false;
    const tolls: { lat: number; lng: number; name: string }[] = [];

    const legs = data.routes[0].legs || [];
    legs.forEach((leg: any) => {
      const steps = leg.steps || [];
      steps.forEach((step: any) => {
        const nameLower = step.name?.toLowerCase() || '';
        const refLower = step.ref?.toLowerCase() || '';
        const hasToll = step.intersections?.some((i: any) => i.classes?.includes('toll')) ||
          nameLower.includes('pedágio') || nameLower.includes('pedagio') || nameLower.includes('toll') ||
          refLower.includes('pedágio') || refLower.includes('pedagio') || refLower.includes('toll');

        if (hasToll) {
          if (!inTollZone) {
            tollCount++;
            inTollZone = true;

            // Find the first intersection with a toll
            const tollLocation = step.intersections?.find((i: any) => i.classes?.includes('toll'))?.location ||
              step.intersections?.[0]?.location ||
              step.maneuver?.location;

            if (tollLocation) {
              const roadName = step.ref ? `Rodovia ${step.ref}` : (step.name ? step.name : 'Rodovia');
              tolls.push({
                lat: tollLocation[1],
                lng: tollLocation[0],
                name: roadName
              });
            }
          }
        } else {
          inTollZone = false;
        }
      });
    });

    const geometry = data.routes[0].geometry;

    // Parallelize toll and unpaved road detection with strict max 4s timeout to avoid browser freeze
    const [overpassTolls, unpavedData] = await Promise.all([
      withTimeout(fetchTollsFromOverpass(geometry), 4000, []),
      withTimeout(fetchUnpavedFromOverpass(geometry), 4000, { segments: [], totalDistance: 0 })
    ]);

    // Merge tolls, preferring Overpass tolls as they are usually more accurate
    if (overpassTolls.length > 0) {
      overpassTolls.forEach(ot => {
        const isDuplicate = tolls.some(t => {
          const dLat = t.lat - ot.lat;
          const dLng = t.lng - ot.lng;
          return (dLat * dLat + dLng * dLng) < 0.00001; // approx 300m
        });
        if (!isDuplicate) {
          tolls.push(ot);
        }
      });
      tollCount = tolls.length;
    }

    // Reverse geocode tolls to get city names sequentially
    if (tolls.length > 0) {
      for (let i = 0; i < tolls.length; i++) {
        const t = tolls[i];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout per toll

        try {
          const response = await fetch(`https://photon.komoot.io/reverse?lon=${t.lng}&lat=${t.lat}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data && data.features && data.features.length > 0) {
              const props = data.features[0].properties;
              const city = props.city || props.town || props.village || props.county || props.municipality;
              const state = props.state;
              if (city) {
                t.name = `Pedágio - Próximo a ${city}${state ? ` (${state})` : ''}`;
              }
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
          console.warn('Photon reverse geocode failed or timed out for toll', err);
        }

        // Small delay between requests
        if (i < tolls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    }

    return {
      distance: data.routes[0].distance,
      duration: data.routes[0].duration,
      geometry: geometry,
      stops,
      tollCount,
      tolls,
      unpavedSegments: unpavedData.segments,
      totalUnpavedDistance: unpavedData.totalDistance
    };
  } catch (error) {
    console.error('Erro OSRM Route:', error);
    return null;
  }
};

export const optimizeRoute = async (stops: Stop[], avoidUnpaved: boolean = false, isRoundTrip: boolean = true) => {
  if (stops.length < 2) return null;

  const coordinates = stops
    .map(s => `${s.lng},${s.lat}`)
    .join(';');

  try {
    let response = null;
    let data = null;
    let lastError = null;

    let urlsToTry = [...OSRM_BASE_URLS];
    if (avoidUnpaved) {
      // Prioritize openstreetmap.de which supports exclude=unpaved
      urlsToTry = [
        'https://routing.openstreetmap.de/routed-car',
        'https://router.project-osrm.org'
      ];
    }

    for (const baseUrl of urlsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // OSRM Trip service for TSP
          let url = `${baseUrl}/trip/v1/driving/${coordinates}?source=first&overview=full&geometries=polyline&steps=true&annotations=true`;

          if (isRoundTrip) {
            url += '&roundtrip=true';
          } else {
            url += '&roundtrip=false&destination=any';
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s para Optimize (pesado)

          console.log(`OSRM Optimize Request (${baseUrl}): ${url}`);
          response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            data = await response.json();
            if (data.code === 'Ok') break;
          } else {
            const errorText = await response.text();
            console.warn(`OSRM Optimize server ${baseUrl} returned ${response.status}: ${errorText}`);
          }
        } catch (err) {
          lastError = err;
          console.error(`OSRM Optimize attempt ${attempt + 1} failed for ${baseUrl}:`, err);
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      if (data && data.code === 'Ok') break;
    }

    if (!data || data.code !== 'Ok') {
      throw lastError || new Error('Falha ao otimizar rota em todos os servidores');
    }

    // Reorder stops based on waypoints
    // The waypoints array in the response is ordered by the visit sequence.
    // Each waypoint object has a 'waypoint_index' property that corresponds to the index in the original input.
    const reorderedStops = data.waypoints.map((wp: any) => stops[wp.waypoint_index]);

    let tollCount = 0;
    let inTollZone = false;
    const tolls: { lat: number; lng: number; name: string }[] = [];

    const trips = data.trips || [];
    if (trips.length > 0) {
      const legs = trips[0].legs || [];
      legs.forEach((leg: any) => {
        const steps = leg.steps || [];
        steps.forEach((step: any) => {
          const nameLower = step.name?.toLowerCase() || '';
          const refLower = step.ref?.toLowerCase() || '';
          const hasToll = step.intersections?.some((i: any) => i.classes?.includes('toll')) ||
            nameLower.includes('pedágio') || nameLower.includes('pedagio') || nameLower.includes('toll') ||
            refLower.includes('pedágio') || refLower.includes('pedagio') || refLower.includes('toll');

          if (hasToll) {
            if (!inTollZone) {
              tollCount++;
              inTollZone = true;

              const tollLocation = step.intersections?.find((i: any) => i.classes?.includes('toll'))?.location ||
                step.intersections?.[0]?.location ||
                step.maneuver?.location;

              if (tollLocation) {
                const roadName = step.ref ? `Rodovia ${step.ref}` : (step.name ? step.name : 'Rodovia');
                tolls.push({
                  lat: tollLocation[1],
                  lng: tollLocation[0],
                  name: roadName
                });
              }
            }
          } else {
            inTollZone = false;
          }
        });
      });
    }

    const geometry = data.trips[0].geometry;

    // Parallelize toll and unpaved road detection with strict max 4s timeout to avoid browser freeze
    const [overpassTolls, unpavedData] = await Promise.all([
      withTimeout(fetchTollsFromOverpass(geometry), 4000, []),
      withTimeout(fetchUnpavedFromOverpass(geometry), 4000, { segments: [], totalDistance: 0 })
    ]);

    return {
      distance: data.trips[0].distance,
      duration: data.trips[0].duration,
      geometry: geometry,
      stops: reorderedStops,
      tollCount,
      tolls,
      unpavedSegments: unpavedData.segments,
      totalUnpavedDistance: unpavedData.totalDistance
    };
  } catch (error) {
    console.error('Erro OSRM Optimize:', error);
    return null;
  }
};
