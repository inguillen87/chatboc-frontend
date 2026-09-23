/**
 * Source contracts: backend 912446, routes/super_admin.py:list_tenants,
 * routes/v2/saas.py:executive_summary_v2 / _build_superadmin_command_center_payload,
 * routes/crm/routes.py:superadmin_crm_leads. No response is a revenue contract.
 * Command center and CRM are bounded selections, never global denominators.
 */
type RecordValue = Record<string, unknown>;
export interface PlatformDistributionItem { key: string; count: number }
export interface PlatformHealthRow {
  slug: string;
  name: string | null;
  /** Backend health.checks score, in points from 0 to 100 (not a ratio). */
  score: number | null;
  status: string | null;
  alerts: string[];
}
export interface PlatformOverviewInput {
  tenants?: unknown;
  total?: unknown;
  tenantsError?: boolean;
  commandCenter?: unknown;
  commandError?: boolean;
  executiveSummary?: unknown;
  executiveError?: boolean;
  crmItems?: unknown;
  crmSummary?: unknown;
  crmError?: boolean;
}
export interface PlatformOverviewData {
  directory: {
    total: number | null;
    loaded: number | null;
    complete: boolean;
    activeLoaded: number | null;
    inactiveLoaded: number | null;
    unknownStatusLoaded: number | null;
    discardedRows: number;
  };
  planDistribution: PlatformDistributionItem[];
  typeDistribution: PlatformDistributionItem[];
  statusDistribution: PlatformDistributionItem[];
  crm: {
    loaded: number | null;
    hot: number | null;
    warm: number | null;
    cold: number | null;
    unknown: number | null;
    scope: 'returned_items';
    summaryMatchesItems: boolean | null;
  };
  health: {
    mean: number | null;
    denominator: number | null;
    totalRows: number | null;
    scope: 'executive_tenants' | 'command_center_tenants' | 'unavailable';
    rows: PlatformHealthRow[];
  };
  executiveTotal: number | null;
  executiveCountMismatch: boolean;
}

const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue : null;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const score = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

/** Preserve original backend fields instead of the legacy adapter's invented tenant_N. */
const source = (value: unknown): RecordValue | null => {
  let result = record(value);
  if (result && Object.prototype.hasOwnProperty.call(result, 'raw')) result = record(result.raw);
  if (result && !result.contract_version && record(result.data)) result = record(result.data);
  return result;
};

const distribution = (values: string[]): PlatformDistributionItem[] => {
  const counts = new Map<string, number>();
  for (const key of values) counts.set(key, (counts.get(key) ?? 0) + 1);
  return Array.from(counts, ([key, value]) => ({ key, count: value }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};
const activeState = (tenant: RecordValue): string => {
  const explicit = typeof tenant.is_active === 'boolean' ? tenant.is_active : null;
  const status = text(tenant.status)?.toLowerCase();
  const statusFlag = status === 'active' ? true : status === 'inactive' ? false : null;
  if (explicit !== null && statusFlag !== null && explicit !== statusFlag) return 'unknown';
  const value = explicit ?? statusFlag;
  return value === true ? 'active' : value === false ? 'inactive' : 'unknown';
};

const healthRows = (items: unknown[]): PlatformHealthRow[] => {
  const seen = new Set<string>();
  const rows: PlatformHealthRow[] = [];
  for (const value of items) {
    const row = record(value);
    if (!row) continue;
    const tenant = record(row.tenant);
    const health = record(row.health);
    const slug = text(tenant?.slug) ?? text(row.tenant_slug) ?? text(row.slug);
    // A key must come from the server. Array position is not tenant identity.
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const alerts = Array.isArray(row.alerts) ? row.alerts : Array.isArray(health?.alerts) ? health.alerts : [];
    rows.push({
      slug,
      name: text(tenant?.nombre) ?? text(row.tenant_name) ?? text(row.display_name),
      score: score(health?.score ?? row.health_score),
      status: text(health?.status) ?? text(row.status),
      alerts: alerts.map(alert => text(alert) ?? text(record(alert)?.message) ?? text(record(alert)?.reason_code))
        .filter((alert): alert is string => alert !== null),
    });
  }
  return rows.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity) || a.slug.localeCompare(b.slug));
};

