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
      const rawTime = stripEmojis(line, "🕑").replace(/hs?\.?$/, "").trim();
      let startTime = rawTime;
      let endTime: string | undefined;
      const range = rawTime.split(/\s+a\s+/i);
      if (range.length === 2) {
        startTime = range[0].trim();
        endTime = range[1].trim();
      }
      const titleLine = lines[i + 1] ? stripEmojis(lines[i + 1], "✅") : "";
      const locationLine = lines[i + 2] ? stripEmojis(lines[i + 2], "📍") : "";
      let nextIndex = i + 3;
      let link = "";
      let image = "";
      if (lines[nextIndex] && lines[nextIndex].startsWith("🔗")) {
        link = stripEmojis(lines[nextIndex], "🔗");
        nextIndex++;
      }
      if (lines[nextIndex] && lines[nextIndex].startsWith("🖼")) {
        image = stripEmojis(lines[nextIndex], "🖼");
        nextIndex++;
      }

      if (currentDay) {
        currentDay.events.push({ startTime, endTime, title: titleLine, location: locationLine, link, image });
      }
      i = nextIndex;
      continue;
    }

    i++;
  }

  return { title, days };
}
