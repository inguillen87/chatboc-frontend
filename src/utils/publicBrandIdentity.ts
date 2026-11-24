/**
 * Identidad de marca pública de una organización (`public.brand_identity.v1`).
 *
 * Lectura cerrada: cualquier campo fuera del contrato se descarta y, si la
 * paleta no es válida, no hay identidad. El frontend nunca inventa colores,
 * tipografías ni logos de una organización: sólo muestra lo que publica el
 * backend.
 */
export interface BrandGradientStop { color: string; x: number; y: number }
export interface BrandTypography { family: string; fallback?: string; stylesheetUrl?: string; letterSpacing?: string }
export interface BrandLogo { onLight?: string; onDark?: string; mark?: string; alt?: string }
export interface PublicBrandIdentity {
  palette: string[];
  gradientStops: BrandGradientStop[];
  textColor?: string;
  typography?: BrandTypography;
  logo?: BrandLogo;
  bubbleStyle: 'default' | 'globa';
  avatarStyle: 'chatboc_bot' | 'brand_bot';
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/;
const FALLBACK = /^[A-Za-z0-9 ,"'-]{1,160}$/;
const STYLESHEET = /^https:\/\/fonts\.googleapis\.com\/css2\?[A-Za-z0-9=&:;@,.+%_-]{1,400}$/;
const ASSET = /^https:\/\/[A-Za-z0-9.-]{1,120}(?::[0-9]{2,5})?\/[A-Za-z0-9/._~%-]{1,380}$/;
const SPACING = /^-?(?:0?\.[0-9]{1,3}|0)em$/;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const hex = (value: unknown) => (typeof value === 'string' && HEX.test(value) ? value.toUpperCase() : null);
const matching = (value: unknown, pattern: RegExp) =>
  typeof value === 'string' && pattern.test(value.trim()) ? value.trim() : undefined;
const unit = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;

export function readPublicBrandIdentity(payload: unknown): PublicBrandIdentity | null {
  const source = record(payload);
  if (!source || source.contract_version !== 'public.brand_identity.v1' || !Array.isArray(source.palette)) return null;
  const palette = source.palette.map(hex);
  if (palette.length < 2 || palette.length > 6 || palette.some((color) => !color)) return null;

  const gradientStops: BrandGradientStop[] = [];
  if (Array.isArray(source.gradient_stops) && source.gradient_stops.length >= 2 && source.gradient_stops.length <= 6) {
    for (const item of source.gradient_stops) {
      const stop = record(item);
      const color = hex(stop?.color), x = unit(stop?.x), y = unit(stop?.y);
      if (!color || x === null || y === null) { gradientStops.length = 0; break; }
      gradientStops.push({ color, x, y });
    }
  }

  const typographySource = record(source.typography);
  const family = matching(typographySource?.family, FAMILY);
  const typography: BrandTypography | undefined = family ? {
    family,
    fallback: matching(typographySource?.fallback, FALLBACK),
    stylesheetUrl: matching(typographySource?.stylesheet_url, STYLESHEET),
    letterSpacing: matching(typographySource?.letter_spacing, SPACING),
  } : undefined;

  const logoSource = record(source.logo);
  const logo: BrandLogo | undefined = logoSource ? {
    onLight: matching(logoSource.on_light, ASSET),
    onDark: matching(logoSource.on_dark, ASSET),
    mark: matching(logoSource.mark, ASSET),
    alt: typeof logoSource.alt === 'string' && logoSource.alt.trim() && !/[<>]/.test(logoSource.alt)
      ? logoSource.alt.trim().slice(0, 120) : undefined,
  } : undefined;

  const avatar = record(source.avatar);
  return {
    palette: palette as string[],
    gradientStops,
    textColor: hex(source.text_color) ?? undefined,
    typography,
    logo: logo && (logo.onLight || logo.onDark || logo.mark) ? logo : undefined,
    bubbleStyle: source.bubble_style === 'globa' ? 'globa' : 'default',
    avatarStyle: avatar?.style === 'brand_bot' ? 'brand_bot' : 'chatboc_bot',
  };
}

/** Colores del gradiente de marca en orden; sin paradas, la paleta sin el color de texto. */
export function brandGradientColors(identity: PublicBrandIdentity): string[] {
  if (identity.gradientStops.length) return identity.gradientStops.map((stop) => stop.color);
  return identity.palette.filter((color) => color !== identity.textColor);
}

/** Pila tipográfica con la familia publicada primero y siempre un respaldo del sistema. */
export function brandFontStack(typography: BrandTypography | undefined): string | undefined {
  if (!typography) return undefined;
  const fallback = typography.fallback || 'system-ui, sans-serif';
  return `"${typography.family}", ${fallback}`;
}

const loadedStylesheets = new Set<string>();

/** Carga una sola vez la hoja de fuentes publicada (sólo Google Fonts, validada arriba). */
export function ensureBrandStylesheet(url: string | undefined, doc: Document | undefined = typeof document === 'undefined' ? undefined : document) {
  if (!url || !doc || loadedStylesheets.has(url) || !STYLESHEET.test(url)) return;
  loadedStylesheets.add(url);
  if (Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some((link) => link.getAttribute('href') === url)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.chatbocBrandFont = 'true';
  doc.head.appendChild(link);
}
