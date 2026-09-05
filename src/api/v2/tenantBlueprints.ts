import { apiFetch } from '@/utils/api';

export const TENANT_BLUEPRINT_MANIFEST_VERSION = 'tenant.blueprint.manifest.v1' as const;
export const TENANT_BLUEPRINT_DETAIL_VERSION = 'tenant.blueprint.detail.v1' as const;
export const TENANT_BLUEPRINT_PREVIEW_VERSION = 'tenant.blueprint.preview.v1' as const;
export const TENANT_BLUEPRINT_APPLY_VERSION = 'tenant.blueprint.apply.v1' as const;
export const TENANT_BLUEPRINT_APPLICATION_VERSION = 'tenant.blueprint.application.v1' as const;

export interface TenantBlueprintModule {
  id: string;
  label: string;
  summary: string;
  activation_state: string;
}

export interface TenantBlueprintMetadata {
  id: string;
  version: string;
  label: string;
  description: string;
  manifest_digest: string;
  supported_tenant_types: string[];
  modules: TenantBlueprintModule[];
}

export interface TenantBlueprintCatalogContract {
  contract_version: typeof TENANT_BLUEPRINT_MANIFEST_VERSION;
  blueprints: TenantBlueprintMetadata[];
}

export interface TenantBlueprintTenantRef {
  id: number | string;
  slug: string;
  type: string;
}

export interface TenantBlueprintApplicationReceipt {
  id: string;
  contract_version: typeof TENANT_BLUEPRINT_APPLICATION_VERSION;
  tenant_id: number | string;
  blueprint_id: string;
  blueprint_version: string;
  manifest_digest: string;
  request_digest: string;
  status: 'applied';
  application_snapshot: Record<string, unknown>;
  applied_by_user_id: number | string;
  created_at: string | null;
}

export interface TenantBlueprintDetailContract {
  contract_version: typeof TENANT_BLUEPRINT_DETAIL_VERSION;
  tenant: TenantBlueprintTenantRef;
  blueprint: TenantBlueprintMetadata & { configuration_defaults: Record<string, unknown> };
  application_receipt: TenantBlueprintApplicationReceipt | null;
  runtime_activation_performed: false;
  external_calls_performed: false;
}

export interface TenantBlueprintChanges {
  namespace: string;
  apply_count: number;
  preserve_count: number;
  apply_paths: string[];
  preserve_paths: string[];
}

export interface TenantBlueprintPreviewContract {
  contract_version: typeof TENANT_BLUEPRINT_PREVIEW_VERSION;
  tenant: TenantBlueprintTenantRef;
  blueprint: TenantBlueprintMetadata;
  changes: TenantBlueprintChanges;
  configuration_digest_after_apply: string;
  write_performed: false;
  runtime_activation_performed: false;
  external_calls_performed: false;
}

export interface TenantBlueprintApplyContract {
  contract_version: typeof TENANT_BLUEPRINT_APPLY_VERSION;
  receipt: TenantBlueprintApplicationReceipt;
  changes: TenantBlueprintChanges;
  replayed: boolean;
  write_performed: boolean;
  runtime_activation_performed: false;
  external_calls_performed: false;
}

export interface TenantBlueprintIdentityExpectation {
  tenantId: number | string;
  blueprintId: string;
  blueprintVersion: string;
  manifestDigest: string;
}

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const BLUEPRINT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const IDEMPOTENCY_KEY_PATTERN = /^[!-~]{8,128}$/;

const invalidContract = (): never => {
  throw new Error('tenant_blueprint_contract_invalid');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());

const isIdentifier = (value: unknown): value is number | string =>
  (typeof value === 'number' && Number.isFinite(value)) || isNonEmptyString(value);

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const assertRequestedIdentifiers = (tenantSlug: string, blueprintId: string) => {
  const normalizedTenant = normalizeTenantSlug(tenantSlug);
  const normalizedBlueprint = blueprintId.trim();
  if (!normalizedTenant || !BLUEPRINT_ID_PATTERN.test(normalizedBlueprint)) {
    throw new Error('tenant_blueprint_request_invalid');
  }
  return { tenantSlug: normalizedTenant, blueprintId: normalizedBlueprint };
};

const parseModule = (value: unknown): TenantBlueprintModule => {
  if (
    !isRecord(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.label)
    || !isNonEmptyString(value.summary)
    || !isNonEmptyString(value.activation_state)
  ) {
    return invalidContract();
  }
  return value as unknown as TenantBlueprintModule;
};

const parseMetadata = (value: unknown): TenantBlueprintMetadata => {
  if (
    !isRecord(value)
    || !isNonEmptyString(value.id)
    || !BLUEPRINT_ID_PATTERN.test(value.id)
    || !isNonEmptyString(value.version)
    || !VERSION_PATTERN.test(value.version)
    || !isNonEmptyString(value.label)
    || !isNonEmptyString(value.description)
    || typeof value.manifest_digest !== 'string'
    || !DIGEST_PATTERN.test(value.manifest_digest)
    || !Array.isArray(value.supported_tenant_types)
    || value.supported_tenant_types.length === 0
    || value.supported_tenant_types.some((item) => !isNonEmptyString(item))
    || !Array.isArray(value.modules)
    || value.modules.length === 0
  ) {
    return invalidContract();
  }

  const modules = value.modules.map(parseModule);
  if (new Set(modules.map((module) => module.id)).size !== modules.length) {
    return invalidContract();
  }

  return { ...value, modules } as unknown as TenantBlueprintMetadata;
};

