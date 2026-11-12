import { apiFetch } from '@/utils/api';

export const GOVERNMENT_LAUNCH_BLUEPRINT_ID = 'government-core' as const;
export const GOVERNMENT_MESA_UNICA_LAUNCH_ID = 'mesa-unica' as const;
export const GOVERNMENT_LAUNCH_PREVIEW_VERSION = 'tenant.blueprint.launch.preview.v1' as const;
export const GOVERNMENT_LAUNCH_APPLY_VERSION = 'tenant.blueprint.launch.apply.v1' as const;
export const GOVERNMENT_LAUNCH_RECEIPT_VERSION = 'tenant.blueprint.launch.receipt.v1' as const;

const GOVERNMENT_LAUNCH_SOURCE_PATH = 'configuration_defaults.ticket_categories' as const;
const GOVERNMENT_LAUNCH_RUNTIME_SCOPE = ['ticket_categories'] as const;

export interface GovernmentLaunchTenantRef {
  id: number | string;
  slug: string;
  type: string;
}

export interface GovernmentLaunchCategoryRef {
  id: number | string;
  name: string;
  type: string;
}

export interface GovernmentLaunchCategoryToCreate {
  name: string;
  canonical_name: string;
  type: 'ticket';
}

export interface GovernmentLaunchCategoryPreserved {
  desired_name: string;
  canonical_name: string;
  category: GovernmentLaunchCategoryRef;
  preserved: true;
}

export interface GovernmentLaunchCategoryConflict {
  desired_name: string;
  canonical_name: string;
  reason_code: 'ambiguous_existing_categories' | 'category_type_conflict';
  matches: GovernmentLaunchCategoryRef[];
}

export interface GovernmentLaunchPreviewChanges {
  to_create: GovernmentLaunchCategoryToCreate[];
  already_present: GovernmentLaunchCategoryPreserved[];
  conflicts: GovernmentLaunchCategoryConflict[];
  summary: {
    desired: number;
    existing: number;
    create: number;
    preserve: number;
    conflict: number;
  };
}

export interface GovernmentLaunchPreviewContract {
  contract_version: typeof GOVERNMENT_LAUNCH_PREVIEW_VERSION;
  tenant: GovernmentLaunchTenantRef;
  blueprint: {
    id: typeof GOVERNMENT_LAUNCH_BLUEPRINT_ID;
    version: string;
    manifest_digest: string;
    application_receipt_id: string;
  };
  launch: {
    id: typeof GOVERNMENT_MESA_UNICA_LAUNCH_ID;
    label: string;
    description: string;
    source_path: typeof GOVERNMENT_LAUNCH_SOURCE_PATH;
    runtime_scope: ['ticket_categories'];
  };
  launch_digest: string;
  changes: GovernmentLaunchPreviewChanges;
  write_performed: false;
  runtime_activation_performed: false;
  operational_defaults_materialized: false;
  provider_activation_performed: false;
  external_calls_performed: false;
  demo_data_created: false;
}

export interface GovernmentLaunchApplyChanges {
  created: GovernmentLaunchCategoryRef[];
  already_present: GovernmentLaunchCategoryPreserved[];
  conflicts: [];
  summary: {
    desired: number;
    created: number;
    preserved: number;
    conflict: 0;
  };
}

export interface GovernmentLaunchReceipt {
  id: string;
  contract_version: typeof GOVERNMENT_LAUNCH_RECEIPT_VERSION;
  tenant_id: number | string;
  blueprint_application_id: string;
  blueprint_id: typeof GOVERNMENT_LAUNCH_BLUEPRINT_ID;
  blueprint_version: string;
  launch_id: typeof GOVERNMENT_MESA_UNICA_LAUNCH_ID;
  manifest_digest: string;
  launch_digest: string;
  request_digest: string;
  status: 'applied';
  application_snapshot: Record<string, unknown>;
  applied_by_user_id: number | string;
  created_at: string | null;
}

