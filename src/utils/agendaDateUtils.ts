import type { AgendaEvent } from "@/utils/agendaParser";

const MONTH_KEYWORDS: Array<[string, number]> = [
  ["enero", 0],
  ["ene", 0],
  ["febrero", 1],
  ["feb", 1],
  ["marzo", 2],
  ["mar", 2],
  ["abril", 3],
  ["abr", 3],
  ["mayo", 4],
  ["junio", 5],
  ["jun", 5],
  ["julio", 6],
  ["jul", 6],
  ["agosto", 7],
  ["ago", 7],
  ["septiembre", 8],
  ["sept", 8],
  ["setiembre", 8],
  ["set", 8],
  ["octubre", 9],
  ["oct", 9],
  ["noviembre", 10],
  ["nov", 10],
  ["diciembre", 11],
  ["dic", 11],
];

interface DateParts {
  day?: number;
  month?: number;
  year?: number;
}

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const parseYearValue = (raw: string, referenceYear: number): number => {
  const trimmed = raw.trim();
  if (!trimmed) return referenceYear;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return referenceYear;
  if (trimmed.length >= 3) {
    return parsed;
  }

  const century = Math.floor(referenceYear / 100) * 100;
  let candidate = century + parsed;
  if (candidate < referenceYear - 50) {
    candidate += 100;
  } else if (candidate > referenceYear + 50) {
    candidate -= 100;
  }
  return candidate;
};

const extractDateParts = (text: string, referenceYear: number): DateParts => {
  if (!text) return {};

  const normalized = normalize(text);
  const slashMatch = normalized.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
  if (slashMatch) {
    const day = Number.parseInt(slashMatch[1], 10);
    const month = Number.parseInt(slashMatch[2], 10) - 1;
    const year = slashMatch[3] ? parseYearValue(slashMatch[3], referenceYear) : undefined;
    return { day, month: Number.isFinite(month) ? Math.max(0, Math.min(11, month)) : undefined, year };
  }

  let month: number | undefined;
  for (const [keyword, value] of MONTH_KEYWORDS) {
    if (normalized.includes(keyword)) {
      month = value;
      break;
    }
  }

  const numberMatches = Array.from(normalized.matchAll(/(?<![:\d])(\d{1,2})(?![:\d])/g));
  const dayMatch = numberMatches.find((match) => {
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) && value >= 1 && value <= 31;
  });
  const day = dayMatch ? Number.parseInt(dayMatch[1], 10) : undefined;

  const yearMatch = normalized.match(/(\d{4})/);
  const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : undefined;

  return { day, month, year };
};

interface TimeParts {
  hours: number;
  minutes: number;
}

const extractTimeParts = (text: string): TimeParts | null => {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();

  const colonMatch = cleaned.match(/(\d{1,2})[:.](\d{2})/);
  if (colonMatch) {
    const hours = Number.parseInt(colonMatch[1], 10);
    const minutes = Number.parseInt(colonMatch[2], 10);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return {
        hours: Math.max(0, Math.min(23, hours)),
        minutes: Math.max(0, Math.min(59, minutes)),
      };
    }
  }

  const simpleMatch = cleaned.match(/\b(\d{1,2})\s*(?:hs|h|horas|hrs)\b/);
  if (simpleMatch) {
    const hours = Number.parseInt(simpleMatch[1], 10);
    if (Number.isFinite(hours)) {
      return {
        hours: Math.max(0, Math.min(23, hours)),
        minutes: 0,
      };
    }
  }

  return null;
};

export interface AgendaDateContext {
  referenceDate: Date;
  currentMonth: number;
  currentYear: number;
  lastDate: Date | null;
}

export const createAgendaDateContext = (
  title?: string,
  referenceDate: Date = new Date(),
): AgendaDateContext => {
  const referenceYear = referenceDate.getFullYear();
  const parts = title ? extractDateParts(title, referenceYear) : {};
  return {
    referenceDate,
    currentMonth: parts.month ?? referenceDate.getMonth(),
    currentYear: parts.year ?? referenceYear,
    lastDate: null,
  };
};

