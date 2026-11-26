import { describe, expect, it } from 'vitest';

import {
  DEMO_DATA_NOTICE,
  cleanDemoText,
  cleanDemoUnit,
  formatDemoPresentationLabel,
  isResolvedDemoStatus,
} from './demoPresentationLabels';

describe('demo presentation labels', () => {
  it.each([
    ['assigned', 'Asignado'],
    ['in_target', 'En plazo'],
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

  it('cleans internal demo jargon and boilerplate from backend-provided copy', () => {
    expect(DEMO_DATA_NOTICE).toBe('Datos de ejemplo. No son respuestas ni reclamos reales.');
    expect(cleanDemoText('Junín Participa — prioridades barriales (DEMO NO OFICIAL)')).toBe(
      'Junín Participa — prioridades barriales',
    );
    expect(cleanDemoText('08:40 del día simulado')).toBe('Hoy, 08:40');
    expect(cleanDemoText('día simulado anterior')).toBe('Ayer');
    expect(cleanDemoText('hace 2 días simulados')).toBe('Hace 2 días');
    expect(cleanDemoText('38 permanecen abiertos en el escenario')).toBe('38 siguen abiertos');
    expect(cleanDemoText('Base sintética de Junín Participa (DEMO NO OFICIAL). Alumbrado lidera con 34%')).toBe(
      'Alumbrado lidera con 34%',
    );
    expect(cleanDemoUnit('respuestas sintéticas')).toBe('respuestas');
    expect(isResolvedDemoStatus('resolved')).toBe(true);
    expect(isResolvedDemoStatus('assigned')).toBe(false);
  });
});