const parseTenantRef = (value: unknown, requestedTenantSlug: string): TenantBlueprintTenantRef => {
  if (
    !isRecord(value)
    || !isIdentifier(value.id)
    || !isNonEmptyString(value.slug)
    || !isNonEmptyString(value.type)
  ) {
    return invalidContract();
  }
  if (normalizeTenantSlug(value.slug) !== normalizeTenantSlug(requestedTenantSlug)) {
    throw new Error('tenant_blueprint_scope_mismatch');
  }
  return value as unknown as TenantBlueprintTenantRef;
};

const parseReceipt = (
  value: unknown,
  expected: TenantBlueprintIdentityExpectation,
): TenantBlueprintApplicationReceipt => {
  if (
    !isRecord(value)
    || value.contract_version !== TENANT_BLUEPRINT_APPLICATION_VERSION
    || !isNonEmptyString(value.id)
    || !isIdentifier(value.tenant_id)
    || !isNonEmptyString(value.blueprint_id)
    || !isNonEmptyString(value.blueprint_version)
    || !VERSION_PATTERN.test(value.blueprint_version)
    || typeof value.manifest_digest !== 'string'
    || !DIGEST_PATTERN.test(value.manifest_digest)
    || typeof value.request_digest !== 'string'
    || !DIGEST_PATTERN.test(value.request_digest)
    || value.status !== 'applied'
    || !isRecord(value.application_snapshot)
    || !isIdentifier(value.applied_by_user_id)
    || !(value.created_at === null || isNonEmptyString(value.created_at))
  ) {
    return invalidContract();
  }

  if (
    String(value.tenant_id) !== String(expected.tenantId)
    || value.blueprint_id !== expected.blueprintId
  ) {
    throw new Error('tenant_blueprint_scope_mismatch');
  }
  if (
    value.blueprint_version !== expected.blueprintVersion
    || value.manifest_digest !== expected.manifestDigest
  ) {
    throw new Error('tenant_blueprint_version_mismatch');
  }

  return value as unknown as TenantBlueprintApplicationReceipt;
};

const parseChanges = (value: unknown): TenantBlueprintChanges => {
  if (
    !isRecord(value)
    || !isNonEmptyString(value.namespace)
    || typeof value.apply_count !== 'number'
    || !Number.isInteger(value.apply_count)
    || value.apply_count < 0
    || typeof value.preserve_count !== 'number'
    || !Number.isInteger(value.preserve_count)
    || value.preserve_count < 0
    || !Array.isArray(value.apply_paths)
    || value.apply_paths.some((item) => !isNonEmptyString(item))
    || !Array.isArray(value.preserve_paths)
    || value.preserve_paths.some((item) => !isNonEmptyString(item))
    || value.apply_count !== value.apply_paths.length
    || value.preserve_count !== value.preserve_paths.length
  ) {
    return invalidContract();
  }
  return value as unknown as TenantBlueprintChanges;
};

export const parseTenantBlueprintCatalog = (payload: unknown): TenantBlueprintCatalogContract => {
  if (
    !isRecord(payload)
    || payload.contract_version !== TENANT_BLUEPRINT_MANIFEST_VERSION
    || !Array.isArray(payload.blueprints)
  ) {
    return invalidContract();
  }
  const blueprints = payload.blueprints.map(parseMetadata);
  if (new Set(blueprints.map((blueprint) => blueprint.id)).size !== blueprints.length) {
    return invalidContract();
  }
  return { contract_version: TENANT_BLUEPRINT_MANIFEST_VERSION, blueprints };
};

export const parseTenantBlueprintDetail = (
  payload: unknown,
  requestedTenantSlug: string,
  requestedBlueprintId: string,
): TenantBlueprintDetailContract => {
  if (
    !isRecord(payload)
    || payload.contract_version !== TENANT_BLUEPRINT_DETAIL_VERSION
    || !isRecord(payload.blueprint)
    || !isRecord(payload.blueprint.configuration_defaults)
    || payload.runtime_activation_performed !== false
    || payload.external_calls_performed !== false
  ) {
    return invalidContract();
  }
  const tenant = parseTenantRef(payload.tenant, requestedTenantSlug);
  const blueprint = parseMetadata(payload.blueprint);
  if (blueprint.id !== requestedBlueprintId) {
    throw new Error('tenant_blueprint_scope_mismatch');
  }
  const applicationReceipt = payload.application_receipt === null
    ? null
    : parseReceipt(payload.application_receipt, {
        tenantId: tenant.id,
        blueprintId: blueprint.id,
        blueprintVersion: blueprint.version,
        manifestDigest: blueprint.manifest_digest,
      });
  return {
    ...payload,
    tenant,
    blueprint: { ...blueprint, configuration_defaults: payload.blueprint.configuration_defaults },
    application_receipt: applicationReceipt,
  } as TenantBlueprintDetailContract;
};

