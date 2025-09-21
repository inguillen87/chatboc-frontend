const toDate = (value: string | number | Date) => {
  if (!value && value !== 0) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const formatARDate = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(date);

export const fmtAR = (iso: string | number | Date) => {
  const date = toDate(iso);

  if (!date) {
    return "Fecha no disponible";
  }

  return formatARDate(date);
};

export const shiftDateByHours = (
  value: string | number | Date,
  hours: number,
) => {
  const date = toDate(value);

  if (!date) {
    return null;
  }

  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

export const fmtARWithOffset = (
  iso: string | number | Date,
  hoursOffset: number,
) => {
  const shifted = shiftDateByHours(iso, hoursOffset);

  if (!shifted) {
    return "Fecha no disponible";
  }

  return formatARDate(shifted);
};