const adjustPastCandidate = (
  candidate: Date,
  monthProvided: boolean,
  yearProvided: boolean,
  reference: Date,
): Date => {
  if (yearProvided) return candidate;
  if (!monthProvided) {
    if (candidate < reference) {
      const adjusted = new Date(candidate);
      adjusted.setMonth(adjusted.getMonth() + 1);
      return adjusted;
    }
    return candidate;
  }

  if (candidate < reference) {
    const adjusted = new Date(candidate);
    adjusted.setFullYear(adjusted.getFullYear() + 1);
    return adjusted;
  }
  return candidate;
};

export const resolveDayDate = (
  label: string,
  context: AgendaDateContext,
): Date | null => {
  const parts = extractDateParts(label, context.currentYear);
  if (parts.day === undefined) {
    return context.lastDate ? new Date(context.lastDate) : null;
  }

  let month = parts.month ?? context.currentMonth;
  let year = parts.year ?? context.currentYear;

  if (context.lastDate) {
    if (parts.month === undefined) {
      month = context.lastDate.getMonth();
    }
    if (parts.year === undefined) {
      year = context.lastDate.getFullYear();
    }
  }

  let candidate = new Date(year, month, parts.day);

  if (context.lastDate) {
    if (candidate < context.lastDate && parts.month === undefined && parts.year === undefined) {
      candidate = new Date(context.lastDate);
      candidate.setMonth(candidate.getMonth() + 1, parts.day);
    } else if (candidate < context.lastDate && parts.year === undefined && parts.month !== undefined) {
      candidate = new Date(context.lastDate);
      candidate.setFullYear(candidate.getFullYear() + 1, parts.month, parts.day);
    }
  } else {
    candidate = adjustPastCandidate(
      candidate,
      parts.month !== undefined,
      parts.year !== undefined,
      context.referenceDate,
    );
  }

  context.lastDate = candidate;
  context.currentMonth = candidate.getMonth();
  context.currentYear = candidate.getFullYear();
  return candidate;
};

export const parseDateTimeValue = (
  value: string | undefined,
  fallback: Date | null,
  context: AgendaDateContext,
): Date | null => {
  if (!value?.trim()) {
    return fallback ? new Date(fallback) : null;
  }

  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  const parts = extractDateParts(trimmed, context.currentYear);
  const time = extractTimeParts(trimmed);

  let base: Date | null = null;

  if (parts.day !== undefined) {
    const month = parts.month ?? (fallback ? fallback.getMonth() : context.currentMonth);
    const year = parts.year ?? (fallback ? fallback.getFullYear() : context.currentYear);
    base = new Date(year, month, parts.day);

    if (fallback) {
      if (base < fallback && parts.month === undefined && parts.year === undefined) {
        base = new Date(fallback.getFullYear(), fallback.getMonth(), parts.day);
        if (base < fallback) {
          base.setMonth(base.getMonth() + 1, parts.day);
        }
      } else if (base < fallback && parts.year === undefined && parts.month !== undefined) {
        base = new Date(fallback.getFullYear() + 1, parts.month, parts.day);
      }
    } else {
      base = adjustPastCandidate(
        base,
        parts.month !== undefined,
        parts.year !== undefined,
        context.referenceDate,
      );
    }
  }

  if (!base) {
    if (!fallback) {
      return null;
    }
    base = new Date(fallback);
  }

  if (time) {
    base.setHours(time.hours, time.minutes, 0, 0);
  }

  return base;
};

const formatDateTime = (date: Date): string => {
  const dateFormatter = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)} hs`;
};

export const buildAgendaEventContent = (
  dayLabel: string,
  event: AgendaEvent,
  startDate: Date | null,
  endDate: Date | null,
): string => {
  const parts: string[] = [];

  parts.push(event.title);

  const cleanedDay = dayLabel.trim();
  if (cleanedDay) {
    parts.push(`Día: ${cleanedDay}`);
  }

  if (startDate) {
    if (endDate) {
      const sameDay =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();

      if (sameDay) {
        parts.push(`Horario: ${formatDateTime(startDate)} - ${new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(endDate)} hs`);
      } else {
        parts.push(`Desde: ${formatDateTime(startDate)}`);
        parts.push(`Hasta: ${formatDateTime(endDate)}`);
      }
    } else {
      parts.push(`Horario: ${formatDateTime(startDate)}`);
    }
  } else if (event.startTime) {
    parts.push(`Horario: ${event.startTime}`);
  }

  if (event.location) {
    parts.push(`Lugar: ${event.location}`);
  }
  if (event.link) {
    parts.push(`Enlace: ${event.link}`);
  }

  return parts.join("\n");
};
