import { beforeEach, describe, expect, it, vi } from 'vitest';

const { panelGetMock } = vi.hoisted(() => ({ panelGetMock: vi.fn() }));

vi.mock('@/api/v2/client', () => ({
  panelApi: { get: panelGetMock },
}));

import {
  OperationalQueueContractError,
  assertOperationalQueuePageChain,
  buildOperationalQueueSearchParams,
  getOperationalQueuePage,
  parseOperationalQueueResponse,
  parseOperationalQueueSearchParams,
} from './operationalQueueApi';

const SCOPE_FINGERPRINT = 'a'.repeat(64);
const FILTERS_FINGERPRINT = 'b'.repeat(64);
const AS_OF = '2026-08-02T12:00:00Z';

const makeItem = (sourceModel = 'TenantTicket', sourceId = 1, title = 'Luminaria sin servicio') => ({
  queue_id: `${sourceModel}:${sourceId}`,
  source_model: sourceModel,
  source_id: sourceId,
  title,
  status: 'open',
  category: 'luminaria',
  channel: 'whatsapp',
  priority: 'normal',
  assignee_id: null,
  created_at: '2026-08-02T10:00:00Z',
  updated_at: null,
  age_bucket: '1h_4h',
  sla: {
    eligible: true,
    known: false,
    state: 'unknown',
    breached: false,
    at_risk: false,
    due_at: null,
    seconds_to_due: null,
    evidence: [],
    raw_state: null,
  },
  detail_endpoint: `/api/v2/tickets/${sourceId}`,
});

const makeResponse = ({
  items = [makeItem()],
  hasMore = false,
  nextCursor = null as string | null,
  tenantSlug = 'junin',
  scopeFingerprint = SCOPE_FINGERPRINT,
  filtersFingerprint = FILTERS_FINGERPRINT,
  asOf = AS_OF,
  filters = {
    queue: 'open',
    sla: null,
    age: null,
    assignee: null,
    source_model: null,
    category: null,
  },
} = {}) => {
  const sourceCounts = { TenantTicket: 0, MunicipioTicket: 0, PymeTicket: 0 };
  items.forEach((item) => {
    sourceCounts[item.source_model as keyof typeof sourceCounts] += 1;
  });
  return {
    contract_version: 'inbox.operational_queue.v1',
    metric_contract: 'operations.queue_truth.v1',
    grain: 'one_current_open_source_record',
    state_consistency: 'created_at_anchored_live_state',
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
    filters,
    access_scope: { mode: 'tenant_wide', category_count: 0 },
    items,
    page: {
      limit: 25,
      returned: items.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      source_counts: sourceCounts,
    },
    request_id: 'req-queue-1',
  };
};

