import type { DemoAdminPreviewResponse } from './demoTypes';

const EXECUTIVE_PREVIEW_CONTRACT_VERSION = 'demo.admin_preview.v1';
const EXECUTIVE_PROVENANCE_CONTRACT_VERSION = 'demo.executive_provenance.v1';
const EXECUTIVE_DATA_MODES = new Set([
  'synthetic_demo_scenario',
  'session_generated_events',
  'mixed_partitioned',
]);

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const hasExecutiveDemoAdminPreviewContract = (
  preview: DemoAdminPreviewResponse | null | undefined,
): preview is DemoAdminPreviewResponse => {
  if (!preview) return false;

  const provenance = preview.data_provenance;
  const map = preview.map;
  const metrics = preview.metrics;

  return (
    preview.contract_version === EXECUTIVE_PREVIEW_CONTRACT_VERSION &&
    preview.presentation_mode === 'executive' &&
    provenance?.contract_version === EXECUTIVE_PROVENANCE_CONTRACT_VERSION &&
    hasText(provenance.mode) &&
    EXECUTIVE_DATA_MODES.has(provenance.mode) &&
    Array.isArray(metrics) &&
    metrics.length > 0 &&
    metrics.every(
      (metric) =>
        hasText(metric.id ?? metric.key) &&
        hasText(metric.label ?? metric.title) &&
        Object.prototype.hasOwnProperty.call(metric, 'value'),
    ) &&
    Boolean(map) &&
    typeof map?.enabled === 'boolean' &&
    Array.isArray(map.points)
  );
};