export const parseTenantBlueprintPreview = (
  payload: unknown,
  requestedTenantSlug: string,
  expected: TenantBlueprintIdentityExpectation,
): TenantBlueprintPreviewContract => {
  if (
    !isRecord(payload)
    || payload.contract_version !== TENANT_BLUEPRINT_PREVIEW_VERSION
    || payload.write_performed !== false
    || payload.runtime_activation_performed !== false
    || payload.external_calls_performed !== false
    || typeof payload.configuration_digest_after_apply !== 'string'
    || !DIGEST_PATTERN.test(payload.configuration_digest_after_apply)
  ) {
    return invalidContract();
  }
  const tenant = parseTenantRef(payload.tenant, requestedTenantSlug);
  const blueprint = parseMetadata(payload.blueprint);
  if (String(tenant.id) !== String(expected.tenantId) || blueprint.id !== expected.blueprintId) {
    throw new Error('tenant_blueprint_scope_mismatch');
  }
  if (
    blueprint.version !== expected.blueprintVersion
    || blueprint.manifest_digest !== expected.manifestDigest
  ) {
    throw new Error('tenant_blueprint_version_mismatch');
  }
  return {
    ...payload,
    tenant,
    blueprint,
    changes: parseChanges(payload.changes),
  } as TenantBlueprintPreviewContract;
};

export const parseTenantBlueprintApply = (
  payload: unknown,
  expected: TenantBlueprintIdentityExpectation,
): TenantBlueprintApplyContract => {
  if (
    !isRecord(payload)
    || payload.contract_version !== TENANT_BLUEPRINT_APPLY_VERSION
    || typeof payload.replayed !== 'boolean'
    || typeof payload.write_performed !== 'boolean'
    || payload.write_performed === payload.replayed
    || payload.runtime_activation_performed !== false
    || payload.external_calls_performed !== false
  ) {
    return invalidContract();
  }
  return {
    ...payload,
    receipt: parseReceipt(payload.receipt, expected),
    changes: parseChanges(payload.changes),
  } as TenantBlueprintApplyContract;
};

export const listTenantBlueprints = async () => {
  const payload = await apiFetch<unknown>('/api/v2/tenant-blueprints', {
    cache: 'no-store',
    omitTenant: true,
    persistTenantSlug: false,
  });
  return parseTenantBlueprintCatalog(payload);
};

export const getTenantBlueprint = async (tenantSlug: string, blueprintId: string) => {
  const requested = assertRequestedIdentifiers(tenantSlug, blueprintId);
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(requested.tenantSlug)}/blueprints/${encodeURIComponent(requested.blueprintId)}`,
    { tenantSlug: requested.tenantSlug, persistTenantSlug: false, cache: 'no-store' },
  );
  return parseTenantBlueprintDetail(payload, requested.tenantSlug, requested.blueprintId);
};

export const previewTenantBlueprint = async (
  tenantSlug: string,
  blueprintId: string,
  expected: Omit<TenantBlueprintIdentityExpectation, 'blueprintId'>,
) => {
  const requested = assertRequestedIdentifiers(tenantSlug, blueprintId);
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(requested.tenantSlug)}/blueprints/${encodeURIComponent(requested.blueprintId)}/preview`,
    {
      method: 'POST',
      tenantSlug: requested.tenantSlug,
      persistTenantSlug: false,
      cache: 'no-store',
    },
  );
  return parseTenantBlueprintPreview(payload, requested.tenantSlug, {
    ...expected,
    blueprintId: requested.blueprintId,
  });
};

export const applyTenantBlueprint = async ({
  tenantSlug,
  blueprintId,
  manifestDigest,
  idempotencyKey,
  expectedTenantId,
  expectedBlueprintVersion,
}: {
  tenantSlug: string;
  blueprintId: string;
  manifestDigest: string;
  idempotencyKey: string;
  expectedTenantId: number | string;
  expectedBlueprintVersion: string;
}) => {
  const requested = assertRequestedIdentifiers(tenantSlug, blueprintId);
  if (!DIGEST_PATTERN.test(manifestDigest) || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new Error('tenant_blueprint_request_invalid');
  }
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(requested.tenantSlug)}/blueprints/${encodeURIComponent(requested.blueprintId)}/apply`,
    {
      method: 'POST',
      body: { manifest_digest: manifestDigest },
      headers: { 'Idempotency-Key': idempotencyKey },
      tenantSlug: requested.tenantSlug,
      persistTenantSlug: false,
      cache: 'no-store',
    },
  );
  return parseTenantBlueprintApply(payload, {
    tenantId: expectedTenantId,
    blueprintId: requested.blueprintId,
    blueprintVersion: expectedBlueprintVersion,
    manifestDigest,
  });
};
