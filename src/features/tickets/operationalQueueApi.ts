import { panelApi } from '@/api/v2/client';

export const OPERATIONAL_QUEUE_CONTRACT_VERSION = 'inbox.operational_queue.v1' as const;
export const OPERATIONAL_QUEUE_METRIC_CONTRACT = 'operations.queue_truth.v1' as const;
export const OPERATIONAL_QUEUE_GRAIN = 'one_current_open_source_record' as const;
export const OPERATIONAL_QUEUE_STATE_CONSISTENCY = 'created_at_anchored_live_state' as const;
export const OPERATIONAL_QUEUE_DEFAULT_LIMIT = 25;
export const OPERATIONAL_QUEUE_MAX_LIMIT = 100;

export const OPERATIONAL_QUEUE_SLA_STATES = [
  'breached',
  'at_risk',
  'unknown',
  'healthy',
  'not_eligible',
] as const;

export const OPERATIONAL_QUEUE_AGE_BUCKETS = [
  'lt_1h',
  '1h_4h',
  '4h_24h',
  '1d_3d',
  '3d_7d',
  'gte_7d',
  'unknown',
] as const;

export const OPERATIONAL_QUEUE_SOURCE_MODELS = ['TenantTicket', 'MunicipioTicket', 'PymeTicket'] as const;

export type OperationalQueueSlaState = (typeof OPERATIONAL_QUEUE_SLA_STATES)[number];
export type OperationalQueueAgeBucket = (typeof OPERATIONAL_QUEUE_AGE_BUCKETS)[number];
export type OperationalQueueSourceModel = (typeof OPERATIONAL_QUEUE_SOURCE_MODELS)[number];

export interface OperationalQueueFilters {
  queue: 'open';
  sla?: OperationalQueueSlaState;
  age?: OperationalQueueAgeBucket;
  assignee?: string;
  source_model?: OperationalQueueSourceModel;
  category?: string;
}

export interface OperationalQueueSearchState {
  filters: OperationalQueueFilters;
  limit: number;
  errors: string[];
}

export interface OperationalQueueSla {
  eligible: boolean;
  known: boolean;
  state: OperationalQueueSlaState;
  breached: boolean;
  at_risk: boolean;
  due_at: string | null;
  seconds_to_due: number | null;
  evidence: string[];
  raw_state: string | null;
}

export interface OperationalQueueItem {
  queue_id: string;
  source_model: OperationalQueueSourceModel;
  source_id: string;
  title: string;
  status: string;
  category: string | null;
  channel: string | null;
  priority: string | null;
  assignee_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  age_bucket: OperationalQueueAgeBucket;
  sla: OperationalQueueSla;
  detail_endpoint: string;
}

export interface OperationalQueuePageInfo {
  limit: number;
  returned: number;
  has_more: boolean;
  next_cursor: string | null;
  source_counts: Record<OperationalQueueSourceModel, number>;
}

export interface OperationalQueueResponseFilters {
  queue: 'open';
  sla: OperationalQueueSlaState | null;
  age: OperationalQueueAgeBucket | null;
  assignee: string | null;
  source_model: OperationalQueueSourceModel | null;
  category: string | null;
}

export interface OperationalQueueAccessScope {
  mode: 'tenant_wide' | 'employee_categories';
  category_count: number;
}

export interface OperationalQueueConsistency {
  creation_membership: 'created_at_null_or_lte_as_of';
  null_created_at: 'included_ordered_last';
  mutable_fields: 'live_at_each_page_read';
  historical_snapshot: false;
  durable_revision: false;
}

export interface OperationalQueuePage {
  contract_version: typeof OPERATIONAL_QUEUE_CONTRACT_VERSION;
  metric_contract: typeof OPERATIONAL_QUEUE_METRIC_CONTRACT;
  grain: typeof OPERATIONAL_QUEUE_GRAIN;
  state_consistency: typeof OPERATIONAL_QUEUE_STATE_CONSISTENCY;
  consistency: OperationalQueueConsistency;
  sort: readonly ['created_at:desc', 'source_rank:asc', 'source_id:desc'];
  tenant_slug: string;
  scope_fingerprint: string;
  filters_fingerprint: string;
  as_of: string;
  filters: OperationalQueueResponseFilters;
  access_scope: OperationalQueueAccessScope;
  items: OperationalQueueItem[];
  page: OperationalQueuePageInfo;
  request_id: string;
}

