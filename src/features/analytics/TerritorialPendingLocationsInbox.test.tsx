import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '@/utils/api';

import type { OperationsHeatmapV1 } from './analyticsTypes';
import { TerritorialPendingLocationsInbox } from './TerritorialPendingLocationsInbox';
import type {
  TerritorialGeocodingDetail,
  TerritorialGeocodingItem,
  TerritorialGeocodingPreviewQueue,
  TerritorialGeocodingQueue,
} from './territorialGeocodingTypes';

const mocks = vi.hoisted(() => ({
  getOperationsHeatmapV2: vi.fn(),
  getQueue: vi.fn(),
  getPreview: vi.fn(),
  getDetail: vi.fn(),
  getAttempts: vi.fn(),
  review: vi.fn(),
  sync: vi.fn(),
  resolve: vi.fn(),
  apply: vi.fn(),
  createExecutionKey: vi.fn(),
}));
const PROPOSAL_DIGEST = 'b'.repeat(64);

vi.mock('./analyticsApi', () => ({ getOperationsHeatmapV2: mocks.getOperationsHeatmapV2 }));
vi.mock('./territorialGeocodingApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./territorialGeocodingApi')>();
  return {
    ...actual,
    getTerritorialGeocodingQueue: mocks.getQueue,
    getTerritorialGeocodingPreviewQueue: mocks.getPreview,
    getTerritorialGeocodingDetail: mocks.getDetail,
    getTerritorialGeocodingAttempts: mocks.getAttempts,
    reviewTerritorialGeocodingJob: mocks.review,
    syncTerritorialGeocodingQueue: mocks.sync,
    resolveTerritorialGeocodingJob: mocks.resolve,
    applyTerritorialGeocodingJob: mocks.apply,
    createTerritorialReviewIdempotencyKey: () => 'geo-review:geo-job-419:ui-test',
    createTerritorialSyncIdempotencyKey: () => 'geo-sync:ui-test-01234567',
    createTerritorialExecutionIdempotencyKey: mocks.createExecutionKey,
  };
});

const renderInbox = (props: ComponentProps<typeof TerritorialPendingLocationsInbox> = { tenantSlug: 'junin' }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TerritorialPendingLocationsInbox {...props} />
    </QueryClientProvider>,
  );
};

const heatmapFixture = (): OperationsHeatmapV1 => ({
  points: [],
  cells: [],
  hotspots: [],
  facets: [],
  category_layers: [],
  geocoding: {
    contract_version: 'operations.heatmap.geocoding_queue.v1',
    status: 'pending',
    candidate_count: 2,
    candidates: [{
      record_id: 419,
      ticket_id: 419,
      source_model: 'MunicipioTicket',
      address: 'Plaza departamental 742, Junín, Mendoza',
      category: 'Luminarias',
      source: 'WhatsApp',
      reason_code: 'address_without_coordinates',
      actions: [{ id: 'open_record', method: 'GET', endpoint: '/api/v2/tickets/419' }],
    }],
  },
});

const adminItem: TerritorialGeocodingItem = {
  id: 'geo-job-419',
  ticketId: '419',
  sourceModelRaw: 'municipio_ticket',
  ticketSourceModel: 'MunicipioTicket',
  status: 'ready',
  reasonCode: 'pending_review',
  reviewState: 'unreviewed',
  latestReview: null,
  category: 'Luminarias',
  zone: 'Zona Centro',
  quality: {
    state: 'requires_human_review',
    hasProposal: true,
    autoApplyEligible: false,
    jurisdictionStatus: 'inside',
    locationType: 'ROOFTOP',
    partialMatch: false,
    localityMatch: true,
    provinceMatch: true,
    countryMatch: true,
    issues: [],
  },
  attemptCount: 0,
  lastAttemptAt: null,
  createdAt: '2026-08-30T11:00:00Z',
  updatedAt: '2026-08-30T11:00:00Z',
  detailHref: '/api/v2/analytics/operations/geocoding-queue/geo-job-419',
  attemptsHref: '/api/v2/analytics/operations/geocoding-queue/geo-job-419/attempts',
  reviewAction: {
    href: '/api/v2/analytics/operations/geocoding-queue/geo-job-419/review',
    canApprove: true,
    canReject: true,
    approvedReasonCodes: ['verified_on_map'],
    rejectedReasonCodes: ['incorrect_location'],
    coordinateApplicationSupported: false,
  },
  resolveAction: {
    href: '/api/v2/analytics/operations/geocoding-queue/geo-job-419/resolve',
    enabled: true,
    reasonCode: 'provider_lookup_available',
    confirmationRequired: false,
  },
  applyAction: {
    href: '/api/v2/analytics/operations/geocoding-queue/geo-job-419/apply',
    enabled: false,
    reasonCode: 'proposal_or_current_approval_missing',
    confirmationRequired: true,
  },
};

