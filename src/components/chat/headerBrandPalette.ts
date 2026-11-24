// Colores de la cabecera del widget a partir de la marca del tenant.
//
// La cabecera usa texto y controles blancos, así que cada color de marca se
// oscurece lo justo para que el blanco tenga contraste AA (4.5:1) sin perder el
// tono. Los valores que no se pueden leer (variables CSS, nombres) se mezclan
// con un azul noche en CSS como resguardo.

const NIGHT = { r: 2, g: 6, b: 23 }; // #020617
const MAX_LUMINANCE_FOR_WHITE_TEXT = 0.175; // (1.05 / 4.5) - 0.05, con margen

type Rgb = { r: number; g: number; b: number };

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export const parseCssColor = (value: unknown): Rgb | null => {
  if (typeof value !== 'string') return null;
  const color = value.trim().toLowerCase();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((d) => d + d).join('') : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
    };
  }
  const rgb = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/);
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map(Number);
    if ([r, g, b].every((channel) => channel <= 255)) return { r, g, b };
  }
  return null;
};

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ({ r, g, b }: Rgb) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

export const contrastWithWhite = (color: Rgb) => 1.05 / (relativeLuminance(color) + 0.05);

const mix = (color: Rgb, toward: Rgb, amount: number): Rgb => ({
  r: clampByte(color.r + (toward.r - color.r) * amount),
  g: clampByte(color.g + (toward.g - color.g) * amount),
  b: clampByte(color.b + (toward.b - color.b) * amount),
});

/** Devuelve un color CSS con contraste AA para texto blanco, o null si no hay color. */
export const readableHeaderColor = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = parseCssColor(value);
  if (!parsed) return `color-mix(in srgb, ${value.trim()} 72%, #020617)`;
  let amount = 0;
  let color = parsed;
  while (relativeLuminance(color) > MAX_LUMINANCE_FOR_WHITE_TEXT && amount < 1) {
    amount = Math.min(1, amount + 0.04);
    color = mix(parsed, NIGHT, amount);
  }
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
};

export const DEFAULT_HEADER_BACKGROUND =
  'linear-gradient(115deg, #071a51 0%, color-mix(in srgb, hsl(var(--primary)) 78%, #0d35c3) 100%)';

// A secondary color without hue (white, grays) is usually the tenant's surface
// color, not a brand tone: darkened it turns into a dull gray end stop.
const isNeutral = (color: Rgb) => Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) < 24;

const deeperTone = (value: unknown): string | null => {
  const parsed = parseCssColor(value);
  const readable = parseCssColor(readableHeaderColor(value) || '');
  if (!parsed || !readable || isNeutral(parsed)) return null;
  const deeper = mix(readable, NIGHT, 0.32);
  return `rgb(${deeper.r}, ${deeper.g}, ${deeper.b})`;
};

/** Degradado de la cabecera con la marca del tenant; sin marca, el de la plataforma. */
export const headerBackground = (start?: string | null, end?: string | null): string => {
  const from = readableHeaderColor(start);
  const endColor = parseCssColor(end);
  const to = (endColor && isNeutral(endColor) && deeperTone(start)) || readableHeaderColor(end);
  if (!from && !to) return DEFAULT_HEADER_BACKGROUND;
  return `linear-gradient(115deg, ${from || to} 0%, ${to || from} 100%)`;
};

/**
 * Brand mesh for the header: each published stop, darkened just enough for
 * white text (AA), layered as radial gradients at its position. Returns null
 * when fewer than two stops can be read.
 */
export const brandMeshBackground = (stops?: { color: string; x: number; y: number }[] | null): string | null => {
  const readable = (stops || [])
    .map((stop) => ({ ...stop, css: readableHeaderColor(stop.color) }))
    .filter((stop) => stop.css && parseCssColor(stop.color));
  if (readable.length < 2) return null;
  const layers = readable.map((stop) =>
    `radial-gradient(circle at ${Math.round(stop.x * 100)}% ${Math.round(stop.y * 100)}%, ${stop.css} 0%, transparent 62%)`);
  return [...layers, `linear-gradient(115deg, ${readable[0].css} 0%, ${readable[readable.length - 1].css} 100%)`].join(', ');
};
