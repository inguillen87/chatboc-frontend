import { safeLocalStorage } from '@/utils/safeLocalStorage';

export interface QueuedAction {
  id: string;
  type: 'create_ticket_draft' | 'survey_response' | 'survey_draft';
  payload: unknown;
  timestamp: string;
  tenantScope?: string;
  scopeKey?: string;
}

export interface SyncedQueuedAction {
  action: QueuedAction;
  response: unknown;
}

export interface SyncQueueOptions {
  types?: QueuedAction['type'][];
  tenantScope?: string | null;
  scopeKey?: string | null;
}

export interface AddQueueActionOptions {
  tenantScope?: string | null;
  scopeKey?: string | null;
}

type ApiFetchClient = (
  path: string,
  options: { method: 'POST'; body: unknown },
) => Promise<unknown>;

const QUEUE_KEY = 'chatboc_offline_draft_queue';
const SURVEY_DRAFT_CONTRACT_VERSION = 'surveys.draft.v2';

interface StoredQueueEntry {
  raw: string;
  value: unknown;
}

interface StoredQueueSnapshot {
  prefix: string;
  suffix: string;
  entries: StoredQueueEntry[];
}

interface SurveyDraftActionBinding {
  draftId: string;
  idempotencyKey: string;
  requestedRevision?: number;
  tenantScope: string;
  scopeKey: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const isQueuedActionType = (value: unknown): value is QueuedAction['type'] =>
  value === 'create_ticket_draft' || value === 'survey_response' || value === 'survey_draft';

const asQueuedAction = (value: unknown): QueuedAction | undefined =>
  isRecord(value) &&
  Boolean(nonEmptyString(value.id)) &&
  isQueuedActionType(value.type) &&
  'payload' in value
    ? (value as unknown as QueuedAction)
    : undefined;

const splitStoredQueueEntries = (content: string): string[] | undefined => {
  if (!content.trim()) return [];

  const entries: string[] = [];
  let start = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{' || character === '[') {
      depth += 1;
    } else if (character === '}' || character === ']') {
      depth -= 1;
      if (depth < 0) return undefined;
    } else if (character === ',' && depth === 0) {
      entries.push(content.slice(start, index));
      start = index + 1;
    }
  }

  if (inString || depth !== 0) return undefined;
  entries.push(content.slice(start));
  return entries;
};

const readStoredQueueSnapshot = (): StoredQueueSnapshot | undefined => {
  const raw = safeLocalStorage.getItem(QUEUE_KEY);
  if (raw === null) return { prefix: '[', suffix: ']', entries: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;

    const openingBracket = raw.indexOf('[');
    const closingBracket = raw.lastIndexOf(']');
    if (openingBracket < 0 || closingBracket < openingBracket) return undefined;
    const rawEntries = splitStoredQueueEntries(raw.slice(openingBracket + 1, closingBracket));
    if (!rawEntries || rawEntries.length !== parsed.length) return undefined;

    return {
      prefix: raw.slice(0, openingBracket + 1),
      suffix: raw.slice(closingBracket),
      entries: parsed.map((value, index) => ({ value, raw: rawEntries[index] })),
    };
  } catch {
    return undefined;
  }
};

const writeStoredQueueSnapshot = (
  snapshot: StoredQueueSnapshot,
  entries: StoredQueueEntry[],
  appendedValues: unknown[] = [],
) => {
  const appendedEntries = appendedValues.map((value) => JSON.stringify(value));
  safeLocalStorage.setItem(
    QUEUE_KEY,
    `${snapshot.prefix}${[...entries.map((entry) => entry.raw), ...appendedEntries].join(',')}${snapshot.suffix}`,
  );
};

const createStableId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeSurveyDraftPayload = (payload: unknown): Record<string, unknown> => {
  const source = isRecord(payload) ? payload : {};
  const draftId = nonEmptyString(source.draft_id) ?? createStableId();

  return {
    ...source,
    draft_id: draftId,
    idempotency_key: nonEmptyString(source.idempotency_key) ?? `survey-draft-${draftId}-${createStableId()}`,
  };
};

const parseApiResponse = async (response: unknown): Promise<unknown> => {
  if (isRecord(response) && typeof response.json === 'function') {
    return (response.json as () => Promise<unknown>)();
  }
  return response;
};

const resolveSurveyDraftActionBinding = (action: QueuedAction): SurveyDraftActionBinding | undefined => {
  if (action.type !== 'survey_draft' || !isRecord(action.payload)) return undefined;
  const draftId = nonEmptyString(action.payload.draft_id);
  const idempotencyKey = nonEmptyString(action.payload.idempotency_key);
  const tenantScope = nonEmptyString(action.tenantScope);
  const scopeKey = nonEmptyString(action.scopeKey);
  if (!draftId || action.payload.draft_id !== draftId) return undefined;
  if (!idempotencyKey || action.payload.idempotency_key !== idempotencyKey) return undefined;
  if (!tenantScope || action.tenantScope !== tenantScope || !scopeKey || action.scopeKey !== scopeKey) {
    return undefined;
  }

  const requestedRevisionValue = action.payload.revision;
  let requestedRevision: number | undefined;
  if (requestedRevisionValue !== undefined && requestedRevisionValue !== null) {
    if (
      typeof requestedRevisionValue !== 'number' ||
      !Number.isInteger(requestedRevisionValue) ||
      requestedRevisionValue < 0
    ) {
      return undefined;
    }
    requestedRevision = requestedRevisionValue;
  }

  const payloadTenantScope = nonEmptyString(
    action.payload.tenant_scope ?? action.payload.tenantScope ?? action.payload.tenant_slug,
  );
  const payloadScopeKey = nonEmptyString(action.payload.scope_key ?? action.payload.scopeKey);
  if (payloadTenantScope && payloadTenantScope !== tenantScope) return undefined;
  if (payloadScopeKey && payloadScopeKey !== scopeKey) return undefined;

  return { draftId, idempotencyKey, requestedRevision, tenantScope, scopeKey };
};

const isDurableSurveyDraftAck = (
  value: unknown,
  binding: SurveyDraftActionBinding,
): boolean => {
  if (!isRecord(value)) return false;
  const rawAck = isRecord(value.raw) ? value.raw : value;
  if (rawAck.contract_version !== SURVEY_DRAFT_CONTRACT_VERSION || rawAck.persisted !== true) {
    return false;
  }
  if (rawAck.draft_id !== binding.draftId || rawAck.idempotency_key !== binding.idempotencyKey) {
    return false;
  }

  const revision = rawAck.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision <= 0) return false;
  if (binding.requestedRevision !== undefined && revision < binding.requestedRevision) return false;