describe('operational queue v1 parser', () => {
  beforeEach(() => panelGetMock.mockReset());

  it('acepta IDs de origen iguales cuando queue_id y source_model son distintos', () => {
    const response = makeResponse({
      items: [
        makeItem('TenantTicket', 7, 'Caso tenant'),
        { ...makeItem('MunicipioTicket', 7, 'Caso municipal'), detail_endpoint: '/api/v2/tickets/7?source_model=MunicipioTicket' },
      ],
    });

    const parsed = parseOperationalQueueResponse(response, { tenantSlug: 'junin' });

    expect(parsed.items.map((item) => item.queue_id)).toEqual(['TenantTicket:7', 'MunicipioTicket:7']);
  });

  it('rechaza contradicciones entre el estado SLA y sus banderas', () => {
    const response = makeResponse();
    response.items[0].sla = {
      ...response.items[0].sla,
      known: true,
      state: 'breached',
      breached: false,
    };

    expect(() => parseOperationalQueueResponse(response)).toThrow(OperationalQueueContractError);
  });

  it('rechaza un queue_id que no liga modelo e identificador', () => {
    const response = makeResponse();
    response.items[0].queue_id = 'TenantTicket:999';

    expect(() => parseOperationalQueueResponse(response)).toThrow(/queue_id/);
  });

  it('acepta created_at ausente solamente con age_bucket unknown', () => {
    const valid = makeResponse();
    valid.items[0].created_at = null as unknown as string;
    valid.items[0].age_bucket = 'unknown';
    expect(parseOperationalQueueResponse(valid).items[0].created_at).toBeNull();

    const contradictory = makeResponse();
    contradictory.items[0].created_at = null as unknown as string;
    expect(() => parseOperationalQueueResponse(contradictory)).toThrow(/created_at y age_bucket/);

    const wrongKnownBucket = makeResponse();
    wrongKnownBucket.items[0].age_bucket = 'lt_1h';
    expect(() => parseOperationalQueueResponse(wrongKnownBucket)).toThrow(/age_bucket no coincide/);
  });

  it('rechaza una politica ambigua para registros sin fecha de creacion', () => {
    const response = makeResponse();
    response.consistency.null_created_at = 'excluded' as 'included_ordered_last';

    expect(() => parseOperationalQueueResponse(response)).toThrow(/null_created_at/);
  });

  it('rechaza metricas, paginacion y filtros que se contradicen', () => {
    const wrongMetric = makeResponse();
    wrongMetric.metric_contract = 'operations.queue_truth.v0';
    expect(() => parseOperationalQueueResponse(wrongMetric)).toThrow(/metric_contract/);

    const wrongReturned = makeResponse();
    wrongReturned.page.returned = 0;
    expect(() => parseOperationalQueueResponse(wrongReturned)).toThrow(/returned/);

    const wrongFilter = makeResponse();
    wrongFilter.filters.queue = 'closed';
    expect(() => parseOperationalQueueResponse(wrongFilter)).toThrow(/filters.queue/);
  });

  it('rechaza tenant, scope, filtros o ancla cruzados entre paginas', () => {
    const first = parseOperationalQueueResponse(makeResponse({ hasMore: true, nextCursor: 'cursor-2' }));
    const mutations = [
      { tenantSlug: 'mendoza' },
      { scopeFingerprint: 'c'.repeat(64) },
      { filtersFingerprint: 'd'.repeat(64) },
      { asOf: '2026-08-02T12:01:00Z' },
    ];

    for (const mutation of mutations) {
      const second = parseOperationalQueueResponse(makeResponse({ items: [], ...mutation }));
      expect(() => assertOperationalQueuePageChain([first, second])).toThrow(OperationalQueueContractError);
    }
  });

  it('rechaza queue_id repetido entre paginas y una pagina sin cursor predecesor', () => {
    const first = parseOperationalQueueResponse(makeResponse({ hasMore: true, nextCursor: 'cursor-2' }));
    const duplicate = parseOperationalQueueResponse(makeResponse());
    expect(() => assertOperationalQueuePageChain([first, duplicate])).toThrow(/queue_id repetido/);

    const terminal = parseOperationalQueueResponse(makeResponse({ items: [] }));
    const extra = parseOperationalQueueResponse(makeResponse({ items: [] }));
    expect(() => assertOperationalQueuePageChain([terminal, extra])).toThrow(/cursor predecesor/);
  });

  it('envia solo query canonica y conserva opaco el cursor del backend', async () => {
    panelGetMock.mockResolvedValue(makeResponse({
      filters: {
        queue: 'open',
        sla: 'breached',
        age: null,
        assignee: null,
        source_model: null,
        category: 'luminaria',
      },
    }));

    await getOperationalQueuePage({
      tenantSlug: 'junin',
      filters: { queue: 'open', sla: 'breached', category: 'Luminaria' },
      cursor: 'opaque+/=',
      limit: 25,
    });

    const [path, options] = panelGetMock.mock.calls[0];
    const url = new URL(path, 'https://example.test');
    expect(url.pathname).toBe('/api/v2/inbox/operational-queue');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      queue: 'open',
      sla: 'breached',
      category: 'luminaria',
      limit: '25',
      cursor: 'opaque+/=',
    });
    expect(options).toEqual({ tenantSlug: 'junin' });
  });
});

describe('operational queue URL filters', () => {
  it('normaliza category y serializa un conjunto canonico reemplazable', () => {
    const parsed = parseOperationalQueueSearchParams(
      new URLSearchParams('queue=open&sla=at_risk&category=Luminaria&assignee=42&limit=50'),
    );

    expect(parsed).toEqual({
      filters: { queue: 'open', sla: 'at_risk', age: undefined, assignee: '42', source_model: undefined, category: 'luminaria' },
      limit: 50,
      errors: [],
    });
    expect(buildOperationalQueueSearchParams(parsed.filters, parsed.limit).toString()).toBe(
      'queue=open&sla=at_risk&assignee=42&category=luminaria&limit=50',
    );
  });

  it('rechaza aliases, parametros desconocidos, repetidos y valores no canonicos', () => {
    const parsed = parseOperationalQueueSearchParams(
      new URLSearchParams('queue=closed&estado=breached&sla=healthy&sla=breached&assignee=0&category=&cursor=forged'),
    );

    expect(parsed.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('estado'),
      expect.stringContaining('cursor'),
      expect.stringContaining('sla no puede repetirse'),
      expect.stringContaining('queue=open'),
      expect.stringContaining('assignee'),
      expect.stringContaining('category no puede estar vacio'),
    ]));
  });
});
