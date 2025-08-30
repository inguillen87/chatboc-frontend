export interface AgendaEvent {
  time: string;
  title: string;
  location: string;
}

export interface AgendaDay {
  day: string;
  events: AgendaEvent[];
}

export interface Agenda {
  title: string;
  days: AgendaDay[];
}

// Parse agenda text pasted from WhatsApp style messages
export function parseAgendaText(raw: string): Agenda {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title = "";
  const days: AgendaDay[] = [];
  let currentDay: AgendaDay | null = null;

  const isDayLine = (line: string) => line.startsWith("*") && line.endsWith("*");

  const stripEmojis = (line: string, emoji: string) =>
    line.startsWith(emoji) ? line.slice(emoji.length).trim() : line.trim();

  const stripStars = (line: string) => line.replace(/^\*+|\*+$/g, "").trim();

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    if (!title) {
      title = stripStars(line);
      i++;
      continue;
    }

    if (isDayLine(line)) {
      currentDay = { day: stripStars(line), events: [] };
      days.push(currentDay);
      i++;
      continue;
    }

    if (line.startsWith("🕑")) {
      const time = stripEmojis(line, "🕑").replace(/hs?\.?$/, "").trim();
      const titleLine = lines[i + 1] ? stripEmojis(lines[i + 1], "✅") : "";
      const locationLine = lines[i + 2] ? stripEmojis(lines[i + 2], "📍") : "";

      if (currentDay) {
        currentDay.events.push({ time, title: titleLine, location: locationLine });
      }
      i += 3;
      continue;
    }

    i++;
  }

  return { title, days };
}
