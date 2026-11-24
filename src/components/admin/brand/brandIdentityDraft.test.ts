import { describe, expect, it } from 'vitest';
import { draftFromStored, emptyBrandIdentityDraft, payloadFromDraft } from './brandIdentityDraft';

// Synthetic identity; values only exercise the contract.
const stored = {
  palette: ['#112233', '#445566', '#778899'],
  gradient_stops: [{ color: '#112233', x: 0.1, y: 0.2 }, { color: '#445566', x: 0.9, y: 0.85 }],
  text_color: '#778899',
  typography: { family: 'Synthetic Sans', fallback: 'system-ui, sans-serif',
    stylesheet_url: 'https://fonts.googleapis.com/css2?family=Synthetic+Sans&display=swap', letter_spacing: '-0.02em' },
  logo: { on_light: 'https://assets.example.test/light.png', mark: 'https://assets.example.test/mark.png', alt: 'Organización sintética' },
  bubble_style: 'globa' as const,
  avatar: { style: 'brand_bot' as const },
};

describe('brand identity draft', () => {
  it('round-trips a stored identity, with positions as percentages in the form', () => {
    const draft = draftFromStored(stored);
    expect(draft.stops[0]).toEqual({ color: '#112233', x: '10', y: '20' });
    const result = payloadFromDraft(draft);
    expect(result).toEqual({ ok: true, value: stored });
  });

  it('omits defaults and empty optional groups', () => {
    const result = payloadFromDraft({ ...emptyBrandIdentityDraft(), palette: ['#aabbcc', ' #ddeeff '] });
    expect(result).toEqual({ ok: true, value: { palette: ['#AABBCC', '#DDEEFF'] } });
  });

  it('explains each invalid field like the backend would reject it', () => {
    const result = payloadFromDraft({
      ...draftFromStored(stored),
      palette: ['#112233'],
      stops: [{ color: '#112233', x: '120', y: '0' }],
      textColor: 'gris',
      family: 'X; } body {',
      stylesheetUrl: 'https://evil.example/font.css',
      letterSpacing: '2px',
      logoOnDark: 'http://insecure.example/logo.png',
      logoAlt: '<b>',
    });
    expect('errors' in result && Object.keys(result.errors).sort()).toEqual(
      ['family', 'letterSpacing', 'logoAlt', 'logos', 'palette', 'stops', 'stylesheetUrl', 'textColor'],
    );
  });

  it('needs a family for typography settings and a logo for its alternative text', () => {
    const result = payloadFromDraft({ ...emptyBrandIdentityDraft(), fallback: 'system-ui', logoAlt: 'Logo' });
    expect('errors' in result && result.errors).toMatchObject({ family: expect.any(String), logoAlt: expect.any(String) });
  });
});