const adminQueue = (): TerritorialGeocodingQueue => ({
  contractVersion: 'operations.territorial_geocoding_admin.v1',
  requestId: 'req-ui-1',
  tenantId: '4',
  summary: {
    total: 1,
    withProposal: 1,
    needsHumanReview: 1,
    coordinateWritesFromReview: 0,
    byStatus: { ready: 1 },
    byReviewState: { unreviewed: 1 },
    byReasonCode: { pending_review: 1 },
    byQualityState: { requires_human_review: 1 },
  },
  pagination: { page: 1, perPage: 100, total: 1, hasNext: false },
  items: [adminItem],
  privacy: { rawAddressExposed: false, addressDigestExposed: false, exactCoordinatesExposed: false, aggregateListOnly: true },
});

const adminDetail = (): TerritorialGeocodingDetail => ({
  contractVersion: 'operations.territorial_geocoding_admin.v1',
  tenantId: '4',
  item: adminItem,
  proposal: {
    lat: -33.1334,
    lng: -68.4861,
    locationType: 'ROOFTOP',
    partialMatch: false,
    provider: 'configured_provider',
    providerPlaceId: null,
    coordinateReference: 'WGS84',
    provenance: { source: 'geocoding_provider', provider: 'configured_provider', proposalDigest: null, sourceAddressRetained: false },
    validation: { autoApplyEligible: false, issues: [], jurisdictionStatus: 'inside', localityMatch: true, provinceMatch: true, countryMatch: true },
  },
  proposalDigest: PROPOSAL_DIGEST,
  proposalVersion: { attemptId: 'attempt-resolve-1', attemptNumber: 1 },
  attempts: [],
  reviews: [],
  privacy: { rawAddressExposed: false, addressDigestExposed: false, exactCoordinatesExposed: true, authorizedAdminDetail: true },
  writePolicy: { getIsReadOnly: true, providerCallPerformed: false, coordinateApplicationSupported: true, reviewIsHumanDecisionOnly: true, applyRequiresSeparateConfirmedPost: true },
});

const previewQueue = (): TerritorialGeocodingPreviewQueue => ({
  contractVersion: 'operations.territorial_geocoding_preview.v1',
  tenantId: '4',
  summary: {
    discovered: 34,
    unique: 34,
    matching: 34,
    hidden: 0,
    bySourceModel: { tenant_ticket: 34 },
    byCategory: { luminarias: 23 },
    byZone: { centro: 18 },
  },
  pagination: { page: 1, perPage: 100, total: 34, hasNext: false },
  items: Array.from({ length: 34 }, (_, index) => ({
    id: `tenant_ticket:${419 + index}`,
    ticketId: String(419 + index),
    sourceModelRaw: 'tenant_ticket',
    ticketSourceModel: 'TenantTicket' as const,
    category: index < 23 ? 'Luminarias' : 'Bacheo',
    zone: index < 18 ? 'Centro' : 'Área todavía no publicada',
    state: 'awaiting_materialization' as const,
    reasonCode: 'persisted_address_without_coordinates' as const,
    inspectSourceEnabled: true as const,
  })),
  execution: {
    readOnly: true,
    databaseWritePerformed: false,
    providerCallPerformed: false,
    coordinateWritePerformed: false,
  },
  privacy: {
    rawAddressExposed: false,
    addressDigestExposed: false,
    candidateFingerprintExposed: false,
    exactCoordinatesExposed: false,
    tenantScoped: true,
  },
});

