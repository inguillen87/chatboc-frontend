import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeLocalStorage } from '@/utils/safeLocalStorage';
import type { QueuedAction } from './OfflineDraftQueue';
import { OfflineDraftQueue, OfflineDraftQueueSyncError } from './OfflineDraftQueue';

const asRecord = (value: unknown) => value as Record<string, unknown>;
const QUEUE_KEY = 'chatboc_offline_draft_queue';
const TENANT_A_SCOPE = 'chatboc:survey-builder:draft:v2:tenant-a:operator-a';
const TENANT_B_SCOPE = 'chatboc:survey-builder:draft:v2:tenant-b:operator-b';
const TENANT_A_OPERATOR_B_SCOPE = 'chatboc:survey-builder:draft:v2:tenant-a:operator-b';

const durableAckFor = (
  action: QueuedAction,
  revision = 1,
  override: Record<string, unknown> = {},
) => {
  const payload = asRecord(action.payload);
  return {
    ok: true,
    contract_version: 'surveys.draft.v2',
    persisted: true,
    draft_id: payload.draft_id,
    idempotency_key: payload.idempotency_key,
    revision,
    tenant: { id: 1, slug: action.tenantScope },
    ...override,
  };
};

describe('OfflineDraftQueue durable survey drafts', () => {
  beforeEach(() => {
    OfflineDraftQueue.clearQueue();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    OfflineDraftQueue.clearQueue();
  });

  it('keeps a survey draft queued and rejects sync when the parsed ack is not durable', async () => {
    const action = OfflineDraftQueue.addAction('survey_draft', {
      title: 'Encuesta offline',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const storedBefore = safeLocalStorage.getItem(QUEUE_KEY);
    const apiClient = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(durableAckFor(action, 1, { persisted: false })),
    });

    await expect(
      OfflineDraftQueue.syncQueue(apiClient, {
        types: ['survey_draft'],
        tenantScope: 'tenant-a',
        scopeKey: TENANT_A_SCOPE,
      }),
    ).rejects.toBeInstanceOf(OfflineDraftQueueSyncError);

    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(storedBefore);
    expect(OfflineDraftQueue.getQueue()).toEqual([action]);
    expect(asRecord(action.payload).draft_id).toEqual(expect.any(String));
    expect(asRecord(action.payload).idempotency_key).toEqual(expect.any(String));
  });

  it('removes a survey draft only after a complete ack bound to its exact operation', async () => {
    const action = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'stable-draft-id',
      idempotency_key: 'stable-operation-key',
      revision: 2,
      title: 'Encuesta durable',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const rawAck = durableAckFor(action, 3);
    const normalizedAck = {
      contract_version: 'surveys.draft.v2',
      persisted: true,
      draft_id: 'stable-draft-id',
      revision: 3,
      raw: rawAck,
    };
    const apiClient = vi.fn().mockResolvedValue(normalizedAck);

    const synced = await OfflineDraftQueue.syncQueue(apiClient, {
      types: ['survey_draft'],
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    });

    expect(apiClient).toHaveBeenCalledWith('/api/v2/surveys/draft', {
      method: 'POST',
      body: action.payload,
    });
    expect(synced).toEqual([{ action, response: normalizedAck }]);
    expect(OfflineDraftQueue.getQueue()).toEqual([]);
  });

  it.each([
    ['contract', { contract_version: 'surveys.draft.v1' }],
    ['persisted flag', { persisted: false }],
    ['draft id', { draft_id: 'another-draft' }],
    ['idempotency key', { idempotency_key: 'another-operation' }],
    ['positive revision', { revision: 0 }],
    ['non-regressive revision', { revision: 1 }],
    ['tenant', { tenant: { id: 2, slug: 'tenant-b' } }],
    ['optional scope evidence', { scope_key: TENANT_A_OPERATOR_B_SCOPE }],
  ])('quarantines an ack with a mismatched %s without rotating its key', async (_label, override) => {
    const action = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'bound-draft',
      idempotency_key: 'bound-operation',
      revision: 2,
      title: 'No perder',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const storedBefore = safeLocalStorage.getItem(QUEUE_KEY);
    const apiClient = vi.fn().mockResolvedValue(durableAckFor(action, 3, override));

    await expect(OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    })).rejects.toThrow(/cuarentena/i);

    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(storedBefore);
    expect(asRecord(OfflineDraftQueue.getQueue()[0].payload).idempotency_key).toBe('bound-operation');
  });

  it('quarantines an invalid action binding before making a request', async () => {
    const action = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'cross-tenant-draft',
      idempotency_key: 'cross-tenant-operation',
      tenant_slug: 'tenant-b',
      title: 'Tenant incorrecto',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const storedBefore = safeLocalStorage.getItem(QUEUE_KEY);
    const apiClient = vi.fn();

    await expect(OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    })).rejects.toThrow(/vinculo durable valido/i);

    expect(apiClient).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(storedBefore);
    expect(asRecord(action.payload).idempotency_key).toBe('cross-tenant-operation');
  });

  it('preserves a draft and its key when the request fails or returns a conflict', async () => {
    const action = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'conflicting-draft',
      idempotency_key: 'conflicting-operation',
      revision: 4,
      title: 'Resolver manualmente',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const storedBefore = safeLocalStorage.getItem(QUEUE_KEY);
    const conflict = { response: { status: 409, data: { reason_code: 'draft_idempotency_conflict' } } };
    const apiClient = vi.fn().mockRejectedValue(conflict);

    await expect(OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    })).rejects.toBeInstanceOf(OfflineDraftQueueSyncError);

    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(storedBefore);
    expect(asRecord(OfflineDraftQueue.getQueue()[0].payload).idempotency_key).toBe('conflicting-operation');
    expect(asRecord(action.payload).idempotency_key).toBe('conflicting-operation');
  });

  it('exposes prior durable acknowledgements when a later draft in the same scope fails', async () => {
    const acknowledgedAction = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'acknowledged-draft',
      idempotency_key: 'acknowledged-operation',
      revision: 2,
      title: 'Persistir primero',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const failedAction = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'failed-draft',
      idempotency_key: 'failed-operation',
      revision: 1,
      title: 'Fallar despues',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const acknowledgedResponse = durableAckFor(acknowledgedAction, 3);
    const apiClient = vi.fn().mockImplementation(async (_path, options) => {
      if (asRecord(options.body).draft_id === 'acknowledged-draft') return acknowledgedResponse;
      return durableAckFor(failedAction, 2, { idempotency_key: 'mismatched-operation' });
    });

    let syncError: unknown;
    try {
      await OfflineDraftQueue.syncQueue(apiClient, {
        tenantScope: 'tenant-a',
        scopeKey: TENANT_A_SCOPE,
      });
    } catch (error) {
      syncError = error;
    }

    expect(syncError).toBeInstanceOf(OfflineDraftQueueSyncError);
    expect(syncError).toMatchObject({
      action: failedAction,
      synced: [{ action: acknowledgedAction, response: acknowledgedResponse }],
    });
    expect(OfflineDraftQueue.getQueue()).toEqual([failedAction]);
    expect(apiClient).toHaveBeenCalledTimes(2);
  });

  it('never dispatches or deletes legacy response and ticket actions', async () => {
    const legacyTicket = OfflineDraftQueue.addAction(
      'create_ticket_draft',
      { title: 'Reclamo pendiente' },
      { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE },
    );
    const legacyResponse = OfflineDraftQueue.addAction(
      'survey_response',
      { answers: { q1: 'privado' } },
      { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE },
    );
    const storedBefore = safeLocalStorage.getItem(QUEUE_KEY);
    const apiClient = vi.fn();

    expect(await OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    })).toEqual([]);
    expect(await OfflineDraftQueue.syncQueue(apiClient, {
      types: ['create_ticket_draft', 'survey_response'],
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    })).toEqual([]);

    expect(apiClient).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(storedBefore);
    expect(OfflineDraftQueue.getQueue()).toEqual([legacyTicket, legacyResponse]);
  });

  it('preserves unknown and legacy entries byte-for-byte while removing an acknowledged draft', async () => {
    const unknownRaw = '{ "id":"future", "type":"future_action", "payload":{"encoded":"\\u00f1"}, "x": 1 }';
    const legacyRaw = '{"id":"legacy-ticket","type":"create_ticket_draft","payload":{"note":"keep, [exact]"},"timestamp":"2026-07-28T10:00:00.000Z","tenantScope":"tenant-a","scopeKey":"scope-a"}';
    const action: QueuedAction = {
      id: 'durable-action',
      type: 'survey_draft',
      payload: {
        draft_id: 'durable-draft',
        idempotency_key: 'durable-operation',
        revision: 1,
        title: 'Enviar',
      },
      timestamp: '2026-07-28T11:00:00.000Z',
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    };
    safeLocalStorage.setItem(
      QUEUE_KEY,
      `[\n${unknownRaw},\n ${legacyRaw},\n${JSON.stringify(action)}\n]`,
    );
    const apiClient = vi.fn().mockResolvedValue(durableAckFor(action, 2));

    await OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    });

    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(`[\n${unknownRaw},\n ${legacyRaw}]`);
    expect(apiClient).toHaveBeenCalledTimes(1);
  });

  it('does not rewrite storage when only unknown and legacy actions exist', async () => {
    const raw = ` [\n {"id":"unknown","type":"v3_action","payload":{"escaped":"\\u0061"}},\n {"id":"legacy","type":"survey_response","payload":{"answer":"secret"},"timestamp":"2026-07-28T10:00:00.000Z","tenantScope":"tenant-a","scopeKey":"${TENANT_A_SCOPE}"}\n ] `;
    safeLocalStorage.setItem(QUEUE_KEY, raw);
    const apiClient = vi.fn();

    expect(await OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    })).toEqual([]);

    expect(apiClient).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(raw);
  });

  it('coalesces repeated offline saves for one stable draft without reusing an operation key', () => {
    const first = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'draft-coalesced',
      title: 'Primera version',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });
    const second = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'draft-coalesced',
      title: 'Version mas nueva',
      questions: [],
    }, { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE });

    const queue = OfflineDraftQueue.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(second.id);
    expect(asRecord(queue[0].payload)).toMatchObject({
      draft_id: 'draft-coalesced',
      title: 'Version mas nueva',
    });
    expect(asRecord(first.payload).idempotency_key).not.toBe(asRecord(second.payload).idempotency_key);
  });

  it('isolates equal draft ids by tenant and flushes only the active tenant', async () => {
    const tenantAAction = OfflineDraftQueue.addAction(
      'survey_draft',
      { draft_id: 'shared-client-id', title: 'Contenido A', questions: [] },
      { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE },
    );
    const tenantBAction = OfflineDraftQueue.addAction(
      'survey_draft',
      { draft_id: 'shared-client-id', title: 'Contenido B', questions: [] },
      { tenantScope: 'tenant-b', scopeKey: TENANT_B_SCOPE },
    );
    const apiClient = vi.fn().mockImplementation(async (_path, options) => {
      const selectedAction = asRecord(options.body).draft_id === 'shared-client-id'
        ? tenantAAction
        : tenantBAction;
      return durableAckFor(selectedAction, 1);
    });

    const synced = await OfflineDraftQueue.syncQueue(apiClient, {
      types: ['survey_draft'],
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    });

    expect(synced.map(({ action }) => action.id)).toEqual([tenantAAction.id]);
    expect(OfflineDraftQueue.getQueue()).toEqual([tenantBAction]);
  });

  it('isolates operators inside the same tenant after logout and login', async () => {
    const operatorAAction = OfflineDraftQueue.addAction(
      'survey_draft',
      { draft_id: 'same-tenant-draft', title: 'Privado de operador A', questions: [] },
      { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE },
    );
    const operatorBAction = OfflineDraftQueue.addAction(
      'survey_draft',
      { draft_id: 'same-tenant-draft', title: 'Privado de operador B', questions: [] },
      { tenantScope: 'tenant-a', scopeKey: TENANT_A_OPERATOR_B_SCOPE },
    );
    const apiClient = vi.fn().mockResolvedValue(durableAckFor(operatorBAction, 1));

    const synced = await OfflineDraftQueue.syncQueue(apiClient, {
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_OPERATOR_B_SCOPE,
    });

    expect(synced.map(({ action }) => action.id)).toEqual([operatorBAction.id]);
    expect(OfflineDraftQueue.getQueue()).toEqual([operatorAAction]);
  });

  it('retains legacy unscoped survey drafts instead of sending them into the active tenant', async () => {
    const legacyAction = {
      id: 'legacy-action',
      type: 'survey_draft' as const,
      payload: {
        draft_id: 'legacy-unscoped',
        idempotency_key: 'legacy-operation',
        title: 'Tenant desconocido',
        questions: [],
      },
      timestamp: '2026-07-28T10:00:00.000Z',
      tenantScope: 'tenant-a',
    };
    safeLocalStorage.setItem(QUEUE_KEY, JSON.stringify([legacyAction]));
    const storedBefore = safeLocalStorage.getItem(QUEUE_KEY);
    const apiClient = vi.fn();

    const synced = await OfflineDraftQueue.syncQueue(apiClient, {
      types: ['survey_draft'],
      tenantScope: 'tenant-a',
      scopeKey: TENANT_A_SCOPE,
    });

    expect(synced).toEqual([]);
    expect(apiClient).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(storedBefore);
    expect(OfflineDraftQueue.getQueue()).toEqual([legacyAction]);
  });

  it('refuses to create a new unscoped survey draft action', () => {
    expect(() =>
      OfflineDraftQueue.addAction('survey_draft', {
        draft_id: 'missing-scope',
        title: 'Sin tenant',
        questions: [],
      }, { tenantScope: 'tenant-a' }),
    ).toThrow(/scopeKey/i);
    expect(OfflineDraftQueue.getQueue()).toEqual([]);
  });

  it('preserves malformed storage instead of replacing it when a new action is added', () => {
    const malformed = '[{"id":"do-not-erase"}';
    safeLocalStorage.setItem(QUEUE_KEY, malformed);

    expect(() => OfflineDraftQueue.addAction(
      'survey_draft',
      { draft_id: 'new-draft', title: 'Nuevo' },
      { tenantScope: 'tenant-a', scopeKey: TENANT_A_SCOPE },
    )).toThrow(/conservo sin cambios/i);
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(malformed);
  });
});
