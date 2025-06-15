// utils/fecha.ts
import { TIMEZONE, LOCALE } from "../config";

export function formatDate(iso: string): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  return fecha.toLocaleString(LOCALE, {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

// Alias para compatibilidad hacia atrás
export const fechaArgentina = formatDate;
