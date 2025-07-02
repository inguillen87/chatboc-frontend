export function truncateText(text: string | undefined | null, maxLength: number = 90): string {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
}