export function buildPlatformOverview(input: PlatformOverviewInput): PlatformOverviewData {
  const directoryAvailable = !input.tenantsError && Array.isArray(input.tenants);
  const candidates = directoryAvailable ? input.tenants as unknown[] : [];
  const seen = new Set<string>();
  const tenants: RecordValue[] = [];
  for (const value of candidates) {
    const tenant = record(value);
    const slug = text(tenant?.slug);
    if (!tenant || !slug || seen.has(slug)) continue;
    seen.add(slug);
    tenants.push(tenant);
  }
  const total = directoryAvailable ? count(input.total) : null;
  const loaded = directoryAvailable ? tenants.length : null;
  const states = tenants.map(activeState);
  const discardedRows = candidates.length - tenants.length;

  const executive = input.executiveError ? null : source(input.executiveSummary);
  const validExecutive = executive?.contract_version === 'superadmin.executive_summary.v1' ? executive : null;
  const executiveTotal = count(record(validExecutive?.summary)?.tenants);
  const command = input.commandError ? null : source(input.commandCenter);
  const validCommand = command?.contract_version === 'superadmin.command_center.v1' ? command : null;
  const executiveItems = record(validExecutive?.tenant_health)?.items;
  const commandItems = record(validCommand?.tenants)?.items;
  const selectedHealth = Array.isArray(executiveItems) ? executiveItems : Array.isArray(commandItems) ? commandItems : null;
  const rows = selectedHealth ? healthRows(selectedHealth) : [];
  const validScores = rows.map(row => row.score).filter((value): value is number => value !== null);

  const crmAvailable = !input.crmError && Array.isArray(input.crmItems)
    && input.crmItems.every(item => record(item) !== null);
  const crmItems = crmAvailable ? input.crmItems as RecordValue[] : [];
  const temperatures = crmItems.map(item => text(item.lead_temperature)?.toLowerCase());
  const hot = temperatures.filter(value => value === 'hot').length;
  const warm = temperatures.filter(value => value === 'warm').length;
  const cold = temperatures.filter(value => value === 'cold').length;
  const crmSummary = record(input.crmSummary);
  const summaryMatchesItems = crmAvailable && crmSummary ? (
    count(crmSummary.total) === crmItems.length && count(crmSummary.hot) === hot
    && count(crmSummary.warm) === warm && count(crmSummary.cold) === cold
  ) : null;

  return {
    directory: {
      total, loaded, complete: loaded !== null && total === loaded && discardedRows === 0,
      activeLoaded: directoryAvailable ? states.filter(state => state === 'active').length : null,
      inactiveLoaded: directoryAvailable ? states.filter(state => state === 'inactive').length : null,
      unknownStatusLoaded: directoryAvailable ? states.filter(state => state === 'unknown').length : null,
      discardedRows,
    },
    planDistribution: distribution(tenants.map(tenant => text(tenant.plan)?.toLowerCase() ?? 'unknown')),
    typeDistribution: distribution(tenants.map(tenant => text(tenant.tipo)?.toLowerCase() ?? 'unknown')),
    statusDistribution: distribution(states),
    crm: {
      loaded: crmAvailable ? crmItems.length : null,
      hot: crmAvailable ? hot : null,
      warm: crmAvailable ? warm : null,
      cold: crmAvailable ? cold : null,
      unknown: crmAvailable ? crmItems.length - hot - warm - cold : null,
      scope: 'returned_items', summaryMatchesItems,
    },
    health: {
      mean: validScores.length ? Math.round(validScores.reduce((sum, value) => sum + value, 0) / validScores.length * 100) / 100 : null,
      denominator: selectedHealth ? validScores.length : null,
      totalRows: selectedHealth ? selectedHealth.length : null,
      scope: Array.isArray(executiveItems) ? 'executive_tenants' : Array.isArray(commandItems) ? 'command_center_tenants' : 'unavailable',
      rows,
    },
    executiveTotal,
    executiveCountMismatch: total !== null && executiveTotal !== null && total !== executiveTotal,
  };
}
