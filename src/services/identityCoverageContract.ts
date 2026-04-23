export type SloStatus = 'ok' | 'below_target';

export interface IdentityCoverageAlertV1 {
  channel: string;
  coverage_pct: number;
  target_pct: number;
  gap_pct: number;
  severity: 'low' | 'medium' | 'high';
  message?: string;
  current_pct?: number;
}

export interface IdentityCoverageResponseV1 {
  contract_version: 'analytics.identity_coverage.v1';
  request_id: string;
  tenant_id: number | null;
  coverage_pct: number;
  contact_key_coverage_pct?: number;
  conversation_id_coverage_pct?: number;
  combined_coverage_pct?: number;
  target_pct?: number;
  slo_status: SloStatus;
  alert_count: number;
  summary_message?: string;
  alerts: IdentityCoverageAlertV1[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asTrimmedString = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export const parseIdentityCoverageResponseV1 = (input: unknown): IdentityCoverageResponseV1 | null => {
  if (!isRecord(input)) return null;
  if (input.contract_version !== 'analytics.identity_coverage.v1') return null;
  if (input.slo_status !== 'ok' && input.slo_status !== 'below_target') return null;
  const requestId = asTrimmedString(input.request_id);
  if (!requestId) return null;

  const coveragePct = asFiniteNumber(input.coverage_pct);
  const alertCount = asFiniteNumber(input.alert_count);
  if (coveragePct === undefined || alertCount === undefined) return null;

  const alertsRaw = Array.isArray(input.alerts) ? input.alerts : [];
  const alerts = alertsRaw
    .map((alert) => {
      if (!isRecord(alert)) return null;
      const channel = asTrimmedString(alert.channel);
      const coverage_pct = asFiniteNumber(alert.coverage_pct);
      const target_pct = asFiniteNumber(alert.target_pct);
      const gap_pct = asFiniteNumber(alert.gap_pct);
      const severity = alert.severity;

      if (!channel || coverage_pct === undefined || target_pct === undefined || gap_pct === undefined) {
        return null;
      }

      if (severity !== 'low' && severity !== 'medium' && severity !== 'high') {
        return null;
      }

      return {
        channel,
        coverage_pct,
        target_pct,
        gap_pct,
        severity,
        ...(asTrimmedString(alert.message) ? { message: asTrimmedString(alert.message) } : {}),
        ...(asFiniteNumber(alert.current_pct) !== undefined ? { current_pct: asFiniteNumber(alert.current_pct) } : {}),
      };
    })
    .filter((alert): alert is IdentityCoverageAlertV1 => alert !== null);

  return {
    contract_version: 'analytics.identity_coverage.v1',
    request_id: requestId,
    tenant_id: input.tenant_id === null ? null : asFiniteNumber(input.tenant_id) ?? null,
    coverage_pct: coveragePct,
    contact_key_coverage_pct: asFiniteNumber(input.contact_key_coverage_pct),
    conversation_id_coverage_pct: asFiniteNumber(input.conversation_id_coverage_pct),
    combined_coverage_pct: asFiniteNumber(input.combined_coverage_pct),
    target_pct: asFiniteNumber(input.target_pct),
    slo_status: input.slo_status,
    alert_count: alertCount,
    summary_message: asTrimmedString(input.summary_message),
    alerts,
  };
};
