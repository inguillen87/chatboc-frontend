const fs = require('fs');
const path = require('path');

function loadCatalog() {
  const file = path.join(__dirname, 'catalog.json');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function normalize(p) {
  return {
    nombre: p.nombre || '',
    marca: p.marca || p.bodega || '',
    presentacion: p.presentacion || '',
    precio_str:
      p.precio_str !== undefined && p.precio_str !== null
        ? String(p.precio_str)
        : p.precio_unitario !== undefined && p.precio_unitario !== null
        ? String(p.precio_unitario)
        : '',
    imagen_url: p.imagen_url || '',
    talle: p.talle || '',
    color: p.color || '',
    variedad: p.variedad || '',
    modelo: p.modelo || '',
    medida: p.medida || '',
    descripcion: p.descripcion || '',
    stock: p.stock !== undefined && p.stock !== null ? p.stock : '',
  };
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
