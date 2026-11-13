/**
 * Encuadre inicial declarado por la organización para el mapa sin actividad.
 *
 * Una jurisdicción puede extenderse mucho más allá de donde vive su gente
 * (Tierra del Fuego llega al Polo Sur). Cuando no hay ubicaciones que encuadrar,
 * el servidor puede declarar una vista de arranque. Es sólo cámara: no cambia
 * el límite oficial que se dibuja ni la contención de los puntos.
 */
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Devuelve las dos esquinas `[lng, lat]` de la vista declarada, o null si no es válida. */
export function readTerritoryInitialView(jurisdiction: unknown): [number, number][] | null {
  if (jurisdiction === null || typeof jurisdiction !== 'object' || Array.isArray(jurisdiction)) return null;
  const view = (jurisdiction as Record<string, unknown>).initial_view_bounds;
  if (view === null || typeof view !== 'object' || Array.isArray(view)) return null;
  const { west, south, east, north } = view as Record<string, unknown>;
  if (!finite(west) || !finite(south) || !finite(east) || !finite(north)) return null;
  if (!(west >= -180 && west < east && east <= 180 && south >= -90 && south < north && north <= 90)) return null;
  return [[west, south], [east, north]];
}
