export const fmtAR = (iso: string | number | Date) => {
  const date = iso ? new Date(iso) : null;
  if (!date || isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(date);
};
