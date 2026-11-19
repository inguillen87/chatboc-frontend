import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureOptionalFonts, resetOptionalFontsForTests } from './optionalFonts';
import { applyAccessibilityPrefs } from '@/components/chat/AccessibilityToggle';

const links = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[data-optional-font]')];
afterEach(() => {
  links().forEach(link => link.remove());
  resetOptionalFontsForTests();
  document.documentElement.className = '';
});

describe('optional typefaces', () => {
  it('requests a family once, only when it leads the applied stack', () => {
    ensureOptionalFonts('Montserrat, sans-serif');
    ensureOptionalFonts('Montserrat, sans-serif');
    ensureOptionalFonts('"Open Sans", sans-serif');
    expect(links().map(link => link.dataset.optionalFont)).toEqual(['Montserrat', 'Open Sans']);
    expect(links()[0]).toHaveAttribute('rel', 'stylesheet');
    expect(links()[0].href).toBe('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
    expect(links()[1].href).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
  });

  it('ignores the default face, system fallbacks, unknown names and empty values', () => {
    for (const stack of ['Inter, sans-serif', 'system-ui, -apple-system, Segoe UI, Roboto, Arial', 'Comic Sans MS', '', null, undefined])
      ensureOptionalFonts(stack);
    expect(links()).toEqual([]);
  });

  it('requests the spaced-reading face only while that accessibility mode is on', () => {
    const off = { dyslexia: false, simplified: false, highContrast: false, largeControls: false, captions: false, reducedMotion: false };
    applyAccessibilityPrefs(off as never);
    expect(links()).toEqual([]);
    applyAccessibilityPrefs({ ...off, dyslexia: true } as never);
    expect(links().map(link => link.dataset.optionalFont)).toEqual(['Lexend']);
    expect(document.documentElement).toHaveClass('a11y-dyslexia');
  });

  it('keeps the global stylesheet to the one face every page uses', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const imports = css.match(/@import url\([^)]*fonts\.googleapis\.com[^)]*\)/g) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain('family=Inter');
  });
});
