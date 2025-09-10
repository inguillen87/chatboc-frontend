export const fmtAR = (iso: string | number | Date) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(iso));
