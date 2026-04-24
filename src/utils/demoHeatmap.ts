import { HeatPoint } from '@/services/statsService';

const JUNIN_CENTER_LAT = -33.0865;
const JUNIN_CENTER_LNG = -68.4683;
const MAX_RADIUS_KM = 6;

const DEMO_CATEGORIES = [
  'Iluminación',
  'Residuos',
  'Seguridad',
  'Infraestructura',
  'Tránsito',
  'Servicios Públicos',
] as const;

const DEMO_STATES = [
  'Nuevo',
  'En progreso',
  'Resuelto',
  'Pendiente',
] as const;

const DEMO_BARRIOS = [
  'Centro',
  'Callejón Los Huarpes',
  'Alto Verde',
  'Philipps',
  'Orfila',
  'La Colonia',
  'Los Barriales',
  'Mundo Nuevo',
  'Algarrobo Grande',
] as const;

const DEMO_TICKET_TYPES = [
  'Reclamo',
  'Incidente',
  'Reporte de Servicio',
] as const;

const DEMO_SEVERITIES = ['baja', 'media', 'alta'] as const;

const DEMO_STREETS = [
  'San Martín',
  '9 de Julio',
  'Hipólito Yrigoyen',
  'Remedios de Escalada',
  'Avenida Mitre',
  'Godoy Cruz',
  'Belgrano',
  'Salvador González',
  'Espejo',
  'Lavalle',
  'Buenos Aires',
];

const DEMO_NOTICE = 'Mostrando datos de demostración cerca de Junín, Mendoza.';

const randomFromArray = <T>(array: readonly T[]): T => {
  const index = Math.floor(Math.random() * array.length);
  return array[Math.max(0, Math.min(array.length - 1, index))];
};

const randomCoordinateNearJunin = () => {
  const radiusInDegrees = (MAX_RADIUS_KM / 111) * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const deltaLat = radiusInDegrees * Math.cos(theta);
  const deltaLng =
    (radiusInDegrees * Math.sin(theta)) /
    Math.cos((JUNIN_CENTER_LAT * Math.PI) / 180);

  const lat = JUNIN_CENTER_LAT + deltaLat;
  const lng = JUNIN_CENTER_LNG + deltaLng;

  return { lat, lng };
};

const buildDemoAddress = (barrio: string) => {
  const street = randomFromArray(DEMO_STREETS);
  const number = 100 + Math.floor(Math.random() * 900);
  return `${street} ${number}, ${barrio}`;
};

export const generateJuninDemoHeatmap = (count = 60): HeatPoint[] => {
  return Array.from({ length: count }).map((_, index) => {
    const { lat, lng } = randomCoordinateNearJunin();
    const categoria = randomFromArray(DEMO_CATEGORIES);
    const estado = randomFromArray(DEMO_STATES);
    const barrio = randomFromArray(DEMO_BARRIOS);
    const tipo_ticket = randomFromArray(DEMO_TICKET_TYPES);
    const severidad = randomFromArray(DEMO_SEVERITIES);
    const baseWeight = severidad === 'alta' ? 4 : severidad === 'media' ? 3 : 2;
    const weight = Math.max(1, Math.round(baseWeight + Math.random() * 2));
    const recencyDays = Math.floor(Math.random() * 45);
    const last_ticket_at = new Date(Date.now() - recencyDays * 24 * 60 * 60 * 1000).toISOString();

    return {
      id: index + 1,
      lat,
      lng,
      weight,
      categoria,
      estado,
      barrio,
      distrito: 'Junín',
      direccion: buildDemoAddress(barrio),
      ticket: `DEMO-${String(index + 1).padStart(4, '0')}`,
      tipo_ticket,
      severidad,
      last_ticket_at,
    } satisfies HeatPoint;
  });
};

export const JUNIN_DEMO_CENTER: [number, number] = [JUNIN_CENTER_LNG, JUNIN_CENTER_LAT];
export const JUNIN_DEMO_CATEGORIES = [...DEMO_CATEGORIES];
export const JUNIN_DEMO_STATES = [...DEMO_STATES];
export const JUNIN_DEMO_BARRIOS = [...DEMO_BARRIOS];
export const JUNIN_DEMO_TICKET_TYPES = [...DEMO_TICKET_TYPES];
export const JUNIN_DEMO_SEVERITIES = [...DEMO_SEVERITIES];
export const JUNIN_DEMO_NOTICE = DEMO_NOTICE;

export const mergeAndSortStrings = (base: string[], extras: string[]): string[] => {
  const unique = new Set<string>([...base, ...extras.filter(Boolean)]);
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
};
