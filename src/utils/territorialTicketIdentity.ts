export const TERRITORIAL_TICKET_SOURCE_MODELS = [
  'TenantTicket',
  'MunicipioTicket',
  'PymeTicket',
] as const;

export type TerritorialTicketSourceModel = (typeof TERRITORIAL_TICKET_SOURCE_MODELS)[number];

export type TerritorialTicketIdentity = {
  sourceModel: TerritorialTicketSourceModel;
  ticketId: string;
  tenantSlug: string | null;
  opaqueKey: string;
};

export type TerritorialTicketIdentityResolution =
  | { status: 'valid'; identity: TerritorialTicketIdentity }
  | { status: 'missing' | 'ambiguous' | 'unsupported'; identity: null };

type IdentityRecord = Record<string, unknown>;

const SOURCE_MODEL_ALIASES: Record<string, TerritorialTicketSourceModel> = {
  tenantticket: 'TenantTicket',
  municipioticket: 'MunicipioTicket',
  pymeticket: 'PymeTicket',
};

const asIdentityRecord = (value: unknown): IdentityRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as IdentityRecord)
    : null;

const asScalarText = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
};

export const normalizeTerritorialSourceModel = (
  value: unknown,
): TerritorialTicketSourceModel | null => {
  const raw = asScalarText(value);
  if (!raw) return null;
  return SOURCE_MODEL_ALIASES[raw.toLocaleLowerCase('en-US').replace(/[^a-z]/g, '')] ?? null;
};

const normalizeTerritorialTicketId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    if (!value || value !== value.trim()) return null;
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  return null;
};

const normalizeTerritorialTenantSlug = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/i.test(value)) return null;
  return value.toLocaleLowerCase('en-US');
};

/**
 * Tenant-scoped endpoints may omit the slug on each row, but any explicit row
 * slug must match the page scope exactly. Invalid or conflicting slugs are
 * rejected so coordinates and ticket links cannot cross tenant boundaries.
 */
export const isTerritorialTenantScopeCompatible = (
  value: unknown,
  expectedTenantSlug?: string | null,
): boolean => {
  if (expectedTenantSlug === null || expectedTenantSlug === undefined) return true;
  const expected = normalizeTerritorialTenantSlug(expectedTenantSlug);
  if (!expected) return false;
  const record = asIdentityRecord(value);
  if (!record) return false;
  const explicitValues = [record.tenant_slug, record.tenantSlug]
    .filter((candidate) => candidate !== null && candidate !== undefined);
  if (explicitValues.length === 0) return true;
  const normalizedValues = explicitValues
    .map(normalizeTerritorialTenantSlug)
    .filter((candidate): candidate is string => candidate !== null);
  return normalizedValues.length === explicitValues.length
    && unique(normalizedValues).length === 1
    && normalizedValues[0] === expected;
};

const buildOpaqueKey = (
  sourceModel: TerritorialTicketSourceModel,
  ticketId: string,
  tenantSlug: string | null,
) => `${tenantSlug ? `${tenantSlug}:` : ''}${sourceModel}:${ticketId}`;

const parseOpaqueIdentity = (
  value: unknown,
  tenantSlug: string | null,
): TerritorialTicketIdentity | null => {
  if (typeof value === 'string' && value !== value.trim()) return null;
  const raw = asScalarText(value);
  if (!raw) return null;
  const separatorIndex = raw.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) return null;
  const sourceModel = normalizeTerritorialSourceModel(raw.slice(0, separatorIndex));
  const ticketId = normalizeTerritorialTicketId(raw.slice(separatorIndex + 1));
  if (!sourceModel || !ticketId) return null;
  return {
    sourceModel,
    ticketId,
    tenantSlug,
    opaqueKey: buildOpaqueKey(sourceModel, ticketId, tenantSlug),
  };
};

const unique = <T,>(values: T[]) => Array.from(new Set(values));

/**
 * Resolves the authoritative ticket identity attached to a territorial point.
 * It deliberately refuses partial, unsupported, or conflicting identities so
 * a numeric id shared by two ticket models can never open the wrong record.
 */
