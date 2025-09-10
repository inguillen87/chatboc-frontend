// utils/fecha.ts
// Deprecated: use fmtAR from utils/date instead for formatting

/**
 * Convierte una fecha a una cadena ISO sin ajustar a UTC.
 * Ajusta la fecha restando el offset de la zona horaria para
 * mantener la hora local al serializarla.
 */
export function toLocalISOString(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}
