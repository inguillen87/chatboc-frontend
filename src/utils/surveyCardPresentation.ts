import type { SurveyAdmin } from '@/types/encuestas';
const count = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
function reported(primary: unknown, key: string, fallback: unknown): number | null {
  const row = primary !== null && typeof primary === 'object' ? primary as Record<string, unknown> : {};
  return count(Object.prototype.hasOwnProperty.call(row, key) ? row[key] : fallback);
}
export function surveyCardMetrics(survey: SurveyAdmin) {
  const participation = survey.admin_lifecycle?.participation;
  const responses = reported(participation, 'responses', survey.metricas?.total_respuestas);
  const uniqueParticipants = reported(participation, 'unique_participants', survey.metricas?.participantes_unicos);
  const responsesLast24h = reported(participation, 'responses_last_24h', survey.metricas?.respuestas_ultimas_24h);
  const coordinates = count(survey.metricas?.respuestas_con_coordenadas);
  const contradictoryCoverage = responses !== null && coordinates !== null && coordinates > responses;
  const territorialCoverage = responses !== null && responses > 0 && coordinates !== null && !contradictoryCoverage
    ? (coordinates / responses) * 100 : null;
  return { responses, uniqueParticipants, responsesLast24h, coordinates, territorialCoverage, contradictoryCoverage };
}
export const surveyCountLabel = (value: number | null) => value === null ? 'No informado' : value.toLocaleString('es-AR');
export const surveyCoverageLabel = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 1 });
export const surveyDateLabel = (value?: string | null) => !value ? 'Sin fecha'
  : Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('es-AR') : 'Fecha no verificable';
