import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandBotAvatar from './BrandBotAvatar';
import { brandMeshBackground, contrastWithWhite, parseCssColor } from './headerBrandPalette';

const palette = ['#112233', '#AA5500', '#22AA44', '#33BBEE', '#333333'];

describe('BrandBotAvatar', () => {
  it('is decorative by default and named when a title is given', () => {
    const { container, rerender } = render(<BrandBotAvatar palette={palette} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    rerender(<BrandBotAvatar palette={palette} title="Asistente sintético" />);
    expect(container.querySelector('svg')).toHaveAttribute('role', 'img');
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'Asistente sintético');
  });

  it('paints only with the published palette and shows each state', () => {
    const { container, rerender } = render(<BrandBotAvatar palette={palette} state="idle" />);
    const gradientColors = Array.from(container.querySelectorAll('radialGradient stop')).map((stop) => stop.getAttribute('stop-color'));
    expect(new Set(gradientColors)).toEqual(new Set(palette.slice(0, 4)));
    expect(container.querySelector('.cbb-smile')).toBeInTheDocument();
    rerender(<BrandBotAvatar palette={palette} state="thinking" />);
    expect(container.querySelectorAll('.cbb-dot')).toHaveLength(3);
    rerender(<BrandBotAvatar palette={palette} state="speaking" />);
    expect(container.querySelector('.cbb-mouth-open')).toBeInTheDocument();
    rerender(<BrandBotAvatar palette={palette} state="listening" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-state', 'listening');
  });

  it('marks reduced motion so its animations stop', () => {
    const { container } = render(<BrandBotAvatar palette={palette} reducedMotion />);
    expect(container.querySelector('svg')).toHaveAttribute('data-reduced-motion', 'true');
  });

  it('animates with its own rules, and a still copy carries none and stays put', () => {
    const { container, rerender } = render(<BrandBotAvatar palette={palette} />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('style')?.textContent).toContain('@keyframes cbb-float');
    expect(svg).not.toHaveAttribute('data-reduced-motion');
    rerender(<BrandBotAvatar palette={palette} still />);
    expect(container.querySelector('svg style')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('data-reduced-motion', 'true');
    // Static look without the stylesheet: the listening ring stays hidden.
    expect(container.querySelector('.cbb-antenna-ring')).toHaveAttribute('opacity', '0');
    expect(container.querySelector('svg')!.style.overflow).toBe('visible');
  });

  it('keeps two instances with separate gradient ids', () => {
    const { container } = render(<><BrandBotAvatar palette={palette} /><BrandBotAvatar palette={palette} /></>);
    const ids = Array.from(container.querySelectorAll('clipPath')).map((clip) => clip.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('brandMeshBackground', () => {
  it('layers each stop darkened for white text', () => {
    const css = brandMeshBackground([{ color: '#FFDD00', x: 0.2, y: 0.1 }, { color: '#33BBEE', x: 0.8, y: 0.9 }])!;
    expect(css).toContain('radial-gradient(circle at 20% 10%');
    expect(css).toContain('linear-gradient(115deg');
    for (const match of css.matchAll(/rgb\(\d+, \d+, \d+\)/g)) {
      expect(contrastWithWhite(parseCssColor(match[0])!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('needs at least two readable stops', () => {
    expect(brandMeshBackground([{ color: '#FFDD00', x: 0, y: 0 }])).toBeNull();
    expect(brandMeshBackground(null)).toBeNull();
  });
});
