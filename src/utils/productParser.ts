export interface ParsedProduct {
  nombre: string;
  presentacion?: string;
  precio_unitario?: string;
  marca?: string;
  imagen_url?: string;
}

export function parseProductString(text: string): ParsedProduct {
  let remaining = text.trim();
  let precio = '';
  const precioMatch = remaining.match(/(?:ARS\s*)?\$?\s*([0-9.,]+)/);
  if (precioMatch) {
    precio = precioMatch[1];
    remaining = remaining.replace(precioMatch[0], '').trim();
  }
  const presentRegex = /(caja\s*x\s*\d+|pack\s*x\s*\d+|\bunidad\b|\d+\s*unidades)/i;
  let presentacion = '';
  const presMatch = remaining.match(presentRegex);
  if (presMatch) {
    presentacion = presMatch[0].trim();
    remaining = remaining.replace(presMatch[0], '').replace(/[-–]\s*$/, '').trim();
  }
  const nombre = remaining.trim();
  return {
    nombre,
    presentacion: presentacion || undefined,
    precio_unitario: precio || undefined,
  };
}

export function parseProductMessage(text: string): ParsedProduct[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed);
    const arr = Array.isArray(data) ? data : [data];
    const products: ParsedProduct[] = arr
      .filter((p) => p && typeof p === 'object' && p.nombre)
      .map((p) => ({
        nombre: p.nombre,
        presentacion: p.presentacion,
        precio_unitario:
          p.precio_unitario !== undefined && p.precio_unitario !== null
            ? String(p.precio_unitario)
            : undefined,
        marca: p.marca,
        imagen_url: p.imagen_url,
      }));
    return products.length > 0 ? products : null;
  } catch {
    // not JSON, try line parsing
  }
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const products: ParsedProduct[] = [];
  let found = false;
  for (const line of lines) {
    const parsed = parseProductString(line);
    if (
      parsed.precio_unitario ||
      parsed.presentacion ||
      parsed.nombre !== line
    ) {
      found = true;
      products.push(parsed);
    }
  }
  return found ? products : null;
}