describe('TerritorialPendingLocationsInbox', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    let executionKeySequence = 0;
    mocks.createExecutionKey.mockImplementation((action: string) => {
      executionKeySequence += 1;
      return `geo-${action}:ui-test-${String(executionKeySequence).padStart(8, '0')}`;
    });
    mocks.getPreview.mockRejectedValue(new ApiError('not found', 404));
    mocks.getDetail.mockResolvedValue(adminDetail());
    mocks.getAttempts.mockResolvedValue({ attempts: [] });
  });

  it('uses the administrative queue and requires an explicit confirmed reason before reviewing', async () => {
    mocks.getQueue.mockResolvedValue(adminQueue());
    mocks.review.mockResolvedValue({ coordinateWritePerformed: false });

    renderInbox({ tenantSlug: 'junin', initialFacet: 'luminarias' });

    expect(await screen.findByText('1 informadas')).toBeInTheDocument();
    expect(await screen.findByText('Propuesta geográfica')).toBeInTheDocument();
    expect(screen.queryByText(/742/)).not.toBeInTheDocument();
    expect(mocks.getOperationsHeatmapV2).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar propuesta' }));
    const submit = screen.getByRole('button', { name: 'Registrar decisión' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de la revisión territorial'), { target: { value: 'verified_on_map' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mocks.review).toHaveBeenCalled());
    expect(mocks.review.mock.calls[0][0]).toEqual({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      decision: 'approved',
      reasonCode: 'verified_on_map',
      idempotencyKey: 'geo-review:geo-job-419:ui-test',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    });
    expect(mocks.review.mock.calls[0][0]).not.toHaveProperty('applyCoordinates');
    expect(mocks.review.mock.calls[0][0]).not.toHaveProperty('apply_coordinates');
  });

  it('fails closed on 403 instead of substituting an aggregate heatmap', async () => {
    mocks.getQueue.mockRejectedValue(new ApiError('forbidden', 403));

    renderInbox();

    expect(await screen.findByText('Acceso administrativo requerido')).toBeInTheDocument();
    expect(screen.getByText(/falla cerrada/i)).toBeInTheDocument();
    expect(mocks.getOperationsHeatmapV2).not.toHaveBeenCalled();
  });

  it.each([
    ['502', new ApiError('bad gateway', 502)],
    ['503', new ApiError('service unavailable', 503)],
    ['504', new ApiError('gateway timeout', 504)],
    ['network error', new NetworkError('offline')],
  ])('fails closed on %s and never requests the legacy heatmap', async (_label, error) => {
    mocks.getQueue.mockRejectedValue(error);

    renderInbox();

    expect(await screen.findByText('No pudimos cargar ubicaciones pendientes')).toBeInTheDocument();
    expect(mocks.getOperationsHeatmapV2).not.toHaveBeenCalled();
    expect(screen.queryByText('Modo lectura de respaldo')).not.toBeInTheDocument();
  });

  it('uses the heatmap only as an explicit read-only fallback when the endpoint is unavailable', async () => {
    mocks.getQueue.mockRejectedValue(new ApiError('not found', 404));
    mocks.getOperationsHeatmapV2.mockResolvedValue(heatmapFixture());

    renderInbox({ tenantSlug: 'junin', initialFacet: 'luminarias' });

    expect(await screen.findByText('Modo lectura de respaldo')).toBeInTheDocument();
    expect(screen.getByText('2 informadas')).toBeInTheDocument();
    expect(screen.getAllByText('Corredor Plaza departamental')).not.toHaveLength(0);
    expect(screen.queryByText(/742/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar ubicación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar ubicación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar cola' })).toBeDisabled();
    expect(mocks.getOperationsHeatmapV2).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      scope: 'municipio',
      range: '30d',
      include_ai: 0,
      limit: 100,
    });
  });

  it('discovers current pending tickets in read-only preview before requiring queue materialization', async () => {
    const emptyQueue = adminQueue();
    emptyQueue.summary.total = 0;
    emptyQueue.pagination.total = 0;
    emptyQueue.items = [];
    mocks.getQueue.mockResolvedValue(emptyQueue);
    mocks.getPreview.mockResolvedValue(previewQueue());

    renderInbox({ tenantSlug: 'junin', initialFacet: 'luminarias' });

    expect(await screen.findByText('Pendientes detectadas sin alterar datos')).toBeInTheDocument();
    expect(screen.getByText('34 informadas')).toBeInTheDocument();
    expect(screen.getByText('34 con detalle seguro')).toBeInTheDocument();
    expect(screen.queryByText(/sin detalle publicado/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Reclamo #419')).not.toHaveLength(0);
    expect(screen.getAllByText('Centro')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Actualizar cola' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Abrir reclamo' })).toHaveAttribute(
      'href',
      expect.stringContaining('ticket_id=419'),
    );
    expect(mocks.getOperationsHeatmapV2).not.toHaveBeenCalled();
  });

  it('keeps a 409 review conflict visible and asks the operator to refresh', async () => {
    mocks.getQueue.mockResolvedValue(adminQueue());
    mocks.review.mockRejectedValue(new ApiError('conflict', 409));
    renderInbox();

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar propuesta' }));
    fireEvent.change(screen.getByLabelText('Motivo de la revisión territorial'), { target: { value: 'verified_on_map' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));

    expect(await screen.findByText('Conflicto de revisión')).toBeInTheDocument();
    expect(screen.getByText(/actualizá la cola/i)).toBeInTheDocument();
  });

  it('consults the provider separately and requires confirmation before applying coordinates', async () => {
    const queue = adminQueue();
    queue.items = [{
      ...adminItem,
      reviewState: 'approved',
      applyAction: { ...adminItem.applyAction, enabled: true, reasonCode: 'current_approved_auto_apply_proposal' },
    }];
    mocks.getQueue.mockResolvedValue(queue);
    mocks.resolve.mockResolvedValue({ action: 'resolve' });
    mocks.apply.mockResolvedValue({ action: 'apply' });
    renderInbox();

    fireEvent.click(await screen.findByRole('button', { name: 'Consultar proveedor' }));
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalled());
    expect(mocks.resolve.mock.calls[0][0]).toEqual({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-resolve:ui-test-00000001',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar coordenadas' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirmar aplicación' });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirmButton);
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    expect(mocks.apply.mock.calls[0][0]).toEqual({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-apply:ui-test-00000002',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    });
  });

  it('reuses the resolve idempotency key after an uncertain result until Nueva búsqueda is explicit', async () => {
    mocks.getQueue.mockResolvedValue(adminQueue());
    mocks.resolve.mockRejectedValue(new NetworkError('resultado incierto'));
    renderInbox();

    const consult = await screen.findByRole('button', { name: 'Consultar proveedor' });
    fireEvent.click(consult);
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(consult).toBeEnabled());

    fireEvent.click(consult);
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(2));
    expect(mocks.resolve.mock.calls[0][0].idempotencyKey).toBe(mocks.resolve.mock.calls[1][0].idempotencyKey);

    const newSearch = await screen.findByRole('button', { name: 'Nueva búsqueda' });
    await waitFor(() => expect(newSearch).toBeEnabled());
    fireEvent.click(newSearch);
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(3));
    expect(mocks.resolve.mock.calls[2][0].idempotencyKey).not.toBe(mocks.resolve.mock.calls[1][0].idempotencyKey);
    expect(mocks.createExecutionKey).toHaveBeenCalledTimes(2);
  });

  it('runs sync only after confirmation, exposes loading, and renders an idempotent replay summary', async () => {
    mocks.getQueue.mockResolvedValue(adminQueue());
    let resolveSync!: (value: unknown) => void;
    mocks.sync.mockReturnValue(new Promise((resolve) => { resolveSync = resolve; }));
    renderInbox();

    await screen.findByText('1 informadas');
    const trigger = screen.getByRole('button', { name: 'Actualizar cola' });
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(mocks.sync).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.getByRole('heading', { name: 'Actualizar cola territorial' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar actualización' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar actualización' })).toBeDisabled());
    expect(mocks.sync).toHaveBeenCalled();
    expect(mocks.sync.mock.calls[0][0]).toEqual({ tenantSlug: 'junin', idempotencyKey: 'geo-sync:ui-test-01234567' });

    await act(async () => resolveSync({
      contractVersion: 'operations.territorial_geocoding_sync.v1',
      tenantId: '4',
      summary: { discovered: 4, created: 1, existing: 3, stale: 1, refreshed: 1, hidden: 0 },
      execution: { providerCallPerformed: false, coordinateWritePerformed: false },
      idempotentReplay: true,
    }));

    expect(await screen.findByText('Cola actualizada')).toBeInTheDocument();
    expect(screen.getByText('1 creadas')).toBeInTheDocument();
    expect(screen.getByText('3 existentes')).toBeInTheDocument();
    expect(screen.getByText('Repetición idempotente')).toBeInTheDocument();
    expect(screen.getByText(/sin proveedor · sin escritura/i)).toBeInTheDocument();
  });

  it('keeps a sync conflict in the confirmation dialog', async () => {
    mocks.getQueue.mockResolvedValue(adminQueue());
    mocks.sync.mockRejectedValue(new ApiError('sync in progress', 409));
    renderInbox();

    await screen.findByText('1 informadas');
    const trigger = screen.getByRole('button', { name: 'Actualizar cola' });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar actualización' }));

    expect(await screen.findByText('Actualización en conflicto')).toBeInTheDocument();
    expect(screen.getByText('sync in progress')).toBeInTheDocument();
  });

  it('shows an honest count-only state when the fallback withholds candidate detail', async () => {
    mocks.getQueue.mockRejectedValue(new ApiError('not found', 404));
    mocks.getOperationsHeatmapV2.mockResolvedValue({
      ...heatmapFixture(),
      geocoding: { candidate_count: 34, status: 'pending' },
    });

    renderInbox();

    expect(await screen.findByText('Hay pendientes, pero falta el detalle seguro')).toBeInTheDocument();
    expect(screen.getByText(/informa 34 ubicaciones pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/no se inventan filas ni domicilios/i)).toBeInTheDocument();
  });
});
