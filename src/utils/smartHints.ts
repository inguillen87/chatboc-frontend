export interface SmartHintResult {
  cleanText: string;
  hint: string | null;
}

export function extractSmartHint(text: string): SmartHintResult {
  if (!text) return { cleanText: "", hint: null };

  const hintPrefixes = ["💡 Tip:", "💡 Consejo:", "Tip:", "Consejo:", "Sugerencia:"];
  const lines = text.split('\n');
  let hint: string | null = null;
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const prefix = hintPrefixes.find(p => trimmed.startsWith(p));

    if (prefix) {
      // Found a hint line
      hint = trimmed.slice(prefix.length).trim();
    } else {
      cleanLines.push(line);
    }
  }

  return {
    cleanText: cleanLines.join('\n').trim(),
    hint
  };
}
