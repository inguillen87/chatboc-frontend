const fs = require('fs');
const path = require('path');

function loadCatalog() {
  const file = path.join(__dirname, '..', 'catalog.json');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
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

  if (out.precio_str === undefined && out.precio_unitario !== undefined && out.precio_unitario !== null) {
    out.precio_str = String(out.precio_unitario);
  }

  return out;
}

function getFormattedProducts() {
  const catalog = loadCatalog();
  const map = new Map();
  for (const item of catalog) {
    const n = normalize(item);
    const key = `${n.nombre}|${n.marca}`;
    if (map.has(key)) {
      const entry = map.get(key);
      if (!entry.variants) entry.variants = [];
      entry.variants.push(n);
    } else {
      map.set(key, { ...n });
    }
  }
  return Array.from(map.values());
}

module.exports = { getFormattedProducts };
