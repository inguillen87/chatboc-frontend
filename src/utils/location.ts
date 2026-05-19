export const parseCoordinateValue = (value?: unknown): number | undefined => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) {
      return undefined;
    }
    return value;
  }

  if (typeof value === 'string') {
    const sanitized = value.trim();

    if (!sanitized) {
      return undefined;
    }

    const normalized = sanitized.replace(',', '.');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed === 0) {
      return undefined;
    }

    return parsed;
  }

  return undefined;
};

export const hasCoordinateValue = (value?: unknown): boolean => {
  return typeof parseCoordinateValue(value) === 'number';
};

export const pickFirstCoordinate = (
  ...values: unknown[]
): number | undefined => {
  for (const value of values) {
    const parsed = parseCoordinateValue(value);

    if (typeof parsed === 'number') {
      return parsed;
    }
  }

  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

const pickCoordinatePair = (...values: unknown[]): [number, number] | undefined => {
  for (const value of values) {
    if (!Array.isArray(value) || value.length < 2) continue;
    const lng = parseCoordinateValue(value[0]);
    const lat = parseCoordinateValue(value[1]);
    if (typeof lat === 'number' && typeof lng === 'number') {
      return [lng, lat];
    }
  }
  return undefined;
};

export type NormalizedTicketLocation = {
  direccion?: string;
  distrito?: string;
  latitud?: number;
  longitud?: number;
  lat_destino?: number;
  lon_destino?: number;
  coordinates?: { lat: number; lng: number };
  map_search_url?: string;
  has_location: boolean;
  location?: {
    address?: string;
    direccion?: string;
    lat?: number;
    lng?: number;
    map_search_url?: string;
  };
  ubicacion_geografica?: {
    direccion?: string;
    latitud?: number;
    longitud?: number;
    map_search_url?: string;
  };
};

export const normalizeTicketLocation = (
  ticket: unknown,
): NormalizedTicketLocation => {
  const raw = asRecord(ticket);
  const location = asRecord(raw.location);
  const geo = asRecord(raw.ubicacion_geografica);
  const rawCoordinates = asRecord(raw.coordinates);
  const locationCoordinates = asRecord(location.coordinates);
  const pair = pickCoordinatePair(
    raw.coordinates,
    location.coordinates,
    geo.coordinates,
  );

  const lat = pickFirstCoordinate(
    raw.latitud,
    raw.lat_destino,
    raw.lat,
    raw.latitude,
    rawCoordinates.lat,
    rawCoordinates.latitude,
    location.latitud,
    location.lat,
    location.latitude,
    locationCoordinates.lat,
    locationCoordinates.latitude,
    geo.latitud,
    geo.lat,
    geo.latitude,
    pair?.[1],
  );
  const lng = pickFirstCoordinate(
    raw.longitud,
    raw.lon_destino,
    raw.lng,
    raw.lon,
    raw.longitude,
    rawCoordinates.lng,
    rawCoordinates.lon,
    rawCoordinates.longitude,
    location.longitud,
    location.lng,
    location.lon,
    location.longitude,
    locationCoordinates.lng,
    locationCoordinates.lon,
    locationCoordinates.longitude,
    geo.longitud,
    geo.lng,
    geo.lon,
    geo.longitude,
    pair?.[0],
  );
  const address = pickFirstString(
    raw.direccion,
    raw.direccion_exacta_aproximada,
    location.direccion,
    location.address,
    geo.direccion,
    geo.address,
  );
  const distrito = pickFirstString(raw.distrito, location.distrito, geo.distrito);
  const mapSearchUrl =
    pickFirstString(
      raw.map_search_url,
      location.map_search_url,
      geo.map_search_url,
    ) ||
    (typeof lat === 'number' && typeof lng === 'number'
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : undefined);
  const hasCoordinates = typeof lat === 'number' && typeof lng === 'number';
  const hasLocation = hasCoordinates || Boolean(address);

  return {
    ...(address ? { direccion: address } : {}),
    ...(distrito ? { distrito } : {}),
    ...(hasCoordinates
      ? {
          latitud: lat,
          longitud: lng,
          lat_destino: lat,
          lon_destino: lng,
          coordinates: { lat, lng },
        }
      : {}),
    ...(mapSearchUrl ? { map_search_url: mapSearchUrl } : {}),
    has_location: hasLocation,
    location: {
      ...(address ? { address, direccion: address } : {}),
      ...(hasCoordinates ? { lat, lng } : {}),
      ...(mapSearchUrl ? { map_search_url: mapSearchUrl } : {}),
    },
    ubicacion_geografica: {
      ...(address ? { direccion: address } : {}),
      ...(hasCoordinates ? { latitud: lat, longitud: lng } : {}),
      ...(mapSearchUrl ? { map_search_url: mapSearchUrl } : {}),
    },
  };
};