export const resolveTerritorialTicketIdentity = (
  value: unknown,
  expectedTenantSlug?: string | null,
): TerritorialTicketIdentityResolution => {
  const record = asIdentityRecord(value);
  if (!record) return { status: 'missing', identity: null };

  const hasExpectedTenant = expectedTenantSlug !== null && expectedTenantSlug !== undefined;
  const normalizedExpectedTenant = hasExpectedTenant
    ? normalizeTerritorialTenantSlug(expectedTenantSlug)
    : null;
  if (hasExpectedTenant && !normalizedExpectedTenant) {
    return { status: 'unsupported', identity: null };
  }
  const explicitTenantValues = [record.tenant_slug, record.tenantSlug]
    .filter((candidate) => candidate !== null && candidate !== undefined);
  const normalizedExplicitTenants = explicitTenantValues
    .map(normalizeTerritorialTenantSlug)
    .filter((candidate): candidate is string => candidate !== null);
  if (explicitTenantValues.length !== normalizedExplicitTenants.length) {
    return { status: 'unsupported', identity: null };
  }
  const tenants = unique(normalizedExplicitTenants);
  if (tenants.length > 1) return { status: 'ambiguous', identity: null };
  if (normalizedExpectedTenant && tenants[0] && normalizedExpectedTenant !== tenants[0]) {
    return { status: 'ambiguous', identity: null };
  }
  const tenantSlug = normalizedExpectedTenant ?? tenants[0] ?? null;

  const explicitSourceValues = [
    record.source_model,
    record.sourceModel,
    record.record_source,
    record.recordSource,
  ].map(asScalarText).filter((candidate): candidate is string => candidate !== null);
  const normalizedExplicitSources = explicitSourceValues
    .map(normalizeTerritorialSourceModel)
    .filter((candidate): candidate is TerritorialTicketSourceModel => candidate !== null);
  if (explicitSourceValues.length !== normalizedExplicitSources.length) {
    return { status: 'unsupported', identity: null };
  }

  const opaqueIdentity = parseOpaqueIdentity(record.id, tenantSlug);
  const sources = unique([
    ...normalizedExplicitSources,
    ...(opaqueIdentity ? [opaqueIdentity.sourceModel] : []),
  ]);
  if (sources.length > 1) return { status: 'ambiguous', identity: null };

  const explicitTicketValues = [
    record.ticket_id,
    record.ticketId,
    record.record_id,
    record.recordId,
  ].filter((candidate) => candidate !== null && candidate !== undefined);
  const normalizedExplicitTickets = explicitTicketValues
    .map(normalizeTerritorialTicketId)
    .filter((candidate): candidate is string => candidate !== null);
  if (explicitTicketValues.length !== normalizedExplicitTickets.length) {
    return { status: 'unsupported', identity: null };
  }

  const canUseLegacyFallback = !opaqueIdentity && explicitTicketValues.length === 0;
  const scalarFallbackId = canUseLegacyFallback ? normalizeTerritorialTicketId(record.id) : null;
  const ticketFallback = canUseLegacyFallback ? normalizeTerritorialTicketId(record.ticket) : null;
  const ticketIds = unique([
    ...normalizedExplicitTickets,
    ...(opaqueIdentity ? [opaqueIdentity.ticketId] : []),
    ...(sources.length > 0 && scalarFallbackId ? [scalarFallbackId] : []),
    ...(sources.length > 0 && ticketFallback ? [ticketFallback] : []),
  ]);
  if (ticketIds.length > 1) return { status: 'ambiguous', identity: null };
  if (sources.length === 0 || ticketIds.length === 0) {
    return { status: 'missing', identity: null };
  }

  const sourceModel = sources[0];
  const ticketId = ticketIds[0];
  return {
    status: 'valid',
    identity: {
      sourceModel,
      ticketId,
      tenantSlug,
      opaqueKey: buildOpaqueKey(sourceModel, ticketId, tenantSlug),
    },
  };
};

export const buildTerritorialTicketHref = (
  identity: TerritorialTicketIdentity | null | undefined,
  tenantSlug?: string | null,
): string | null => {
  if (!identity) return null;
  const hasRequestedTenant = tenantSlug !== null && tenantSlug !== undefined;
  const normalizedRequestedTenant = hasRequestedTenant
    ? normalizeTerritorialTenantSlug(tenantSlug)
    : null;
  if (hasRequestedTenant && !normalizedRequestedTenant) return null;
  if (
    identity.tenantSlug &&
    normalizedRequestedTenant &&
    identity.tenantSlug !== normalizedRequestedTenant
  ) return null;
  const params = new URLSearchParams({
    tab: 'tickets',
    source_model: identity.sourceModel,
    ticket_id: identity.ticketId,
  });
  const normalizedTenantSlug = normalizedRequestedTenant ?? identity.tenantSlug ?? '';
  if (normalizedTenantSlug) {
    params.set('tenant_slug', normalizedTenantSlug);
    params.set('tenant', normalizedTenantSlug);
  }
  return `/perfil?${params.toString()}`;
};
