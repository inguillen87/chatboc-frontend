import React from "react";

export type Product = Record<string, any>;

export type Format = "react" | "markdown";

interface FormatOptions {
  output?: Format;
}

function inferCategory(p: Product): "wine" | "clothing" | "hardware" | "other" {
  if (p.bodega || p.variedad) return "wine";
  if (p.talle || p.color) return "clothing";
  if (p.herramienta || p.modelo || p.medida) return "hardware";
  return "other";
}

function groupProducts(products: Product[]): (Product & { variants?: Product[] })[] {
  const grouped = new Map<string, Product & { variants?: Product[] }>();
  for (const p of products) {
    const key = `${p.nombre || ""}|${p.marca || p.bodega || ""}`;
    const entry = grouped.get(key);
    if (entry) {
      if (!entry.variants) entry.variants = [];
      entry.variants.push(p);
    } else {
      grouped.set(key, { ...p });
    }
  }
  return Array.from(grouped.values());
}

function formatPrice(p: Product): string | undefined {
  const price = p.precio_str || p.precio_unitario || p.precio;
  if (!price) return undefined;
  const num = Number(String(price).replace(/[^0-9.,]/g, "").replace(",", "."));
  if (isNaN(num)) return String(price);
  const currency = p.moneda || "ARS";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
    }).format(num);
  } catch {
    return String(price);
  }
}

function collectValues(product: Product, key: string): string | undefined {
  const values = new Set<string>();
  if (product[key]) values.add(String(product[key]));
  if (Array.isArray(product.variants)) {
    for (const v of product.variants) {
      if (v[key]) values.add(String(v[key]));
    }
  }
  const arr = Array.from(values);
  return arr.length ? arr.join(", ") : undefined;
}

function renderReact(product: Product & { variants?: Product[] }, key: number) {
  const category = inferCategory(product);
  const price = formatPrice(product);
  const stock = product.stock;
  const details: string[] = [];

  if (category === "wine") {
    if (product.bodega) details.push(`Bodega: ${product.bodega}`);
    if (product.variedad) details.push(`Variedad: ${product.variedad}`);
    if (product.presentacion) details.push(`Presentación: ${product.presentacion}`);
    if (product.origen) details.push(`Origen: ${product.origen}`);
  } else if (category === "clothing") {
    if (product.marca) details.push(`Marca: ${product.marca}`);
    const talles = collectValues(product, "talle");
    if (talles) details.push(`Talle: ${talles}`);
    const colores = collectValues(product, "color");
    if (colores) details.push(`Color: ${colores}`);
  } else if (category === "hardware") {
    if (product.marca) details.push(`Marca: ${product.marca}`);
    if (product.modelo) details.push(`Modelo: ${product.modelo}`);
    if (product.medida) details.push(`Medida: ${product.medida}`);
  } else {
    if (product.marca) details.push(`Marca: ${product.marca}`);
    if (product.presentacion) details.push(product.presentacion);
  }

  return (
    <div
      key={key}
      className="border border-border rounded-xl p-3 bg-card shadow-sm flex flex-col gap-1 w-56"
    >
      <h4 className="font-semibold text-sm text-foreground">{product.nombre}</h4>
      {details.map((d) => (
        <p key={d} className="text-xs text-muted-foreground">
          {d}
        </p>
      ))}
      {price && <p className="font-bold text-sm text-primary">{price}</p>}
      {stock !== undefined && stock !== null && (
        <p className="text-xs text-muted-foreground">Stock: {stock}</p>
      )}
    </div>
  );
}

function renderMarkdown(product: Product & { variants?: Product[] }): string {
  const category = inferCategory(product);
  const price = formatPrice(product);
  const parts: string[] = [];
  const prefix =
    {
      wine: "🍷",
      clothing: "👕",
      hardware: "🔧",
      other: "🛒",
    }[category] || "";
  parts.push(`${prefix} ${product.nombre}`);
  if (category === "wine") {
    if (product.bodega) parts.push(`(${product.bodega})`);
    if (product.variedad) parts.push(`Variedad: ${product.variedad}`);
    if (product.presentacion) parts.push(product.presentacion);
  } else if (category === "clothing") {
    if (product.marca) parts.push(`(${product.marca})`);
    const talles = collectValues(product, "talle");
    if (talles) parts.push(`Talle: ${talles}`);
    const colores = collectValues(product, "color");
    if (colores) parts.push(`Color: ${colores}`);
  } else if (category === "hardware") {
    if (product.marca) parts.push(`(${product.marca})`);
    if (product.modelo) parts.push(`Modelo: ${product.modelo}`);
    if (product.medida) parts.push(`Medida: ${product.medida}`);
  } else {
    if (product.marca) parts.push(`(${product.marca})`);
    if (product.presentacion) parts.push(product.presentacion);
  }

  if (price) parts.push(price);
  if (product.stock !== undefined && product.stock !== null) {
    parts.push(`Stock: ${product.stock}`);
  }

  return parts.join(" | ");
}

export function formatProducts(
  rawProducts: Product[],
  options: FormatOptions = { output: "react" },
): JSX.Element | string {
  const grouped = groupProducts(rawProducts);
  if (options.output === "markdown") {
    return grouped.map((p) => renderMarkdown(p)).join("\n");
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      {grouped.map((p, i) => renderReact(p, i))}
    </div>
  );
}

export type { FormatOptions };
