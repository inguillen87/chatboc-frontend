// utils/fecha.ts
export function fechaArgentina(iso: string): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  return fecha.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).replace(",", "");
}
