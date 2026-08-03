import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOperationalQueuePageMock } = vi.hoisted(() => ({
  getOperationalQueuePageMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => vi.importActual('react-router-dom'));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('./operationalQueueApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./operationalQueueApi')>();
  return { ...actual, getOperationalQueuePage: getOperationalQueuePageMock };
});

import TicketsBoardPage from './TicketsBoardPage';
import type {
  OperationalQueueFilters,
  OperationalQueuePage,
  OperationalQueueSourceModel,
} from './operationalQueueApi';

const fingerprint = (letter: string) => letter.repeat(64);

const makeItem = (sourceModel: OperationalQueueSourceModel, sourceId: number, title: string) => ({
  queue_id: `${sourceModel}:${sourceId}`,
  source_model: sourceModel,
  source_id: String(sourceId),
  title,
  status: 'open',
  category: 'luminaria',
  channel: 'whatsapp',
  priority: 'normal',
  assignee_id: null,
  created_at: '2026-08-02T10:00:00Z',
  updated_at: null,
  age_bucket: '1h_4h' as const,
  sla: {
    eligible: true,
    known: false,
    state: 'unknown' as const,
    breached: false,
    at_risk: false,
    due_at: null,
    seconds_to_due: null,
    evidence: [],
    raw_state: null,
  },
  detail_endpoint: `/api/v2/tickets/${sourceId}`,
});

const makePage = ({
  tenant = 'junin',
  items = [makeItem('TenantTicket', 1, 'Luminaria sin servicio')],
  hasMore = false,
  nextCursor = null as string | null,
  filters = { queue: 'open' } as OperationalQueueFilters,
  scope = fingerprint('a'),
  filtersHash = fingerprint('b'),
  asOf = '2026-08-02T12:00:00Z',
}: {
  tenant?: string;
  items?: ReturnType<typeof makeItem>[];
  hasMore?: boolean;
  nextCursor?: string | null;
  filters?: OperationalQueueFilters;
  scope?: string;
  filtersHash?: string;
  asOf?: string;
} = {}): OperationalQueuePage => {
  const sourceCounts = { TenantTicket: 0, MunicipioTicket: 0, PymeTicket: 0 };
  items.forEach((item) => { sourceCounts[item.source_model] += 1; });
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
    tenant_slug: tenant,
    scope_fingerprint: scope,
    filters_fingerprint: filtersHash,
    as_of: asOf,
    filters: {
      queue: 'open',
      sla: filters.sla ?? null,
      age: filters.age ?? null,
      assignee: filters.assignee ?? null,
      source_model: filters.source_model ?? null,
      category: filters.category ?? null,
    },
    access_scope: { mode: 'tenant_wide', category_count: 0 },
    items,
    page: {
      limit: 25,
      returned: items.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      source_counts: sourceCounts,
    },
    request_id: `req-${tenant}`,
  };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function TestRoutes() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route path="/tickets/board" element={<TicketsBoardPage />} />
        <Route path="/t/:tenant/tickets/board" element={<TicketsBoardPage />} />
      </Routes>
    </>
  );
}

const boardTree = (queryClient: QueryClient, entry: string) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter key={entry} initialEntries={[entry]}>
        <TestRoutes />
      </MemoryRouter>
    </QueryClientProvider>
);