  const tenant = rawAck.tenant;
  if (!isRecord(tenant) || tenant.slug !== binding.tenantScope) return false;
  const acknowledgedScopeKey = rawAck.scope_key ?? rawAck.scopeKey;
  if (acknowledgedScopeKey !== undefined && acknowledgedScopeKey !== binding.scopeKey) return false;

  if (rawAck !== value) {
    if (
      value.contract_version !== SURVEY_DRAFT_CONTRACT_VERSION ||
      value.persisted !== true ||
      value.draft_id !== binding.draftId ||
      value.revision !== revision
    ) {
      return false;
    }
    if (value.idempotency_key !== undefined && value.idempotency_key !== binding.idempotencyKey) return false;
  }

  return true;
};

export class OfflineDraftQueueSyncError extends Error {
  readonly action: QueuedAction;
  readonly synced: readonly SyncedQueuedAction[];

  constructor(
    action: QueuedAction,
    message: string,
    options?: { cause?: unknown; synced?: readonly SyncedQueuedAction[] },
  ) {
    super(message, options);
    this.name = 'OfflineDraftQueueSyncError';
    this.action = action;
    this.synced = [...(options?.synced ?? [])];
  }
}

export class OfflineDraftQueue {
  static getQueue(): QueuedAction[] {
    const snapshot = readStoredQueueSnapshot();
    if (!snapshot) return [];
    return snapshot.entries
      .map((entry) => asQueuedAction(entry.value))
      .filter((action): action is QueuedAction => Boolean(action));
  }