export interface GovernmentLaunchApplyContract {
  contract_version: typeof GOVERNMENT_LAUNCH_APPLY_VERSION;
  receipt: GovernmentLaunchReceipt;
  launch_digest: string;
  changes: GovernmentLaunchApplyChanges;
  replayed: boolean;
  write_performed: boolean;
  runtime_activation_performed: false;
  runtime_activation_scope: ['ticket_categories'];
  operational_defaults_materialized: true;
  provider_activation_performed: false;
  external_calls_performed: false;
  demo_data_created: false;
}

export interface GovernmentLaunchExpectation {
  tenantId: number | string;
  blueprintVersion: string;
  manifestDigest: string;
  blueprintApplicationReceiptId: string;
  launchDigest: string;
}

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const IDEMPOTENCY_KEY_PATTERN = /^[!-~]{8,128}$/;
const GENERIC_TENANT_SLUGS = new Set(['app', 'admin', 'superadmin', 'super-admin', 'super_admin', 'dashboard', 'perfil', 'profile']);
const CONFLICT_REASONS = new Set<GovernmentLaunchCategoryConflict['reason_code']>([
  'ambiguous_existing_categories',
  'category_type_conflict',
]);

const invalidContract = (): never => {
  throw new Error('government_launch_contract_invalid');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());

const isIdentifier = (value: unknown): value is number | string =>
  (typeof value === 'number' && Number.isInteger(value) && value > 0) || isNonEmptyString(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
};

const canonicalizeCategoryName = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

const isExactStringArray = (value: unknown, expected: readonly string[]) =>
  Array.isArray(value)
  && value.length === expected.length
  && value.every((item, index) => item === expected[index]);

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const assertTenantSlug = (value: string) => {
  const normalized = normalizeTenantSlug(value);
  if (
    !TENANT_SLUG_PATTERN.test(normalized)
    || GENERIC_TENANT_SLUGS.has(normalized)
  ) {
    throw new Error('government_launch_request_invalid');
  }
  return normalized;
};

const parseTenant = (value: unknown, expectedTenantSlug: string): GovernmentLaunchTenantRef => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['id', 'slug', 'type'])
    || !isIdentifier(value.id)
    || !isNonEmptyString(value.slug)
    || !isNonEmptyString(value.type)
  ) {
    return invalidContract();
  }
  if (normalizeTenantSlug(value.slug) !== expectedTenantSlug) {
    throw new Error('government_launch_scope_mismatch');
  }
  return { id: value.id, slug: value.slug, type: value.type };
};

const parseCategoryRef = (value: unknown): GovernmentLaunchCategoryRef => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['id', 'name', 'type'])
    || !isIdentifier(value.id)
    || !isNonEmptyString(value.name)
    || !isNonEmptyString(value.type)
  ) {
    return invalidContract();
  }
  return { id: value.id, name: value.name, type: value.type };
};

const parseToCreate = (value: unknown): GovernmentLaunchCategoryToCreate => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['name', 'canonical_name', 'type'])
    || !isNonEmptyString(value.name)
    || !isNonEmptyString(value.canonical_name)
    || value.type !== 'ticket'
    || canonicalizeCategoryName(value.name) !== value.canonical_name
  ) {
    return invalidContract();
  }
  return { name: value.name, canonical_name: value.canonical_name, type: 'ticket' };
};

const parsePreserved = (value: unknown): GovernmentLaunchCategoryPreserved => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['desired_name', 'canonical_name', 'category', 'preserved'])
    || !isNonEmptyString(value.desired_name)
    || !isNonEmptyString(value.canonical_name)
    || value.preserved !== true
  ) {
    return invalidContract();
  }
  const category = parseCategoryRef(value.category);
  if (
    canonicalizeCategoryName(value.desired_name) !== value.canonical_name
    || canonicalizeCategoryName(category.name) !== value.canonical_name
    || canonicalizeCategoryName(category.type) !== 'ticket'
  ) {
    return invalidContract();
  }
  return {
    desired_name: value.desired_name,
    canonical_name: value.canonical_name,
    category,
    preserved: true,
  };
};

