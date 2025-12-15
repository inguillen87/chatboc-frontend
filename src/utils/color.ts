export function hexToHsl(hex: string): string {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length !== 3 && normalized.length !== 6) {
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
