import { FlaskConical, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SurveyResponseProvenance } from '@/types/encuestas';

const RESPONSE_PROVENANCE_CONTRACT = 'surveys.response_provenance.v1';
const SYNTHETIC_MARKER_CONTRACT = 'surveys.demo_seeding.v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonNegativeInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

export const parseSurveyResponseProvenance = (
  value: unknown,
): SurveyResponseProvenance | null => {
  if (!isRecord(value)) return null;
  if (value.contract_version !== RESPONSE_PROVENANCE_CONTRACT) return null;
  if (value.server_trusted_classification !== true) return null;
  if (value.synthetic_marker_contract !== SYNTHETIC_MARKER_CONTRACT) return null;
  if (value.mode !== 'real' && value.mode !== 'synthetic') return null;
  if (typeof value.contains_synthetic !== 'boolean') return null;

  const realIncluded = nonNegativeInteger(value.real_responses_included);
  const syntheticIncluded = nonNegativeInteger(value.synthetic_responses_included);
  const syntheticExcluded = nonNegativeInteger(value.synthetic_responses_excluded);
  if (realIncluded === null || syntheticIncluded === null || syntheticExcluded === null) return null;
  if (value.contains_synthetic !== (syntheticIncluded > 0)) return null;

  if (value.mode === 'real' && (syntheticIncluded !== 0 || value.contains_synthetic)) return null;
  if (value.mode === 'synthetic' && realIncluded !== 0) return null;

  return {
    contract_version: RESPONSE_PROVENANCE_CONTRACT,
    mode: value.mode,
    server_trusted_classification: true,
    contains_synthetic: value.contains_synthetic,
    real_responses_included: realIncluded,
    synthetic_responses_included: syntheticIncluded,
    synthetic_responses_excluded: syntheticExcluded,
    synthetic_marker_contract: SYNTHETIC_MARKER_CONTRACT,
  };
};

export const resolveSurveyResponseProvenance = (
  ...sources: unknown[]
): SurveyResponseProvenance | null => {
  for (const source of sources) {
    const direct = parseSurveyResponseProvenance(source);
    if (direct) return direct;
    if (!isRecord(source)) continue;

    const nested =
      parseSurveyResponseProvenance(source.data_provenance) ??
      parseSurveyResponseProvenance(source.response_provenance);
    if (nested) return nested;
  }
  return null;
};

interface SurveyResponseProvenanceBadgeProps {
  sources: readonly unknown[];
  className?: string;
}

export function SurveyResponseProvenanceBadge({
  sources,
  className,
}: SurveyResponseProvenanceBadgeProps) {
  const provenance = resolveSurveyResponseProvenance(...sources);
  if (!provenance) return null;

  const syntheticMode = provenance.mode === 'synthetic';
  const Icon = syntheticMode ? FlaskConical : ShieldCheck;
  const title = syntheticMode ? 'Escenario sintético' : 'Resultados ciudadanos';
  const detail = syntheticMode
    ? `No representa participación ciudadana${
        provenance.synthetic_responses_included > 0
          ? ` · ${provenance.synthetic_responses_included.toLocaleString('es-AR')} respuestas sintéticas`
          : ''
      }`
    : `Simulación excluida del cálculo${
        provenance.synthetic_responses_excluded > 0
          ? ` · ${provenance.synthetic_responses_excluded.toLocaleString('es-AR')} respuestas excluidas`
          : ''
      }`;

  return (
    <div
      role="status"
      aria-label={`${title}. ${detail}`}
      data-testid={`survey-response-provenance-${provenance.mode}`}
      className={cn(
        'inline-flex max-w-full items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        syntheticMode
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
          : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block opacity-80">{detail}</span>
      </span>
    </div>
  );
}
