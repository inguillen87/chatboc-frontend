import { describe, expect, it } from 'vitest';

import { buildMapClusterPopupContent } from './MapLibreMap';

describe('MapLibreMap popup content', () => {
  it('renders point properties as text instead of executable HTML', () => {
    const node = buildMapClusterPopupContent({
      properties: {
        id: '378430<script>',
        ticket: 'M-378430',
        categoria: '<img src=x onerror=alert(1)>',
        distrito: '<b>Centro</b>',
        direccion: '<script>alert(1)</script> Don Bosco 55',
      },
    });

    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelector('script')).toBeNull();
    expect(node.querySelector('b')).toBeNull();
    expect(node.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(node.textContent).toContain('<script>alert(1)</script> Don Bosco 55');
    expect(node.innerHTML).toContain('&lt;img');
    expect(node.innerHTML).toContain('&lt;script&gt;');
    expect(node.querySelector('a')?.getAttribute('href')).toBe('/chat/378430%3Cscript%3E');
  });

  it('keeps cluster analytics safe while preserving ticket actions', () => {
    const node = buildMapClusterPopupContent({
      cluster: {
        id: '<cluster>',
        lat: -33.0,
        lng: -68.0,
        weight: 3,
        totalWeight: 8,
        averageWeight: 4,
        clusterSize: 2,
        barrio: '<b>Centro</b>',
        sampleTickets: ['M-1', 'M/<2>'],
        aggregatedCategorias: [
          { label: '<img src=x onerror=alert(1)>', weight: 5, percentage: 62.5 },
        ],
        aggregatedBarrios: [
          { label: '<script>alert(1)</script>', weight: 2, percentage: 25 },
        ],
      } as any,
    });

    expect(node.querySelector('img')).toBeNull();
    expect(node.querySelector('script')).toBeNull();
    expect(node.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(node.textContent).toContain('<script>alert(1)</script>');
    const links = Array.from(node.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/chat/M-1', '/chat/M%2F%3C2%3E']);
  });
});
