export interface AgendaEvent {
  startTime: string;
  endTime?: string;
  title: string;
  location: string;
  link?: string;
  image?: string;
}

export interface AgendaDay {
  day: string;
  events: AgendaEvent[];
}

export interface Agenda {
  title: string;
  days: AgendaDay[];
}

const DAY_NAMES = new Set([
  "lunes",
  "martes",
  "miercoles",
  "miércoles",
  "jueves",
  "viernes",
  "sabado",
  "sábado",
  "domingo",
]);

const TIME_PREFIXES = [
  "🕐",
  "🕑",
  "🕒",
  "🕓",
  "🕔",
  "🕕",
  "🕖",
  "🕗",
  "🕘",
  "🕙",
  "🕚",
  "🕛",
  "🕜",
  "🕝",
  "🕞",
  "🕟",
  "🕠",
  "🕡",
  "🕢",
  "🕣",
  "🕤",
  "🕥",
  "🕦",
  "🕧",
  "🕰️",
  "⏰",
  "⌚",
  "⏱️",
];

const TITLE_PREFIXES = ["✅", "✔️", "☑️", "•", "-"];
const LOCATION_PREFIXES = ["📍", "📌", "🏛️", "🏟️", "Lugar:", "Lugar -", "Lugar →"];
const LINK_PREFIXES = ["🔗", "➡️", "👉"];
const IMAGE_PREFIXES = ["🖼", "🖼️", "📸"];

const removeDiacritics = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const stripWrapping = (value: string): string => value.replace(/^\*+|\*+$/g, "").trim();

const stripFromPrefixes = (value: string, prefixes: string[]): string => {
  const trimmed = value.trim();
  for (const prefix of prefixes) {
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return trimmed;
};

const cleanDayLabel = (value: string): string =>
  stripWrapping(value)
    .replace(/^[\-–—•·]+/, "")
    .replace(/[:：]+$/, "")
    .trim();

const isDayLine = (value: string): boolean => {
  const cleaned = cleanDayLabel(value);
  if (!cleaned) return false;
  const normalized = removeDiacritics(cleaned.toLowerCase());
  const firstWord = normalized.split(/\s+/, 1)[0];
  return firstWord ? DAY_NAMES.has(firstWord) : false;
};

const isTimeLine = (value: string): boolean => {
  if (!value) return false;
  if (TIME_PREFIXES.some((prefix) => value.startsWith(prefix))) return true;
  return /^(?:[0-2]?\d[:.]\d{2}|[0-2]?\d(?:[:.]\d{2})?)/.test(value);
};

const parseTimeRange = (raw: string): { start: string; end?: string } => {
  const normalized = raw.replace(/hs?\.?$/i, "").replace(/horas?$/i, "").trim();
  const parts = normalized.split(/\s*(?:a|hasta|al|\-|–|—)\s*/i);
  const start = parts[0]?.trim() ?? normalized;
  const end = parts.length > 1 ? parts[1]?.trim() || undefined : undefined;
  return { start, end };
};

// Parse agenda text pasted from WhatsApp style messages
export function parseAgendaText(raw: string): Agenda {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const days: AgendaDay[] = [];
  const headerCandidates: string[] = [];
  let title = "";
  let currentDay: AgendaDay | null = null;

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    if (!title) {
      if (isDayLine(line) || isTimeLine(line)) {
        if (headerCandidates.length > 0) {
          title = headerCandidates[headerCandidates.length - 1];
        } else {
          title = cleanDayLabel(line);
        }
      } else {
        const candidate = stripWrapping(line);
        if (candidate) {
          headerCandidates.push(candidate);
        }
        i++;
        continue;
      }
    }

    if (isDayLine(line)) {
      currentDay = { day: cleanDayLabel(line), events: [] };
      days.push(currentDay);
      i++;
      continue;
    }

    if (isTimeLine(line)) {
      const rawTime = stripFromPrefixes(line, TIME_PREFIXES);
      const { start: startTime, end: endTime } = parseTimeRange(rawTime);
      const titleLine = lines[i + 1] ? stripFromPrefixes(lines[i + 1], TITLE_PREFIXES) : "";

      let nextIndex = i + 2;
      let location = "";
      if (
        lines[nextIndex] &&
        !isDayLine(lines[nextIndex]) &&
        !isTimeLine(lines[nextIndex]) &&
        !LINK_PREFIXES.some((prefix) => lines[nextIndex].startsWith(prefix)) &&
        !IMAGE_PREFIXES.some((prefix) => lines[nextIndex].startsWith(prefix))
      ) {
        location = stripFromPrefixes(lines[nextIndex], LOCATION_PREFIXES);
        nextIndex++;
      }

      let link = "";
      let image = "";
      while (lines[nextIndex]) {
        if (LINK_PREFIXES.some((prefix) => lines[nextIndex].startsWith(prefix))) {
          link = stripFromPrefixes(lines[nextIndex], LINK_PREFIXES);
          nextIndex++;
          continue;
        }
        if (IMAGE_PREFIXES.some((prefix) => lines[nextIndex].startsWith(prefix))) {
          image = stripFromPrefixes(lines[nextIndex], IMAGE_PREFIXES);
          nextIndex++;
          continue;
        }
        break;
      }

      if (currentDay && titleLine) {
        currentDay.events.push({
          startTime,
          endTime,
          title: titleLine,
          location,
          link,
          image,
        });
      }
      i = Math.max(nextIndex, i + 1);
      continue;
    }

    i++;
  }

  if (!title && headerCandidates.length > 0) {
    title = headerCandidates[headerCandidates.length - 1];
  }

  return { title, days };
}