const parseConflict = (value: unknown): GovernmentLaunchCategoryConflict => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['desired_name', 'canonical_name', 'reason_code', 'matches'])
    || !isNonEmptyString(value.desired_name)
    || !isNonEmptyString(value.canonical_name)
    || !isNonEmptyString(value.reason_code)
    || !CONFLICT_REASONS.has(value.reason_code as GovernmentLaunchCategoryConflict['reason_code'])
    || !Array.isArray(value.matches)
    || value.matches.length === 0
  ) {
    return invalidContract();
  }
  const reasonCode = value.reason_code as GovernmentLaunchCategoryConflict['reason_code'];
  const matches = value.matches.map(parseCategoryRef);
  if (
    canonicalizeCategoryName(value.desired_name) !== value.canonical_name
    || matches.some((match) => canonicalizeCategoryName(match.name) !== value.canonical_name)
    || (reasonCode === 'ambiguous_existing_categories' && matches.length < 2)
    || (
      reasonCode === 'category_type_conflict'
      && (matches.length !== 1 || canonicalizeCategoryName(matches[0].type) === 'ticket')
    )
  ) {
    return invalidContract();
  }
  return {
    desired_name: value.desired_name,
    canonical_name: value.canonical_name,
    reason_code: reasonCode,
    matches,
  };
};

const parsePreviewChanges = (value: unknown): GovernmentLaunchPreviewChanges => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['to_create', 'already_present', 'conflicts', 'summary'])
    || !Array.isArray(value.to_create)
    || !Array.isArray(value.already_present)
    || !Array.isArray(value.conflicts)
    || !isRecord(value.summary)
    || !hasExactKeys(value.summary, ['desired', 'existing', 'create', 'preserve', 'conflict'])
  ) {
    return invalidContract();
  }
  const toCreate = value.to_create.map(parseToCreate);
  const alreadyPresent = value.already_present.map(parsePreserved);
  const conflicts = value.conflicts.map(parseConflict);
  const summary = value.summary;
  const canonicalNames = [
    ...toCreate.map((item) => item.canonical_name),
    ...alreadyPresent.map((item) => item.canonical_name),
    ...conflicts.map((item) => item.canonical_name),
  ];
  const representedExisting = alreadyPresent.length
    + conflicts.reduce((total, item) => total + item.matches.length, 0);
  if (
    !isCount(summary.desired)
    || !isCount(summary.existing)
    || !isCount(summary.create)
    || !isCount(summary.preserve)
    || !isCount(summary.conflict)
    || summary.desired !== canonicalNames.length
    || summary.existing < representedExisting
    || summary.create !== toCreate.length
    || summary.preserve !== alreadyPresent.length
    || summary.conflict !== conflicts.length
    || new Set(canonicalNames).size !== canonicalNames.length
  ) {
    return invalidContract();
  }
  return {
    to_create: toCreate,
    already_present: alreadyPresent,
    conflicts,
    summary: {
      desired: summary.desired,
      existing: summary.existing,
      create: summary.create,
      preserve: summary.preserve,
      conflict: summary.conflict,
    },
  };
};