const renderBoard = (entry = '/t/junin/tickets/board') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return { ...render(boardTree(queryClient, entry)), queryClient };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('TicketsBoardPage operational queue', () => {
  beforeEach(() => getOperationalQueuePageMock.mockReset());

  it('usa tenant y filtros canonicos de la URL y explica la consistencia viva', async () => {
    getOperationalQueuePageMock.mockResolvedValue(makePage({
      filters: { queue: 'open', sla: 'breached', category: 'luminaria' },
    }));

    renderBoard('/t/junin/tickets/board?queue=open&sla=breached&category=Luminaria&limit=25');

    expect(await screen.findByText('Luminaria sin servicio')).toBeInTheDocument();
    expect(getOperationalQueuePageMock).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      filters: {
        queue: 'open',
        sla: 'breached',
        age: undefined,
        assignee: undefined,
        source_model: undefined,
        category: 'luminaria',
      },
      cursor: null,
      limit: 25,
    });
    expect(screen.getByText('Lectura operativa viva, no snapshot historico')).toBeInTheDocument();
    expect(screen.getByText(/sin fecha se incluyen al final como calidad desconocida/)).toBeInTheDocument();
    expect(screen.getByText('1', { selector: 'p.text-3xl' })).toBeInTheDocument();
  });

  it('abre cada item en el workspace local con identidad de origen explicita', async () => {
    getOperationalQueuePageMock.mockResolvedValue(makePage({
      items: [makeItem('PymeTicket', 44, 'Pedido demorado')],
    }));

    renderBoard('/t/junin/tickets/board');

    const openLink = await screen.findByRole('link', { name: /abrir caso/i });
    expect(openLink).toHaveAttribute(
      'href',
      '/t/junin/tickets?ticket_id=44&source_model=PymeTicket&focus=operational_queue',
    );
  });

  it('reinicia la cadena al refrescar manualmente y no mezcla cursores de otra lectura', async () => {
    getOperationalQueuePageMock
      .mockResolvedValueOnce(makePage({ hasMore: true, nextCursor: 'cursor-old-page-2' }))
      .mockResolvedValueOnce(makePage({
        items: [makeItem('MunicipioTicket', 2, 'Segunda pagina anterior')],
      }))
      .mockResolvedValueOnce(makePage({
        items: [makeItem('TenantTicket', 3, 'Primera pagina actualizada')],
        asOf: '2026-08-02T12:05:00Z',
      }));

    renderBoard();
    expect(await screen.findByText('Luminaria sin servicio')).toBeInTheDocument();
    expect(screen.getByText('Auto cada 30 s')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cargar mas' }));
    expect(await screen.findByText('Segunda pagina anterior')).toBeInTheDocument();
    expect(screen.getByText('Actualizacion manual con varias paginas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar desde el inicio' }));

    expect(await screen.findByText('Primera pagina actualizada')).toBeInTheDocument();
    expect(screen.queryByText('Segunda pagina anterior')).not.toBeInTheDocument();
    expect(getOperationalQueuePageMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      cursor: null,
    }));
    expect(screen.getByText('Auto cada 30 s')).toBeInTheDocument();
  });

  it('conserva la primera pagina y ofrece retry cuando falla el append', async () => {
    getOperationalQueuePageMock
      .mockResolvedValueOnce(makePage({ hasMore: true, nextCursor: 'cursor-page-2' }))
      .mockRejectedValueOnce(new Error('upstream timeout'));

    renderBoard();
    expect(await screen.findByText('Luminaria sin servicio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar mas' }));

    expect(await screen.findByText(/No se pudo cargar la pagina siguiente/)).toBeInTheDocument();
    expect(screen.getByText('Luminaria sin servicio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar pagina' })).toBeInTheDocument();
    expect(getOperationalQueuePageMock).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-page-2' }));
  });

  it('rechaza una pagina adicional con ancla cruzada sin perder los datos aceptados', async () => {
    getOperationalQueuePageMock
      .mockResolvedValueOnce(makePage({ hasMore: true, nextCursor: 'cursor-page-2' }))
      .mockResolvedValueOnce(makePage({
        items: [makeItem('MunicipioTicket', 4, 'Pagina de otra lectura')],
        asOf: '2026-08-02T12:01:00Z',
      }));

    renderBoard();
    expect(await screen.findByText('Luminaria sin servicio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar mas' }));

    expect(await screen.findByText(/No se pudo cargar la pagina siguiente/)).toBeInTheDocument();
    expect(screen.getByText('Luminaria sin servicio')).toBeInTheDocument();
    expect(screen.queryByText('Pagina de otra lectura')).not.toBeInTheDocument();
  });

  it('reinicia paginas y cursor al reemplazar filtros desde la URL', async () => {
    const first = makePage({ hasMore: true, nextCursor: 'cursor-old' });
    const second = makePage({
      items: [makeItem('MunicipioTicket', 2, 'Segunda pagina anterior')],
      filtersHash: fingerprint('b'),
    });
    const filtered = makePage({
      items: [makeItem('PymeTicket', 3, 'Resultado saludable')],
      filters: { queue: 'open', sla: 'healthy' },
      filtersHash: fingerprint('c'),
    });
    getOperationalQueuePageMock
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(filtered);

    renderBoard('/t/junin/tickets/board?queue=open&limit=25');
    expect(await screen.findByText('Luminaria sin servicio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar mas' }));
    expect(await screen.findByText('Segunda pagina anterior')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('SLA'), { target: { value: 'healthy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByText('Resultado saludable')).toBeInTheDocument();
    expect(screen.queryByText('Segunda pagina anterior')).not.toBeInTheDocument();
    expect(getOperationalQueuePageMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      cursor: null,
      filters: expect.objectContaining({ sla: 'healthy' }),
    }));
    expect(screen.getByTestId('location')).toHaveTextContent('/t/junin/tickets/board?queue=open&sla=healthy&limit=25');
  });

  it('descarta aliases de URL al aplicar el formulario y no consulta mientras son invalidos', async () => {
    getOperationalQueuePageMock.mockResolvedValue(makePage());
    renderBoard('/t/junin/tickets/board?estado=vencido&cursor=forged');

    expect(await screen.findByText('Filtros no validos')).toBeInTheDocument();
    expect(getOperationalQueuePageMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByText('Luminaria sin servicio')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/t/junin/tickets/board?queue=open&limit=25');
  });

  it('protege la vista frente a respuestas tardias de otro tenant', async () => {
    const junin = deferred<OperationalQueuePage>();
    const mendoza = deferred<OperationalQueuePage>();
    getOperationalQueuePageMock.mockImplementation((input?: { tenantSlug: string }) =>
      input?.tenantSlug === 'junin' ? junin.promise : mendoza.promise,
    );

    const view = renderBoard('/t/junin/tickets/board');
    await waitFor(() => expect(getOperationalQueuePageMock).toHaveBeenCalledTimes(1));
    view.rerender(boardTree(view.queryClient, '/t/mendoza/tickets/board'));
    await waitFor(() => expect(getOperationalQueuePageMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      mendoza.resolve(makePage({
        tenant: 'mendoza',
        items: [makeItem('TenantTicket', 8, 'Caso Mendoza')],
        scope: fingerprint('m'),
      }));
    });
    expect(await screen.findByText('Caso Mendoza')).toBeInTheDocument();

    await act(async () => {
      junin.resolve(makePage({ items: [makeItem('TenantTicket', 9, 'Caso tardio Junin')] }));
    });
    expect(screen.queryByText('Caso tardio Junin')).not.toBeInTheDocument();
    expect(screen.getByText('Caso Mendoza')).toBeInTheDocument();
  });

  it('protege la vista frente a respuestas tardias de filtros anteriores', async () => {
    const unfiltered = deferred<OperationalQueuePage>();
    const healthy = deferred<OperationalQueuePage>();
    getOperationalQueuePageMock.mockImplementation((input?: { filters: OperationalQueueFilters }) =>
      input?.filters.sla === 'healthy' ? healthy.promise : unfiltered.promise,
    );

    renderBoard('/t/junin/tickets/board?queue=open&limit=25');
    await waitFor(() => expect(getOperationalQueuePageMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('SLA'), { target: { value: 'healthy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(getOperationalQueuePageMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      healthy.resolve(makePage({
        items: [makeItem('PymeTicket', 11, 'Caso con SLA saludable')],
        filters: { queue: 'open', sla: 'healthy' },
        filtersHash: fingerprint('c'),
      }));
    });
    expect(await screen.findByText('Caso con SLA saludable')).toBeInTheDocument();

    await act(async () => {
      unfiltered.resolve(makePage({ items: [makeItem('TenantTicket', 12, 'Resultado anterior tardio')] }));
    });
    expect(screen.queryByText('Resultado anterior tardio')).not.toBeInTheDocument();
    expect(screen.getByText('Caso con SLA saludable')).toBeInTheDocument();
  });
});
