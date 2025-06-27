export interface ParsedProduct {
  [key: string]: any;
}



export function parseProductMessage(text: string): ParsedProduct[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed);
    const arr = Array.isArray(data) ? data : [data];
    const products: ParsedProduct[] = arr.filter(
      (p) => p && typeof p === 'object'
    );
    return products.length > 0 ? products : null;
  } catch {
    return null;
  }
}
