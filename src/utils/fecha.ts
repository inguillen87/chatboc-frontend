// utils/fecha.ts
import { TIMEZONE, LOCALE } from "../config";

export function formatDate(
  iso: string,
  timezone: string = TIMEZONE,
  locale: string = LOCALE
): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  return fecha
    .toLocaleString(locale, {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

// Alias para compatibilidad hacia atrás
export const fechaArgentina = (iso: string) => formatDate(iso);
