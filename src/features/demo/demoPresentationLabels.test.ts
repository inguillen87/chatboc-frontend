import { describe, expect, it } from 'vitest';

import { formatDemoPresentationLabel } from './demoPresentationLabels';

describe('demo presentation labels', () => {
  it.each([
    ['assigned', 'Asignado'],
    ['in_target', 'Dentro de SLA'],
    ['at-risk', 'En riesgo'],
    ['demo_publicada', 'Demo publicada'],
    ['field_team', 'Equipo de campo'],
    ['whatsapp', 'WhatsApp'],
    ['location', 'Ubicación'],
  ])('presents internal value %s as %s', (source, expected) => {
    expect(formatDemoPresentationLabel(source)).toBe(expected);
  });

  it('humanizes an unknown internal enum without exposing underscores', () => {
    expect(formatDemoPresentationLabel('awaiting_external_review')).toBe('Awaiting external review');
  });
});
