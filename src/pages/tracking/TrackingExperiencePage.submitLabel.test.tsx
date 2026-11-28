import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('tracking submit label', () => {
  it('invites a first lookup and only offers a refresh once a status is on screen', () => {
    const source = readFileSync('src/pages/tracking/TrackingExperiencePage.tsx', 'utf8');
    expect(source).toContain('{payload ? "Actualizar estado" : "Ver estado"}');
  });
});
