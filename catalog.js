import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let catalogCache = null;

async function loadCatalog() {
  if (catalogCache) return catalogCache;

  const file = path.join(__dirname, 'catalog.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);
    catalogCache = Array.isArray(data) ? data : [];
    return catalogCache;
  } catch {
    return [];
  }
}

function normalize(p) {
  const out = {};
  for (const [key, value] of Object.entries(p)) {
    if (value === undefined || value === null || value === '-') continue;
    out[key] = value;
  }

  if (!out.marca && out.bodega) {
    out.marca = out.bodega;
  }

  if (
    out.precio_str === undefined &&
    out.precio_unitario !== undefined &&
    out.precio_unitario !== null
  ) {
    out.precio_str = String(out.precio_unitario);
  }

  return out;
}

export async function getFormattedProducts() {
  const catalog = await loadCatalog();
  const map = new Map();

  for (const item of catalog) {
    const normalized = normalize(item);
    const key = normalized.nombre?.toLowerCase();
    if (!key) continue;

    const variant = {
      talle: normalized.talle ?? normalized.talla ?? null,
      color: normalized.color ?? null,
      precio: normalized.precio_unitario ?? normalized.precio_str ?? null,
    };

    if (!map.has(key)) {
      map.set(key, { ...normalized, variants: [] });
    }

    const entry = map.get(key);
    entry.variants.push(variant);
  }

  return Array.from(map.values()).map((item) => {
    const variantsList = item.variants ?? [];
    const summarizedVariants = variantsList.length
      ? [{ opciones: variantsList }]
      : [];

    const sanitized = { ...item };
    delete sanitized.talle;
    delete sanitized.talla;
    delete sanitized.color;

    return { ...sanitized, variants: summarizedVariants };
  });
}
