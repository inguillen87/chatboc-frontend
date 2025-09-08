export function simplify(text: string): string {
  const parts = text
    .split(/(?<=[\.\!\?])\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = parts.flatMap((p) => (p.length > 140 ? p.split(/,|;|\sy\s/gi) : [p]));
  return chunks.map((c) => `• ${c.trim()}`).join('\n');
}

