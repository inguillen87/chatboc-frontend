import { beforeEach, describe, expect, it, vi } from 'vitest';

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => seam.apiFetch(...args),
  ApiError: class ApiError extends Error { constructor(message: string, public status: number) { super(message); } },
}));
vi.mock('@/config', () => ({ ENABLE_PUBLIC_SURVEY_LEGACY_FALLBACK: false, PUBLIC_SURVEY_BASE_URL: '' }));
import { listSurveyResponses } from './encuestas';

const canonical = () => ({ encuesta_id: 17, total: 1, limit: 10, offset: 0,
  respuestas: [{ id: 101, submitted_at: '2026-11-03T12:34:00+00:00', canal: 'whatsapp',
    detalles: [{ pregunta_id: 11, pregunta_texto: 'Prioridad fixture', opcion_texto: 'Plazas fixture', texto_libre: null }] }] });

beforeEach(() => seam.apiFetch.mockReset());

describe('survey response wire adapter', () => {
  it('retains every selected option and free text in detail rows', async () => {
    const wire = canonical();
    wire.respuestas[0].detalles = [
      { pregunta_id: 11, pregunta_texto: 'Prioridad fixture', opcion_texto: 'Plazas fixture', texto_libre: 'Sector norte fixture' as any },
      { pregunta_id: 11, pregunta_texto: 'Prioridad fixture', opcion_texto: 'Veredas fixture', texto_libre: null },
    ];
    seam.apiFetch.mockResolvedValue(wire);
    const result = await listSurveyResponses(17);
    expect(result.data[0].respuestas).toHaveLength(2);
    expect(result.data[0].respuestas?.[0].respuesta).toContain('Plazas fixture');
    expect(result.data[0].respuestas?.[0].respuesta).toContain('Sector norte fixture');
    expect(result.data[0].respuestas?.[1].respuesta).toBe('Veredas fixture');
    expect(wire.respuestas[0].detalles[0].texto_libre).toBe('Sector norte fixture');
  });

  it('retains an explicit missing submission date without synthesizing a timestamp', async () => {
    const wire = canonical();
    wire.respuestas[0].submitted_at = null as any;
    seam.apiFetch.mockResolvedValue(wire);
    const result = await listSurveyResponses(17);
    expect(result.data[0].created_at).toBeNull();
    expect(result.data[0].respondido_at).toBeUndefined();
    expect(result.data[0].updated_at).toBeUndefined();
  });

  it('keeps zero total and the canonical page metadata', async () => {
    seam.apiFetch.mockResolvedValue({ encuesta_id: 17, total: 0, limit: 10, offset: 0, respuestas: [] });
    const result = await listSurveyResponses(17);
    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ total: 0, limit: 10, offset: 0 });
  });

  it('preserves the existing data/meta envelope, channel, summary and null metadata', async () => {
    const legacy = { canal: 'legacy-envelope', data: [{ id: 91, canal: 'web',
      created_at: '2026-11-02T12:00:00Z', resumen: 'Detalle legacy fixture', metadata: null }],
      meta: { total: 1, limit: 10, offset: 0, marker: 'legacy' } };
    seam.apiFetch.mockResolvedValue(legacy);
    expect(await listSurveyResponses(17)).toEqual(legacy);
  });

  it('rejects malformed successful payloads instead of silently returning an empty list', async () => {
    for (const invalid of [{}, { respuestas: null }, { data: null },
      { total: -1, limit: 10, offset: 0, respuestas: [] },
      { total: 1, limit: 10, offset: 0, respuestas: [null] },
      { total: 1, limit: 10, offset: 0, respuestas: [{ submitted_at: 'bad-date', detalles: [] }] },
      { total: 1, limit: 10, offset: 0, respuestas: [{ submitted_at: null, detalles: 'invalid' }] }]) {
      seam.apiFetch.mockResolvedValueOnce(invalid);
      await expect(listSurveyResponses(17)).rejects.toThrow(/No pudimos cargar las respuestas de esta encuesta/);
    }
  });

  it('does not restore source-anonymous identifiers nulled by the backend', async () => {
    const wire = canonical();
    const anonymous = { ...wire.respuestas[0], privacy: { mode: 'source_anonymous', source_identifiers_persisted: false },
      dni: null, phone: null, ip: null, user_id: null, lat: null, lng: null, metadata: null,
      utm_source: null, utm_campaign: null };
    seam.apiFetch.mockResolvedValue({ ...wire, respuestas: [anonymous] });
    const result = await listSurveyResponses(17);
    expect(result.data[0]).toMatchObject({ dni: null, phone: null, ip: null, user_id: null,
      lat: null, lng: null, metadata: null, utm_source: null, utm_campaign: null });
    expect((result.data[0] as any).privacy).toEqual(anonymous.privacy);
    expect(result.data[0].respuestas?.[0].respuesta).toBe('Plazas fixture');
  });
});
