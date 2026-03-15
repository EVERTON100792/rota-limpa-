import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Stop } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getGoogleMapsUrl(stops: Stop[], isRoundTrip: boolean = false, baseStop: Stop | null = null) {
  if (stops.length === 0 && !baseStop) return '';

  const formatPoint = (stop: Stop, isOrigin: boolean) => {
    if (stop.isAutoGPS || stop.address === 'Localização Atual' || stop.address === 'Minha Localização') {
      if (isOrigin) return 'CURRENT_LOCATION';
      // Se for o destino (retorno), usamos as coordenadas exatas para garantir que ele volte
      // para o ponto exato de onde saiu, em vez de tentar adivinhar o nome da rua.
      return `${stop.lat},${stop.lng}`;
    }

    // Envia o endereço exato como foi digitado ou processado, 
    // para garantir que nenhuma informação (como bairro, complemento) se perca ao abrir o Maps
    return encodeURIComponent(stop.address);
  };

  const points: string[] = [];

  if (baseStop) points.push(formatPoint(baseStop, true));
  stops.forEach(s => points.push(formatPoint(s, false)));

  if (isRoundTrip && baseStop) points.push(formatPoint(baseStop, false));
  else if (isRoundTrip && stops.length > 0) points.push(formatPoint(stops[0], false));

  if (points.length < 2) return '';

  let origin = points[0];
  let destination = points[points.length - 1];

  let waypointsArray = points.slice(1, -1);

  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate`;

  if (origin !== 'CURRENT_LOCATION') {
    url += `&origin=${origin}`;
  }

  url += `&destination=${destination}`;

  waypointsArray = waypointsArray.filter(w => w !== 'CURRENT_LOCATION');
  if (waypointsArray.length > 0) {
    url += `&waypoints=${waypointsArray.join('%7C')}`;
  }

  return url;
}