const parseApplyChanges = (value: unknown): GovernmentLaunchApplyChanges => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['created', 'already_present', 'conflicts', 'summary'])
    || !Array.isArray(value.created)
    || !Array.isArray(value.already_present)
    || !Array.isArray(value.conflicts)
    || value.conflicts.length !== 0
    || !isRecord(value.summary)
    || !hasExactKeys(value.summary, ['desired', 'created', 'preserved', 'conflict'])
  ) {
    return invalidContract();
  }
  const created = value.created.map(parseCategoryRef);
  const alreadyPresent = value.already_present.map(parsePreserved);
  const summary = value.summary;
  const representedCanonicalNames = [
    ...created.map((item) => canonicalizeCategoryName(item.name)),
    ...alreadyPresent.map((item) => item.canonical_name),
  ];
  if (
    !isCount(summary.desired)
    || !isCount(summary.created)
    || !isCount(summary.preserved)
    || summary.conflict !== 0
    || summary.desired !== created.length + alreadyPresent.length
    || summary.created !== created.length
    || summary.preserved !== alreadyPresent.length
    || created.some((item) => canonicalizeCategoryName(item.type) !== 'ticket')
    || representedCanonicalNames.some((name) => !name)
    || new Set(representedCanonicalNames).size !== representedCanonicalNames.length
  ) {
    return invalidContract();
  }
  return {
    created,
    already_present: alreadyPresent,
    conflicts: [],
    summary: {
      desired: summary.desired,
      created: summary.created,
      preserved: summary.preserved,
      conflict: 0,
    },
  };
};

const parseBlueprint = (value: unknown) => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['id', 'version', 'manifest_digest', 'application_receipt_id'])
    || value.id !== GOVERNMENT_LAUNCH_BLUEPRINT_ID
    || !isNonEmptyString(value.version)
    || !VERSION_PATTERN.test(value.version)
    || typeof value.manifest_digest !== 'string'
    || !DIGEST_PATTERN.test(value.manifest_digest)
    || !isNonEmptyString(value.application_receipt_id)
  ) {
    return invalidContract();
  }
  return {
    id: GOVERNMENT_LAUNCH_BLUEPRINT_ID,
    version: value.version,
    manifest_digest: value.manifest_digest,
    application_receipt_id: value.application_receipt_id,
  };
};

const parseLaunch = (value: unknown) => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['id', 'label', 'description', 'source_path', 'runtime_scope'])
    || value.id !== GOVERNMENT_MESA_UNICA_LAUNCH_ID
    || !isNonEmptyString(value.label)
    || !isNonEmptyString(value.description)
    || value.source_path !== GOVERNMENT_LAUNCH_SOURCE_PATH
    || !isExactStringArray(value.runtime_scope, GOVERNMENT_LAUNCH_RUNTIME_SCOPE)
  ) {
    return invalidContract();
  }
  return {
    id: GOVERNMENT_MESA_UNICA_LAUNCH_ID,
    label: value.label,
    description: value.description,
    source_path: GOVERNMENT_LAUNCH_SOURCE_PATH,
    runtime_scope: [...GOVERNMENT_LAUNCH_RUNTIME_SCOPE] as ['ticket_categories'],
  };
};

export const parseGovernmentLaunchPreview = (
  payload: unknown,
  requestedTenantSlug: string,
): GovernmentLaunchPreviewContract => {
  const normalizedTenant = assertTenantSlug(requestedTenantSlug);
  if (
    !isRecord(payload)
    || !hasExactKeys(payload, [
      'contract_version',
      'tenant',
      'blueprint',
      'launch',
      'launch_digest',
      'changes',
      'write_performed',
      'runtime_activation_performed',
      'operational_defaults_materialized',
      'provider_activation_performed',
      'external_calls_performed',
      'demo_data_created',
    ])
    || payload.contract_version !== GOVERNMENT_LAUNCH_PREVIEW_VERSION
    || typeof payload.launch_digest !== 'string'
    || !DIGEST_PATTERN.test(payload.launch_digest)
    || payload.write_performed !== false
    || payload.runtime_activation_performed !== false
    || payload.operational_defaults_materialized !== false
    || payload.provider_activation_performed !== false
    || payload.external_calls_performed !== false
    || payload.demo_data_created !== false
  ) {
    return invalidContract();
  }
  return {
    contract_version: GOVERNMENT_LAUNCH_PREVIEW_VERSION,
    tenant: parseTenant(payload.tenant, normalizedTenant),
    blueprint: parseBlueprint(payload.blueprint),
    launch: parseLaunch(payload.launch),
    launch_digest: payload.launch_digest,
    changes: parsePreviewChanges(payload.changes),
    write_performed: false,
    runtime_activation_performed: false,
    operational_defaults_materialized: false,
    provider_activation_performed: false,
    external_calls_performed: false,
    demo_data_created: false,
  };
};