export interface GetOperationalQueuePageInput {
  tenantSlug: string;
  filters: OperationalQueueFilters;
  cursor?: string | null;
  limit?: number;
}

export class OperationalQueueContractError extends Error {
  constructor(message: string) {
    super(`Contrato de bandeja invalido: ${message}`);
    this.name = 'OperationalQueueContractError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const fail = (message: string): never => {
  throw new OperationalQueueContractError(message);
};

const readRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (!isRecord(value)) fail(`${field} debe ser un objeto`);
  return value as Record<string, unknown>;
};

const readString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} debe ser un texto no vacio`);
  return (value as string).trim();
};

const readNullableString = (value: unknown, field: string): string | null => {
  if (value === null) return null;
  return readString(value, field);
};

const readIdentifier = (value: unknown, field: string): string => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return readString(value, field);
};

const readPositiveIdentifier = (value: unknown, field: string): string => {
  const identifier = readIdentifier(value, field);
  if (!/^[1-9]\d*$/.test(identifier) || !Number.isSafeInteger(Number(identifier))) {
    fail(`${field} debe ser un identificador entero positivo`);
  }
  return identifier;
};

const readNullableIdentifier = (value: unknown, field: string): string | null => {
  if (value === null) return null;
  return readPositiveIdentifier(value, field);
};

const readBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') fail(`${field} debe ser booleano`);
  return value as boolean;
};

const readSafeInteger = (value: unknown, field: string, minimum?: number): number => {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || (minimum !== undefined && value < minimum)) {
    fail(`${field} debe ser un entero${minimum !== undefined ? ` mayor o igual a ${minimum}` : ''}`);
  }
  return value as number;
};

const readEnum = <T extends string>(value: unknown, field: string, allowed: readonly T[]): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`${field} no pertenece al contrato v1`);
  }
  return value as T;
};

const ZONED_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const readTimestamp = (value: unknown, field: string): string => {
  const timestamp = readString(value, field);
  if (!ZONED_ISO_PATTERN.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    fail(`${field} debe ser ISO-8601 con zona horaria explicita`);
  }
  return timestamp;
};

const readNullableTimestamp = (value: unknown, field: string): string | null => {
  if (value === null) return null;
  return readTimestamp(value, field);
};

const readStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) fail(`${field} debe ser una lista`);
  return (value as unknown[]).map((entry, index) => readString(entry, `${field}[${index}]`));
};

const readInternalEndpoint = (value: unknown, field: string): string => {
  const endpoint = readString(value, field);
  if (
    !endpoint.startsWith('/api/') ||
    endpoint.startsWith('//') ||
    endpoint.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(endpoint)
  ) {
    fail(`${field} debe ser un endpoint interno /api/ seguro`);
  }
  return endpoint;
};

const parseSla = (value: unknown, field: string): OperationalQueueSla => {
  const record = readRecord(value, field);
  const sla: OperationalQueueSla = {
    eligible: readBoolean(record.eligible, `${field}.eligible`),
    known: readBoolean(record.known, `${field}.known`),
    state: readEnum(record.state, `${field}.state`, OPERATIONAL_QUEUE_SLA_STATES),
    breached: readBoolean(record.breached, `${field}.breached`),
    at_risk: readBoolean(record.at_risk, `${field}.at_risk`),
    due_at: readNullableTimestamp(record.due_at, `${field}.due_at`),
    seconds_to_due:
      record.seconds_to_due === null
        ? null
        : readSafeInteger(record.seconds_to_due, `${field}.seconds_to_due`),
    evidence: readStringArray(record.evidence, `${field}.evidence`),
    raw_state: readNullableString(record.raw_state, `${field}.raw_state`),
  };

  const coherent =
    (sla.state === 'not_eligible' && !sla.eligible && !sla.known && !sla.breached && !sla.at_risk) ||
    (sla.state === 'unknown' && sla.eligible && !sla.known && !sla.breached && !sla.at_risk) ||
    (sla.state === 'breached' && sla.eligible && sla.known && sla.breached && !sla.at_risk) ||
    (sla.state === 'at_risk' && sla.eligible && sla.known && !sla.breached && sla.at_risk) ||
    (sla.state === 'healthy' && sla.eligible && sla.known && !sla.breached && !sla.at_risk);

  if (!coherent) fail(`${field} contradice state, eligible, known, breached o at_risk`);
  if (sla.state === 'breached' && sla.seconds_to_due !== null && sla.seconds_to_due > 0) {
    fail(`${field}.seconds_to_due no puede ser positivo cuando state=breached`);
  }
  if ((sla.state === 'healthy' || sla.state === 'at_risk') && sla.seconds_to_due !== null && sla.seconds_to_due < 0) {
    fail(`${field}.seconds_to_due no puede ser negativo para ${sla.state}`);
  }

  return sla;
};

const parseItem = (value: unknown, index: number): OperationalQueueItem => {
  const field = `items[${index}]`;
  const record = readRecord(value, field);
  const sourceModel = readEnum(record.source_model, `${field}.source_model`, OPERATIONAL_QUEUE_SOURCE_MODELS);
  const sourceId = readPositiveIdentifier(record.source_id, `${field}.source_id`);
  const queueId = readString(record.queue_id, `${field}.queue_id`);
  if (queueId !== `${sourceModel}:${sourceId}`) {
    fail(`${field}.queue_id debe ser source_model:source_id`);
  }
  const createdAt = readNullableTimestamp(record.created_at, `${field}.created_at`);
  const ageBucket = readEnum(record.age_bucket, `${field}.age_bucket`, OPERATIONAL_QUEUE_AGE_BUCKETS);
  if ((createdAt === null) !== (ageBucket === 'unknown')) {
    fail(`${field}.created_at y age_bucket se contradicen`);
  }
  return {
    queue_id: queueId,
    source_model: sourceModel,
    source_id: sourceId,
    title: readString(record.title, `${field}.title`),
    status: readString(record.status, `${field}.status`),
    category: readNullableString(record.category, `${field}.category`),
    channel: readNullableString(record.channel, `${field}.channel`),
    priority: readNullableString(record.priority, `${field}.priority`),
    assignee_id: readNullableIdentifier(record.assignee_id, `${field}.assignee_id`),
    created_at: createdAt,
    updated_at: readNullableTimestamp(record.updated_at, `${field}.updated_at`),
    age_bucket: ageBucket,
    sla: parseSla(record.sla, `${field}.sla`),
    detail_endpoint: readInternalEndpoint(record.detail_endpoint, `${field}.detail_endpoint`),
  };
};

const parsePageInfo = (value: unknown, itemCount: number): OperationalQueuePageInfo => {
  const record = readRecord(value, 'page');
  const limit = readSafeInteger(record.limit, 'page.limit', 1);
  if (limit > OPERATIONAL_QUEUE_MAX_LIMIT) fail(`page.limit no puede superar ${OPERATIONAL_QUEUE_MAX_LIMIT}`);
  const returned = readSafeInteger(record.returned, 'page.returned', 0);
  const hasMore = readBoolean(record.has_more, 'page.has_more');
  const nextCursor = readNullableString(record.next_cursor, 'page.next_cursor');
  if (returned !== itemCount) fail('page.returned debe coincidir con items.length');
  if (returned > limit) fail('page.returned no puede superar page.limit');
  if (hasMore !== Boolean(nextCursor)) fail('page.has_more y page.next_cursor se contradicen');
  const sourceCountsRecord = readRecord(record.source_counts, 'page.source_counts');
  const sourceCounts = Object.fromEntries(
    OPERATIONAL_QUEUE_SOURCE_MODELS.map((model) => [
      model,
      readSafeInteger(sourceCountsRecord[model], `page.source_counts.${model}`, 0),
    ]),
  ) as Record<OperationalQueueSourceModel, number>;
  const sourceCountTotal = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);
  if (sourceCountTotal !== returned) fail('page.source_counts debe sumar page.returned');
  return { limit, returned, has_more: hasMore, next_cursor: nextCursor, source_counts: sourceCounts };
};

const parseResponseFilters = (value: unknown): OperationalQueueResponseFilters => {
  const record = readRecord(value, 'filters');
  const nullableEnum = <T extends string>(raw: unknown, field: string, allowed: readonly T[]): T | null =>
    raw === null ? null : readEnum(raw, field, allowed);
  const assignee =
    record.assignee === null
      ? null
      : record.assignee === 'unassigned'
        ? 'unassigned'
        : readPositiveIdentifier(record.assignee, 'filters.assignee');
  const category = readNullableString(record.category, 'filters.category');
  if (category !== null && category.length > 100) fail('filters.category no puede superar 100 caracteres');
  if (record.queue !== 'open') fail('filters.queue debe ser open');
  return {
    queue: 'open',
    sla: nullableEnum(record.sla, 'filters.sla', OPERATIONAL_QUEUE_SLA_STATES),
    age: nullableEnum(record.age, 'filters.age', OPERATIONAL_QUEUE_AGE_BUCKETS),
    assignee,
    source_model: nullableEnum(record.source_model, 'filters.source_model', OPERATIONAL_QUEUE_SOURCE_MODELS),
    category,
  };
};

const assertResponseFiltersMatch = (
  actual: OperationalQueueResponseFilters,
  expected: OperationalQueueFilters,
) => {
  const entries: Array<[keyof OperationalQueueResponseFilters, string | null, string | null]> = [
    ['queue', actual.queue, expected.queue],
    ['sla', actual.sla, expected.sla ?? null],
    ['age', actual.age, expected.age ?? null],
    ['assignee', actual.assignee, expected.assignee?.trim() ?? null],
    ['source_model', actual.source_model, expected.source_model ?? null],
    ['category', actual.category, expected.category?.trim().toLowerCase() ?? null],
  ];
  const mismatch = entries.find(([, current, wanted]) => current !== wanted);
  if (mismatch) fail(`filters.${mismatch[0]} no coincide con el filtro solicitado`);
};

export interface OperationalQueueResponseExpectation {
  tenantSlug?: string;
  filters?: OperationalQueueFilters;
  limit?: number;
}

const ageBucketAt = (createdAt: string | null, asOf: string): OperationalQueueAgeBucket => {
  if (createdAt === null) return 'unknown';
  const seconds = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(createdAt)) / 1_000));
  if (seconds < 60 * 60) return 'lt_1h';
  if (seconds < 4 * 60 * 60) return '1h_4h';
  if (seconds < 24 * 60 * 60) return '4h_24h';
  if (seconds < 3 * 24 * 60 * 60) return '1d_3d';
  if (seconds < 7 * 24 * 60 * 60) return '3d_7d';
  return 'gte_7d';
};

export const parseOperationalQueueResponse = (
  response: unknown,
  expectation: OperationalQueueResponseExpectation = {},
): OperationalQueuePage => {
  const record = readRecord(response, 'response');
  if (record.contract_version !== OPERATIONAL_QUEUE_CONTRACT_VERSION) fail('contract_version inesperado');
  if (record.metric_contract !== OPERATIONAL_QUEUE_METRIC_CONTRACT) fail('metric_contract inesperado');
  if (record.grain !== OPERATIONAL_QUEUE_GRAIN) fail('grain inesperado');
  if (record.state_consistency !== OPERATIONAL_QUEUE_STATE_CONSISTENCY) fail('state_consistency inesperada');

  const consistencyRecord = readRecord(record.consistency, 'consistency');
  if (consistencyRecord.creation_membership !== 'created_at_null_or_lte_as_of') {
    fail('consistency.creation_membership inesperada');
  }
  if (consistencyRecord.null_created_at !== 'included_ordered_last') {
    fail('consistency.null_created_at inesperada');
  }
  if (consistencyRecord.mutable_fields !== 'live_at_each_page_read') {
    fail('consistency.mutable_fields inesperada');
  }
  if (consistencyRecord.historical_snapshot !== false || consistencyRecord.durable_revision !== false) {
    fail('consistency no puede afirmar snapshot historico o revision durable');
  }
  if (
    !Array.isArray(record.sort) ||
    record.sort.length !== 3 ||
    record.sort[0] !== 'created_at:desc' ||
    record.sort[1] !== 'source_rank:asc' ||
    record.sort[2] !== 'source_id:desc'
  ) {
    fail('sort inesperado');
  }

  const tenantSlug = readString(record.tenant_slug, 'tenant_slug');
  if (expectation.tenantSlug && tenantSlug !== expectation.tenantSlug) {
    fail(`tenant_slug ${tenantSlug} no coincide con el tenant solicitado`);
  }
  if (!Array.isArray(record.items)) fail('items debe ser una lista');
  const items = (record.items as unknown[]).map(parseItem);
  const queueIds = new Set<string>();
  for (const item of items) {
    if (queueIds.has(item.queue_id)) fail(`queue_id duplicado: ${item.queue_id}`);
    queueIds.add(item.queue_id);
  }

  const page = parsePageInfo(record.page, items.length);
  if (expectation.limit !== undefined && page.limit !== expectation.limit) {
    fail('page.limit no coincide con el limite solicitado');
  }
  const responseFilters = parseResponseFilters(record.filters);
  if (expectation.filters) assertResponseFiltersMatch(responseFilters, expectation.filters);
  const accessScopeRecord = readRecord(record.access_scope, 'access_scope');
  const accessScope: OperationalQueueAccessScope = {
    mode: readEnum(accessScopeRecord.mode, 'access_scope.mode', ['tenant_wide', 'employee_categories'] as const),
    category_count: readSafeInteger(accessScopeRecord.category_count, 'access_scope.category_count', 0),
  };

  const scopeFingerprint = readString(record.scope_fingerprint, 'scope_fingerprint');
  const filtersFingerprint = readString(record.filters_fingerprint, 'filters_fingerprint');
  if (!/^[a-f0-9]{64}$/.test(scopeFingerprint)) fail('scope_fingerprint debe ser sha256 hexadecimal');
  if (!/^[a-f0-9]{64}$/.test(filtersFingerprint)) fail('filters_fingerprint debe ser sha256 hexadecimal');

  const asOf = readTimestamp(record.as_of, 'as_of');
  items.forEach((item, index) => {
    if (item.created_at !== null && Date.parse(item.created_at) > Date.parse(asOf)) {
      fail(`items[${index}].created_at no puede ser posterior a as_of`);
    }
    if (ageBucketAt(item.created_at, asOf) !== item.age_bucket) {
      fail(`items[${index}].age_bucket no coincide con created_at y as_of`);
    }
  });

  return {
    contract_version: OPERATIONAL_QUEUE_CONTRACT_VERSION,
    metric_contract: OPERATIONAL_QUEUE_METRIC_CONTRACT,
    grain: OPERATIONAL_QUEUE_GRAIN,
    state_consistency: OPERATIONAL_QUEUE_STATE_CONSISTENCY,
    consistency: {
      creation_membership: 'created_at_null_or_lte_as_of',
      null_created_at: 'included_ordered_last',
      mutable_fields: 'live_at_each_page_read',
      historical_snapshot: false,
      durable_revision: false,
    },
    sort: ['created_at:desc', 'source_rank:asc', 'source_id:desc'],
    tenant_slug: tenantSlug,
    scope_fingerprint: scopeFingerprint,
    filters_fingerprint: filtersFingerprint,
    as_of: asOf,
    filters: responseFilters,
    access_scope: accessScope,
    items,
    page,
    request_id: readString(record.request_id, 'request_id'),
  };
};

export const assertOperationalQueuePageChain = (
  pages: readonly OperationalQueuePage[],
): readonly OperationalQueuePage[] => {
  if (pages.length === 0) return pages;
  const first = pages[0];
  const queueIds = new Set<string>();

  pages.forEach((page, pageIndex) => {
    if (page.tenant_slug !== first.tenant_slug) fail(`tenant_slug cambio en pagina ${pageIndex + 1}`);
    if (page.scope_fingerprint !== first.scope_fingerprint) fail(`scope_fingerprint cambio en pagina ${pageIndex + 1}`);
    if (page.filters_fingerprint !== first.filters_fingerprint) fail(`filters_fingerprint cambio en pagina ${pageIndex + 1}`);
    if (page.as_of !== first.as_of) fail(`as_of cambio en pagina ${pageIndex + 1}`);
    if (pageIndex > 0) {
      const previous = pages[pageIndex - 1];
      if (!previous.page.has_more || !previous.page.next_cursor) {
        fail(`pagina ${pageIndex + 1} no tiene un cursor predecesor valido`);
      }
    }
    page.items.forEach((item) => {
      if (queueIds.has(item.queue_id)) fail(`queue_id repetido entre paginas: ${item.queue_id}`);
      queueIds.add(item.queue_id);
    });
  });

  return pages;
};

const asOptionalText = (value: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const readSearchEnum = <T extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowed: readonly T[],
  errors: string[],
): T | undefined => {
  const value = asOptionalText(searchParams.get(key));
  if (!value) return undefined;
  if (!allowed.includes(value as T)) {
    errors.push(`El filtro ${key} no pertenece al contrato v1.`);
    return undefined;
  }
  return value as T;
};

export const parseOperationalQueueSearchParams = (searchParams: URLSearchParams): OperationalQueueSearchState => {
  const errors: string[] = [];
  const allowedKeys = new Set(['queue', 'sla', 'age', 'assignee', 'source_model', 'category', 'limit']);
  const seenUnknownKeys = new Set<string>();
  searchParams.forEach((_value, key) => {
    if (!allowedKeys.has(key) && !seenUnknownKeys.has(key)) {
      errors.push(`El parametro ${key} no pertenece al contrato v1.`);
      seenUnknownKeys.add(key);
    }
  });
  allowedKeys.forEach((key) => {
    if (searchParams.getAll(key).length > 1) errors.push(`El parametro ${key} no puede repetirse.`);
  });

  const queue = asOptionalText(searchParams.get('queue'));
  if (searchParams.has('queue') && !queue) errors.push('queue no puede estar vacio.');
  if (queue && queue !== 'open') errors.push('La bandeja v1 solo admite queue=open.');

  const rawLimit = asOptionalText(searchParams.get('limit'));
  let limit = OPERATIONAL_QUEUE_DEFAULT_LIMIT;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!/^\d+$/.test(rawLimit) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > OPERATIONAL_QUEUE_MAX_LIMIT) {
      errors.push(`limit debe ser un entero entre 1 y ${OPERATIONAL_QUEUE_MAX_LIMIT}.`);
    } else {
      limit = parsed;
    }
  } else if (searchParams.has('limit')) {
    errors.push('limit no puede estar vacio.');
  }

  const assignee = asOptionalText(searchParams.get('assignee'));
  if (searchParams.has('assignee') && !assignee) errors.push('assignee no puede estar vacio.');
  if (assignee && assignee !== 'unassigned' && (!/^[1-9]\d*$/.test(assignee) || !Number.isSafeInteger(Number(assignee)))) {
    errors.push('El filtro assignee debe ser un id entero positivo o unassigned.');
  }
  const category = asOptionalText(searchParams.get('category'))?.toLowerCase();
  if (searchParams.has('category') && !category) errors.push('category no puede estar vacio.');
  if (category && category.length > 100) errors.push('category no puede superar 100 caracteres.');

  (['sla', 'age', 'source_model'] as const).forEach((key) => {
    if (searchParams.has(key) && !asOptionalText(searchParams.get(key))) {
      errors.push(`${key} no puede estar vacio.`);
    }
  });

  return {
    filters: {
      queue: 'open',
      sla: readSearchEnum(searchParams, 'sla', OPERATIONAL_QUEUE_SLA_STATES, errors),
      age: readSearchEnum(searchParams, 'age', OPERATIONAL_QUEUE_AGE_BUCKETS, errors),
      assignee:
        assignee &&
        (assignee === 'unassigned' || (/^[1-9]\d*$/.test(assignee) && Number.isSafeInteger(Number(assignee))))
          ? assignee
          : undefined,
      source_model: readSearchEnum(searchParams, 'source_model', OPERATIONAL_QUEUE_SOURCE_MODELS, errors),
      category: category && category.length <= 100 ? category : undefined,
    },
    limit,
    errors,
  };
};

export const buildOperationalQueueSearchParams = (
  filters: OperationalQueueFilters,
  limit = OPERATIONAL_QUEUE_DEFAULT_LIMIT,
): URLSearchParams => {
  const unknownFilter = Object.keys(filters).find(
    (key) => !['queue', 'sla', 'age', 'assignee', 'source_model', 'category'].includes(key),
  );
  if (unknownFilter) fail(`filtro desconocido: ${unknownFilter}`);
  if (filters.queue !== 'open') fail('queue debe ser open');
  if (filters.sla !== undefined && !OPERATIONAL_QUEUE_SLA_STATES.includes(filters.sla)) {
    fail('sla no pertenece al contrato v1');
  }
  if (filters.age !== undefined && !OPERATIONAL_QUEUE_AGE_BUCKETS.includes(filters.age)) {
    fail('age no pertenece al contrato v1');
  }
  if (filters.source_model !== undefined && !OPERATIONAL_QUEUE_SOURCE_MODELS.includes(filters.source_model)) {
    fail('source_model no pertenece al contrato v1');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > OPERATIONAL_QUEUE_MAX_LIMIT) {
    fail(`limit debe estar entre 1 y ${OPERATIONAL_QUEUE_MAX_LIMIT}`);
  }
  const search = new URLSearchParams();
  search.set('queue', 'open');
  if (filters.sla) search.set('sla', filters.sla);
  if (filters.age) search.set('age', filters.age);
  if (
    filters.assignee &&
    filters.assignee !== 'unassigned' &&
    (!/^[1-9]\d*$/.test(filters.assignee) || !Number.isSafeInteger(Number(filters.assignee)))
  ) {
    fail('assignee debe ser un id entero positivo o unassigned');
  }
  if (filters.assignee) search.set('assignee', filters.assignee.trim());
  if (filters.source_model) search.set('source_model', filters.source_model);
  const category = filters.category?.trim().toLowerCase();
  if (filters.category !== undefined && (!category || category.length > 100)) {
    fail('category debe tener entre 1 y 100 caracteres');
  }
  if (category) search.set('category', category);
  search.set('limit', String(limit));
  return search;
};

export const operationalQueueQueryKey = (
  tenantSlug: string,
  filters: OperationalQueueFilters,
  limit: number,
) => [
  'v2-operational-queue',
  tenantSlug,
  filters.queue,
  filters.sla ?? '',
  filters.age ?? '',
  filters.assignee?.trim() ?? '',
  filters.source_model ?? '',
  filters.category?.trim().toLowerCase() ?? '',
  limit,
] as const;

export const getOperationalQueuePage = async ({
  tenantSlug,
  filters,
  cursor,
  limit = OPERATIONAL_QUEUE_DEFAULT_LIMIT,
}: GetOperationalQueuePageInput): Promise<OperationalQueuePage> => {
  const tenant = tenantSlug.trim();
  if (!tenant) fail('tenantSlug es obligatorio');
  const search = buildOperationalQueueSearchParams(filters, limit);
  if (cursor !== undefined && cursor !== null) search.set('cursor', readString(cursor, 'cursor'));
  const response = await panelApi.get<unknown>(`/api/v2/inbox/operational-queue?${search.toString()}`, {
    tenantSlug: tenant,
  });
  return parseOperationalQueueResponse(response, { tenantSlug: tenant, filters, limit });
};