  static addAction(type: QueuedAction['type'], payload: unknown, options: AddQueueActionOptions = {}) {
    const snapshot = readStoredQueueSnapshot();
    if (!snapshot) {
      throw new Error('La cola offline existente no es valida y se conservo sin cambios.');
    }
    const normalizedPayload = type === 'survey_draft' ? normalizeSurveyDraftPayload(payload) : payload;
    const tenantScope = nonEmptyString(options.tenantScope);
    const scopeKey = nonEmptyString(options.scopeKey);
    if (type === 'survey_draft' && (!tenantScope || !scopeKey)) {
      throw new Error('No se puede encolar un borrador de encuesta sin tenantScope y scopeKey.');
    }
    const newAction: QueuedAction = {
      id: createStableId(),
      type,
      payload: normalizedPayload,
      timestamp: new Date().toISOString(),
      ...(tenantScope ? { tenantScope } : {}),
      ...(scopeKey ? { scopeKey } : {}),
    };

    const retainedEntries =
      type === 'survey_draft' && isRecord(normalizedPayload)
        ? snapshot.entries.filter(
            (entry) => {
              const action = asQueuedAction(entry.value);
              return (
                !action ||
                action.type !== 'survey_draft' ||
                !isRecord(action.payload) ||
                action.scopeKey !== scopeKey ||
                action.payload.draft_id !== normalizedPayload.draft_id
              );
            },
          )
        : snapshot.entries;

    writeStoredQueueSnapshot(snapshot, retainedEntries, [newAction]);
    return newAction;
  }

  static removeAction(id: string) {
    const snapshot = readStoredQueueSnapshot();
    if (!snapshot) return;
    const retainedEntries = snapshot.entries.filter((entry) => asQueuedAction(entry.value)?.id !== id);
    if (retainedEntries.length === snapshot.entries.length) return;
    writeStoredQueueSnapshot(snapshot, retainedEntries);
  }

  static clearQueue() {
    safeLocalStorage.removeItem(QUEUE_KEY);
  }

  /**
   * Flushes queued actions sequentially. Survey drafts are acknowledged only by
   * the explicit durable-persistence contract; a resolved request by itself is
   * not enough to discard local work.
   */
  static async syncQueue(
    apiFetchClient: ApiFetchClient,
    options: SyncQueueOptions = {},
  ): Promise<SyncedQueuedAction[]> {
    const tenantScope = nonEmptyString(options.tenantScope);
    const scopeKey = nonEmptyString(options.scopeKey);
    const surveyDraftsAllowed = !options.types?.length || options.types.includes('survey_draft');
    const queue = surveyDraftsAllowed
      ? this.getQueue().filter(
          (action) =>
            action.type === 'survey_draft' &&
            Boolean(tenantScope) &&
            Boolean(scopeKey) &&
            action.tenantScope === tenantScope &&
            action.scopeKey === scopeKey,
        )
      : [];
    const synced: SyncedQueuedAction[] = [];
    if (queue.length === 0) return synced;

    for (const action of queue) {
      try {
        const binding = resolveSurveyDraftActionBinding(action);
        if (!binding) {
          throw new OfflineDraftQueueSyncError(
            action,
            'El borrador offline no tiene un vinculo durable valido y quedo en cuarentena.',
            { synced },
          );
        }

        const rawResponse = await apiFetchClient('/api/v2/surveys/draft', {
          method: 'POST',
          body: action.payload,
        });
        const response = await parseApiResponse(rawResponse);
        if (!isDurableSurveyDraftAck(response, binding)) {
          throw new OfflineDraftQueueSyncError(
            action,
            'El ACK no coincide con la operacion durable; el borrador quedo en cuarentena.',
            { synced },
          );
        }

        this.removeAction(action.id);
        synced.push({ action, response });
      } catch (error) {
        console.warn(`[OfflineQueue] No se pudo sincronizar la accion offline ${action.id}`, error);
        if (error instanceof OfflineDraftQueueSyncError) throw error;
        throw new OfflineDraftQueueSyncError(action, 'No se pudo sincronizar el borrador de encuesta.', {
          cause: error,
          synced,
        });
      }
    }

    return synced;
  }
}