const parseReceipt = (
  value: unknown,
  expected: GovernmentLaunchExpectation,
): GovernmentLaunchReceipt => {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      'id',
      'contract_version',
      'tenant_id',
      'blueprint_application_id',
      'blueprint_id',
      'blueprint_version',
      'launch_id',
      'manifest_digest',
      'launch_digest',
      'request_digest',
      'status',
      'application_snapshot',
      'applied_by_user_id',
      'created_at',
    ])
    || !isNonEmptyString(value.id)
    || value.contract_version !== GOVERNMENT_LAUNCH_RECEIPT_VERSION
    || !isIdentifier(value.tenant_id)
    || !isNonEmptyString(value.blueprint_application_id)
    || value.blueprint_id !== GOVERNMENT_LAUNCH_BLUEPRINT_ID
    || !isNonEmptyString(value.blueprint_version)
    || !VERSION_PATTERN.test(value.blueprint_version)
    || value.launch_id !== GOVERNMENT_MESA_UNICA_LAUNCH_ID
    || typeof value.manifest_digest !== 'string'
    || !DIGEST_PATTERN.test(value.manifest_digest)
    || typeof value.launch_digest !== 'string'
    || !DIGEST_PATTERN.test(value.launch_digest)
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
    || value.blueprint_application_id !== expected.blueprintApplicationReceiptId
    || value.blueprint_id !== GOVERNMENT_LAUNCH_BLUEPRINT_ID
    || value.launch_id !== GOVERNMENT_MESA_UNICA_LAUNCH_ID
  ) {
    throw new Error('government_launch_scope_mismatch');
  }
  if (
    value.blueprint_version !== expected.blueprintVersion
    || value.manifest_digest !== expected.manifestDigest
    || value.launch_digest !== expected.launchDigest
  ) {
    throw new Error('government_launch_version_mismatch');
  }
  return {
    id: value.id,
    contract_version: GOVERNMENT_LAUNCH_RECEIPT_VERSION,
    tenant_id: value.tenant_id,
    blueprint_application_id: value.blueprint_application_id,
    blueprint_id: GOVERNMENT_LAUNCH_BLUEPRINT_ID,
    blueprint_version: value.blueprint_version,
    launch_id: GOVERNMENT_MESA_UNICA_LAUNCH_ID,
    manifest_digest: value.manifest_digest,
    launch_digest: value.launch_digest,
    request_digest: value.request_digest,
    status: 'applied',
    application_snapshot: value.application_snapshot,
    applied_by_user_id: value.applied_by_user_id,
    created_at: value.created_at === null ? null : String(value.created_at),
  };
};

