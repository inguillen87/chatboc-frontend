export function hexToHsl(hex: string): string {
  const normalized = hex.trim().replace('#', '');
  if (!/^(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(normalized)) {
    return '217 100% 50%';
  }
  const r = parseInt(normalized.length === 3 ? normalized[0] + normalized[0] : normalized.substring(0,2), 16) / 255;
  const g = parseInt(normalized.length === 3 ? normalized[1] + normalized[1] : normalized.substring(2,4), 16) / 255;
  const b = parseInt(normalized.length === 3 ? normalized[2] + normalized[2] : normalized.substring(4,6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Shadcn variables contain HSL channels, never a raw CSS HEX/function. */
export function normalizeColorHsl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  if (/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(color)) return hexToHsl(color);
  const channels = color.replace(/^hsl\((.*)\)$/i, '$1').trim();
  const match = /^(-?\d+(?:\.\d+)?)(?:deg)?(?:\s+|\s*,\s*)(\d+(?:\.\d+)?)%(?:\s+|\s*,\s*)(\d+(?:\.\d+)?)%$/.exec(channels);
  if (!match) return null;
  const [h, s, l] = match.slice(1).map(Number);
  if (![h, s, l].every(Number.isFinite) || s > 100 || l > 100) return null;
  return `${((h % 360) + 360) % 360} ${s}% ${l}%`;
}

const colorLuminance = (color: string): number => {
  const [h, saturation, lightness] = color.split(' ').map(parseFloat);
  const s = saturation / 100, l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = l - chroma / 2;
  const rgb = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x]
    : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgb.map(channel => channel + m).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
};

/** Retain the configured text when it meets 4.5:1; otherwise choose readable text. */
export function accessibleForegroundHsl(background: string, preferred?: unknown): string {
  const normalizedBackground = normalizeColorHsl(background);
  if (!normalizedBackground) return '0 0% 100%';
  const luminance = colorLuminance(normalizedBackground);
  const normalizedPreferred = normalizeColorHsl(preferred);
  if (normalizedPreferred) {
    const foreground = colorLuminance(normalizedPreferred);
    if ((Math.max(luminance, foreground) + 0.05) / (Math.min(luminance, foreground) + 0.05) >= 4.5) return normalizedPreferred;
  }
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '0 0% 0%' : '0 0% 100%';
}

export function getContrastColorHsl(hex: string): string {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length !== 3 && normalized.length !== 6) {
    return '0 0% 100%'; // Default white
  }

  const r = parseInt(normalized.length === 3 ? normalized[0] + normalized[0] : normalized.substring(0,2), 16);
  const g = parseInt(normalized.length === 3 ? normalized[1] + normalized[1] : normalized.substring(2,4), 16);
  const b = parseInt(normalized.length === 3 ? normalized[2] + normalized[2] : normalized.substring(4,6), 16);

  // Calculate YIQ brightness
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  // Returns black for bright colors, white for dark colors
  return (yiq >= 128) ? '0 0% 0%' : '0 0% 100%';
}
