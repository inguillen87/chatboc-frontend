export interface ParsedProduct {
  nombre: string;
  presentacion?: string;
  precio_unitario?: string;
  marca?: string;
  imagen_url?: string;
}

function sanitizeParsedProducts(products: ParsedProduct[]): ParsedProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (!p.nombre) return false;
    const hasInfo =
      (p.presentacion && p.presentacion.trim() !== '') ||
      (p.precio_unitario && p.precio_unitario.trim() !== '') ||
      (p.marca && p.marca.trim() !== '') ||
      (p.imagen_url && p.imagen_url.trim() !== '');
    if (!hasInfo) return false;
    const key = `${p.nombre}|${p.presentacion || ''}|${p.precio_unitario || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterProducts(
  products: ParsedProduct[],
  query: string,
): ParsedProduct[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return products;
  return products.filter((p) => {
    const searchable = (
      p.nombre + " " + (p.presentacion || "")
    ).toLowerCase();
    return terms.every((t) => searchable.includes(t));
  });
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
    const sanitized = sanitizeParsedProducts(products);
    return sanitized.length > 0 ? sanitized : null;
  } catch {
    // not JSON, try line parsing
  }
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const groups: string[][] = [];
  let current: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[\-*•]+\s*/, "");
    if (/^\$[1.]?$/.test(line)) {
      continue; // evitar líneas sueltas con símbolos de precio
    }
    if (/^ART\b/i.test(line) && current.length) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) groups.push(current);

  const products: ParsedProduct[] = [];
  for (const g of groups) {
    const joined = g.join(" ");
    const parsed = parseProductString(joined);
    if (parsed.nombre) {
      products.push(parsed);
    }
  }

  const sanitized = sanitizeParsedProducts(products);

  return sanitized.length > 0 ? sanitized : null;
}
