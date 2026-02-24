import type { SurveyAdmin, SurveyPublic } from '@/types/encuestas';

const getAutoSeedPayload = (survey: SurveyPublic | SurveyAdmin): Record<string, unknown> | null => {
  const direct = (survey as Record<string, unknown>).auto_seed_demo;
  if (direct && typeof direct === 'object') return direct as Record<string, unknown>;
  const recursos = survey.recursos;
  if (recursos && typeof recursos === 'object') {
    const nested = (recursos as Record<string, unknown>).auto_seed_demo;
    if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  }
  return null;
};

export const getAutoSeedCantidad = (survey: SurveyPublic | SurveyAdmin): number | null => {
  const payload = getAutoSeedPayload(survey);
  if (!payload) return null;
  const raw = payload.cantidad;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  return null;
};
