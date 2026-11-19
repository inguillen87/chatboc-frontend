// Typefaces only some organizations or accessibility modes use. Their
// stylesheets are requested when one is actually applied, instead of on every
// page load: each one is a render-blocking request on a slow connection.
const OPTIONAL_FONTS: Record<string, string> = {
  'Lexend': 'family=Lexend',
  'Roboto': 'family=Roboto:wght@400;500;700',
  'Montserrat': 'family=Montserrat:wght@400;500;600;700',
  'Open Sans': 'family=Open+Sans:wght@400;600;700',
};
const requested = new Set<string>();

/** Request the stylesheet of every optional family that leads the given font stack. */
export function ensureOptionalFonts(stack: string | null | undefined): void {
  if (typeof document === 'undefined' || typeof stack !== 'string') return;
  // System fallbacks listed later in a stack (for example "…, Segoe UI, Roboto") are not requests.
  const leading = stack.split(',')[0]?.trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (!leading) return;
  for (const [family, query] of Object.entries(OPTIONAL_FONTS)) {
    if (family.toLowerCase() !== leading || requested.has(family)) continue;
    requested.add(family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    link.dataset.optionalFont = family;
    document.head.appendChild(link);
  }
}

/** Test seam: forget what was requested (the links themselves are removed by the caller). */
export function resetOptionalFontsForTests(): void { requested.clear(); }
