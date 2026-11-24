import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { brandChartPalette, readPageBrandAccents, useBrandChartPalette } from './publicBrandIdentity';

const FALLBACK = ['#2563eb', '#7c3aed', '#059669'] as const;

const publish = (accents: string[]) => {
  const root = document.documentElement;
  root.dataset.brandIdentity = 'published';
  accents.forEach((color, index) => root.style.setProperty(`--brand-accent-${index + 1}`, color));
};

const Probe = () => <output data-testid="palette">{useBrandChartPalette(FALLBACK).join(',')}</output>;

afterEach(() => {
  const root = document.documentElement;
  delete root.dataset.brandIdentity;
  for (let index = 1; index <= 4; index += 1) root.style.removeProperty(`--brand-accent-${index}`);
});

describe('brand chart palette', () => {
  it('puts the distinct brand accents first and keeps the remaining own colors', () => {
    expect(brandChartPalette(['#FD8D00', '#2563EB'], FALLBACK)).toEqual(['#FD8D00', '#2563EB', '#7c3aed', '#059669']);
    expect(brandChartPalette([], FALLBACK)).toEqual([...FALLBACK]);
  });

  it('reads only a published identity and skips repeated or invalid accents', () => {
    const root = document.documentElement;
    root.style.setProperty('--brand-accent-1', '#FD8D00');
    expect(readPageBrandAccents(root)).toEqual([]);

    root.dataset.brandIdentity = 'published';
    root.style.setProperty('--brand-accent-2', '#fd8d00');
    root.style.setProperty('--brand-accent-3', 'url(x)');
    root.style.setProperty('--brand-accent-4', '#1DBFFE');
    expect(readPageBrandAccents(root)).toEqual(['#FD8D00', '#1DBFFE']);
  });

  it('follows the brand when it arrives and when it is withdrawn', async () => {
    render(<Probe />);
    expect(screen.getByTestId('palette').textContent).toBe(FALLBACK.join(','));

    await act(async () => {
      publish(['#FD8D00', '#F75318', '#1DBFFE', '#0ABB03']);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('palette').textContent).toBe(
      ['#FD8D00', '#F75318', '#1DBFFE', '#0ABB03', ...FALLBACK].join(','),
    );

    await act(async () => {
      delete document.documentElement.dataset.brandIdentity;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId('palette').textContent).toBe(FALLBACK.join(','));
  });
});