export const parseGovernmentLaunchApply = (
  payload: unknown,
  expected: GovernmentLaunchExpectation,
): GovernmentLaunchApplyContract => {
  if (
    !isRecord(payload)
    || !hasExactKeys(payload, [
      'contract_version',
      'receipt',
      'launch_digest',
      'changes',
      'replayed',
      'write_performed',
      'runtime_activation_performed',
      'runtime_activation_scope',
      'operational_defaults_materialized',
      'provider_activation_performed',
      'external_calls_performed',
      'demo_data_created',
    ])
    || payload.contract_version !== GOVERNMENT_LAUNCH_APPLY_VERSION
    || payload.launch_digest !== expected.launchDigest
    || typeof payload.replayed !== 'boolean'
    || typeof payload.write_performed !== 'boolean'
    || payload.write_performed === payload.replayed
    || payload.runtime_activation_performed !== false
    || !isExactStringArray(payload.runtime_activation_scope, GOVERNMENT_LAUNCH_RUNTIME_SCOPE)
    || payload.operational_defaults_materialized !== true
    || payload.provider_activation_performed !== false
    || payload.external_calls_performed !== false
    || payload.demo_data_created !== false
  ) {
    return invalidContract();
  }
  const changes = parseApplyChanges(payload.changes);
  const receipt = parseReceipt(payload.receipt, expected);
  const snapshot = receipt.application_snapshot;
  if (
    !hasExactKeys(snapshot, [
      'launch',
      'changes',
      'operational_defaults_materialized',
      'provider_activation_performed',
      'external_calls_performed',
      'demo_data_created',
    ])
    || !isRecord(snapshot.launch)
    || !hasExactKeys(snapshot.launch, ['id', 'source_path', 'runtime_scope'])
    || snapshot.launch.id !== GOVERNMENT_MESA_UNICA_LAUNCH_ID
    || snapshot.launch.source_path !== GOVERNMENT_LAUNCH_SOURCE_PATH
    || !isExactStringArray(snapshot.launch.runtime_scope, GOVERNMENT_LAUNCH_RUNTIME_SCOPE)
    || snapshot.operational_defaults_materialized !== true
    || snapshot.provider_activation_performed !== false
    || snapshot.external_calls_performed !== false
    || snapshot.demo_data_created !== false
  ) {
    return invalidContract();
  }
  const snapshotChanges = parseApplyChanges(snapshot.changes);
  if (JSON.stringify(snapshotChanges) !== JSON.stringify(changes)) {
    return invalidContract();
  }
  return {
    contract_version: GOVERNMENT_LAUNCH_APPLY_VERSION,
    receipt,
    launch_digest: expected.launchDigest,
    changes,
    replayed: payload.replayed,
    write_performed: payload.write_performed,
    runtime_activation_performed: false,
    runtime_activation_scope: [...GOVERNMENT_LAUNCH_RUNTIME_SCOPE] as ['ticket_categories'],
    operational_defaults_materialized: true,
    provider_activation_performed: false,
    external_calls_performed: false,
    demo_data_created: false,
  };
};

export const previewGovernmentMesaUnicaLaunch = async (tenantSlug: string) => {
  const requestedTenantSlug = assertTenantSlug(tenantSlug);
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(requestedTenantSlug)}/blueprints/${GOVERNMENT_LAUNCH_BLUEPRINT_ID}/launch/${GOVERNMENT_MESA_UNICA_LAUNCH_ID}/preview`,
    {
      method: 'POST',
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    },
  );
  return parseGovernmentLaunchPreview(payload, requestedTenantSlug);
};

export const applyGovernmentMesaUnicaLaunch = async ({
  tenantSlug,
  launchDigest,
  idempotencyKey,
  expected,
}: {
  tenantSlug: string;
  launchDigest: string;
  idempotencyKey: string;
  expected: Omit<GovernmentLaunchExpectation, 'launchDigest'>;
}) => {
  const requestedTenantSlug = assertTenantSlug(tenantSlug);
  if (
    !DIGEST_PATTERN.test(launchDigest)
    || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
    || !isIdentifier(expected.tenantId)
    || !VERSION_PATTERN.test(expected.blueprintVersion)
    || !DIGEST_PATTERN.test(expected.manifestDigest)
    || !isNonEmptyString(expected.blueprintApplicationReceiptId)
  ) {
    throw new Error('government_launch_request_invalid');
  }
  const expectation = { ...expected, launchDigest };
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(requestedTenantSlug)}/blueprints/${GOVERNMENT_LAUNCH_BLUEPRINT_ID}/launch/${GOVERNMENT_MESA_UNICA_LAUNCH_ID}/apply`,
    {
      method: 'POST',
      body: { launch_digest: launchDigest },
      headers: { 'Idempotency-Key': idempotencyKey },
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    },
  );
  return parseGovernmentLaunchApply(payload, expectation);
};
