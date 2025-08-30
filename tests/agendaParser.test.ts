import { describe, expect, it } from 'vitest';
import { parseAgendaText } from '../src/utils/agendaParser';

const sample = [
  '*AGENDA MUNICIPAL*',
  '',
  '*Jueves 28*',
  '',
  '🕑9.30 hs.',
  '✅Entrega de reconocimientos a los cuatro primeros Presidentes del HCD en democracia.',
  '📍HCD',
  '',
  '*Viernes 29*',
  '🕑10.00 hs.',
  '✅Expo Educativa 2026',
  '📍Centro Universitario del Este',
  '',
  '🕑18.30 hs.',
  '✅Capacitación Internacional "Taller de Juegos" (para docentes de jardines maternales)',
  '📍Casa del Bicentenario',
  '',
  '*Sábado 30*',
  '🕑11.30 hs.',
  '✅Entrega de Certificados del Curso de Lengua de Señas',
  '📍Centro Universitario del Este',
  '',
  '*Domingo 31*',
  '🕑9.00 a 16.00 hs.',
  '✅Encuentro Femenino de Vóley',
  '📍Polideportivo Posta El Retamo',
  '',
  '🕑10.00 hs.',
  '✅Torneo de Fútbol "Desafío Libertadores"',
  '📍Club Social y Deportivo Los Barriales',
].join('\n');

describe('parseAgendaText', () => {
  const result = parseAgendaText(sample);

  it('extracts title', () => {
    expect(result.title).toBe('AGENDA MUNICIPAL');
  });

  it('parses days and events count', () => {
    expect(result.days).toHaveLength(4);
    expect(result.days[0].day).toBe('Jueves 28');
    expect(result.days[0].events).toHaveLength(1);
  });

  it('parses event details', () => {
    const event = result.days[0].events[0];
    expect(event).toEqual({
      time: '9.30',
      title: 'Entrega de reconocimientos a los cuatro primeros Presidentes del HCD en democracia.',
      location: 'HCD',
    });
  });
});
