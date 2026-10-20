import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from './AnalyticsPage';
import { analyticsService } from '@/services/analyticsService';
import { enterpriseService, type LeadInteractionsResponse } from '@/services/enterpriseService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { ApiError } from '@/utils/api';

const useUserMock = vi.hoisted(() => vi.fn());
const useTenantMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/backendBootstrapGate', async (original) => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({
  loading: false, hasVerifiedSession: true, organizationProfileVerified: true, ...useUserMock(),
}) }));
vi.mock('@/services/enterpriseService', () => ({ enterpriseService: {
  getLeadInteractions: vi.fn(), getExecutiveSummary: vi.fn(), trackEvent: vi.fn(),
} }));
vi.mock('@/services/analyticsService', () => ({ analyticsService: {
  getHub: vi.fn(), getSummary: vi.fn(), getRealtimeHub: vi.fn(),
  exportCsvUrl: vi.fn(), exportPdfUrl: vi.fn(),
} }));
// This fixture exercises the page's actual requests and state transitions, not Radix mechanics.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: React.PropsWithChildren<{ value?: string; onValueChange: (value: string) => void }>) => <select value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => <option value={value}>{children}</option>,
}));
vi.mock('@/components/analytics/OverviewDashboard', () => ({ default: () => <div>overview</div> }));
vi.mock('@/components/analytics/IdentityCoverageBanner', () => ({ default: () => null }));
vi.mock('@/components/analytics/HeatmapDashboard', () => ({ default: () => null }));
vi.mock('@/components/analytics/InsightsDashboard', () => ({ default: () => null }));
vi.mock('@/components/analytics/MunicipioDashboard', () => ({ default: () => null }));
vi.mock('@/components/analytics/PymeDashboard', () => ({ default: () => null }));
vi.mock('@/components/analytics/RealtimeHubDashboard', () => ({ default: () => null }));
vi.mock('@/components/analytics/EnterpriseAIPanel', () => ({ default: () => null }));
vi.mock('@/features/analytics/OperationsDashboardPanel', () => ({ OperationsDashboardPanel: () => null }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((finish, fail) => { resolve = finish; reject = fail; });
  return { promise, resolve, reject };
};
type ExecutiveSummary = Awaited<ReturnType<typeof enterpriseService.getExecutiveSummary>>;
const leads = (name: string, cursor: string | null = null): LeadInteractionsResponse => ({ items: [{ id: name, lead_name: name }], next_cursor: cursor });
const open = async (platform = true) => {
  useUserMock.mockReturnValue({ user: platform
    ? { id: 5, rol: 'super_admin' }
    : { id: 4, rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'junin', organization_profile: { tenant: { id: 22, slug: 'junin' } } },
  });
  const view = render(<MemoryRouter initialEntries={['/analytics?tenant_slug=junin&range=7d']}><AnalyticsPage /></MemoryRouter>);
  await screen.findByText('overview');
  return view;
};
const changePeriod = async (period: string) => {
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: period } });
  await waitFor(() => expect(analyticsService.getSummary).toHaveBeenCalled());
};
const category = () => screen.getByRole('textbox', { name: 'Categoría' });
const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Resumen ejecutivo IA' }));

describe('AnalyticsPage request context ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useTenantMock.mockReturnValue({ tenant: { id: 22, slug: 'junin', tipo: 'municipio' } });
    vi.mocked(analyticsService.getHub).mockReset().mockResolvedValue({ sections: {}, navigation: { primary: [] } });
    vi.mocked(analyticsService.getSummary).mockReset().mockResolvedValue({ kpis: { total_interactions: 0, active_users: 0, avg_response_time_s: 0 }, top_categories: [], volume_by_day: [], heatmap_points: [], insights: [] });
    vi.mocked(analyticsService.getRealtimeHub).mockReset().mockResolvedValue({ ui: { labels: {} }, totals: {} });
    vi.mocked(enterpriseService.getLeadInteractions).mockReset().mockResolvedValue({ items: [] });
    vi.mocked(enterpriseService.getExecutiveSummary).mockReset().mockResolvedValue({ summary: '' });
    vi.mocked(enterpriseService.trackEvent).mockReset().mockResolvedValue({ ok: true });
  });
  afterEach(cleanup);

  it.each(['resolve', 'reject'] as const)('keeps the current lead period after an old %s', async outcome => {
    const old = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockReturnValueOnce(old.promise).mockResolvedValueOnce(leads('Current period', 'current-cursor'));
    await open();
    await changePeriod('30d');
    await screen.findByText('Current period');
    await act(async () => outcome === 'resolve' ? old.resolve(leads('Obsolete period', 'obsolete-cursor')) : old.reject(new ApiError('old unavailable', 503)));
    expect(screen.getByText('Current period')).toBeInTheDocument();
    expect(screen.queryByText('Obsolete period')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(enterpriseService.getLeadInteractions).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'current-cursor' }), 'junin'));
  });

  it('does not restore the first period after A to B to A', async () => {
    const oldA = deferred<LeadInteractionsResponse>(), currentA = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockReturnValueOnce(oldA.promise).mockResolvedValueOnce(leads('Period B')).mockReturnValueOnce(currentA.promise);
    await open();
    await changePeriod('30d');
    await screen.findByText('Period B');
    await changePeriod('7d');
    await act(async () => oldA.resolve(leads('Obsolete period A')));
    expect(screen.queryByText('Obsolete period A')).not.toBeInTheDocument();
    expect(screen.queryByText('Period B')).not.toBeInTheDocument();
    await act(async () => currentA.resolve(leads('Current period A')));
    expect(screen.getByText('Current period A')).toBeInTheDocument();
  });

  it('retires old pagination after a deliberate refresh and keeps the new cursor', async () => {
    const append = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockResolvedValueOnce(leads('Initial page', 'old-cursor')).mockReturnValueOnce(append.promise).mockResolvedValueOnce(leads('Refreshed page', 'new-cursor'));
    await open();
    await screen.findByText('Initial page');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refrescar' }));
    await screen.findByText('Refreshed page');
    await act(async () => append.resolve(leads('Retired appended row', 'retired-cursor')));
    expect(screen.queryByText('Retired appended row')).not.toBeInTheDocument();
    expect(screen.queryByText('Initial page')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(enterpriseService.getLeadInteractions).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'new-cursor' }), 'junin'));
  });

  it('does not let retired pagination failure unlock current pagination', async () => {
    const oldAppend = deferred<LeadInteractionsResponse>(), newAppend = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockResolvedValueOnce(leads('Initial page', 'old-cursor')).mockReturnValueOnce(oldAppend.promise).mockResolvedValueOnce(leads('Refreshed page', 'new-cursor')).mockReturnValueOnce(newAppend.promise);
    await open();
    await screen.findByText('Initial page');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refrescar' }));
    await screen.findByText('Refreshed page');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await act(async () => oldAppend.reject(new ApiError('retired append', 503)));
    expect(screen.getByRole('button', { name: 'Cargando...' })).toBeDisabled();
    await act(async () => newAppend.resolve(leads('Current appended row')));
    expect(screen.getByText('Refreshed page')).toBeInTheDocument();
    expect(screen.getByText('Current appended row')).toBeInTheDocument();
  });

  it('allows current pagination once and preserves its initial page', async () => {
    const append = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockResolvedValueOnce(leads('Initial page', 'next')).mockReturnValueOnce(append.promise);
    await open();
    await screen.findByText('Initial page');
    const button = screen.getByRole('button', { name: 'Cargar más' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(enterpriseService.getLeadInteractions).toHaveBeenCalledTimes(2);
    await act(async () => append.resolve(leads('Current appended row')));
    expect(screen.getByText('Initial page')).toBeInTheDocument();
    expect(screen.getByText('Current appended row')).toBeInTheDocument();
  });

  it('rejects a lead response after session retirement without another render', async () => {
    const old = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockReturnValueOnce(old.promise);
    await open();
    advanceChatbocSessionRevision();
    await act(async () => old.resolve(leads('Retired session lead')));
    expect(screen.queryByText('Retired session lead')).not.toBeInTheDocument();
  });

  it('starts a new lead read when the canonical organization ID changes under the same slug', async () => {
    const old = deferred<LeadInteractionsResponse>();
    vi.mocked(enterpriseService.getLeadInteractions).mockReturnValueOnce(old.promise).mockResolvedValueOnce(leads('Current organization record'));
    const view = await open();
    useTenantMock.mockReturnValue({ tenant: { id: 23, slug: 'junin', tipo: 'municipio' } });
    view.rerender(<MemoryRouter initialEntries={['/analytics?tenant_slug=junin&range=7d']}><AnalyticsPage /></MemoryRouter>);
    expect(await screen.findByText('Current organization record')).toBeInTheDocument();
    await act(async () => old.resolve(leads('Retired organization record')));
    expect(screen.queryByText('Retired organization record')).not.toBeInTheDocument();
    expect(enterpriseService.getLeadInteractions).toHaveBeenCalledTimes(2);
  });

  it('removes a completed AI summary when its filter context changes without generating automatically', async () => {
    vi.mocked(enterpriseService.getExecutiveSummary).mockResolvedValueOnce({ summary: 'Previous segment summary', model_policy: { primary_provider: 'fixture-provider' } });
    await open(false);
    generate();
    await screen.findByText('Previous segment summary');
    fireEvent.change(category(), { target: { value: 'current-segment' } });
    expect(screen.queryByText('Previous segment summary')).not.toBeInTheDocument();
    expect(screen.queryByText('IA: fixture-provider')).not.toBeInTheDocument();
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(1);
  });

  it('retires a completed AI summary after a period change without generating automatically', async () => {
    vi.mocked(enterpriseService.getExecutiveSummary).mockResolvedValueOnce({ summary: 'Previous period summary' });
    await open(false);
    generate();
    await screen.findByText('Previous period summary');
    await changePeriod('30d');
    expect(screen.queryByText('Previous period summary')).not.toBeInTheDocument();
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(1);
  });

  it('keeps one pending explicit AI request and displays the current result', async () => {
    const current = deferred<ExecutiveSummary>();
    vi.mocked(enterpriseService.getExecutiveSummary).mockReturnValueOnce(current.promise);
    await open(false);
    const button = screen.getByRole('button', { name: 'Resumen ejecutivo IA' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(1);
    await act(async () => current.resolve({ summary: 'Current explicit summary' }));
    expect(screen.getByText('Current explicit summary')).toBeInTheDocument();
  });

  it('retires a pending AI summary on filter change and preserves focus in the filter', async () => {
    const old = deferred<ExecutiveSummary>();
    vi.mocked(enterpriseService.getExecutiveSummary).mockReturnValueOnce(old.promise);
    await open(false);
    generate();
    category().focus();
    fireEvent.change(category(), { target: { value: 'new-segment' } });
    await act(async () => old.resolve({ summary: 'Retired segment summary' }));
    expect(screen.queryByText('Retired segment summary')).not.toBeInTheDocument();
    expect(category()).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Resumen ejecutivo IA' })).toBeEnabled();
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(1);
  });

  it('keeps AI retirement durable after a filter A to B to A and a stale rejection', async () => {
    const old = deferred<ExecutiveSummary>();
    vi.mocked(enterpriseService.getExecutiveSummary).mockReturnValueOnce(old.promise);
    await open(false);
    generate();
    fireEvent.change(category(), { target: { value: 'B' } });
    fireEvent.change(category(), { target: { value: '' } });
    await act(async () => old.reject(new ApiError('old denied', 403)));
    expect(screen.queryByText(/No tenés permisos|No tienes permisos|acceso/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resumen ejecutivo IA' })).toBeEnabled();
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(1);
  });

  it('does not let an old AI finalizer unlock a new explicit generation', async () => {
    const old = deferred<ExecutiveSummary>(), current = deferred<ExecutiveSummary>();
    vi.mocked(enterpriseService.getExecutiveSummary).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await open(false);
    generate();
    fireEvent.change(category(), { target: { value: 'current-segment' } });
    generate();
    await act(async () => old.resolve({ summary: 'Retired summary' }));
    expect(screen.queryByText('Retired summary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generando...' })).toBeDisabled();
    await act(async () => current.resolve({ summary: 'Current explicit summary' }));
    expect(screen.getByText('Current explicit summary')).toBeInTheDocument();
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(2);
    expect(enterpriseService.getExecutiveSummary).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 'current-segment' }), 'junin');
  });

  it('rejects an AI response after session retirement without another render', async () => {
    const old = deferred<ExecutiveSummary>();
    vi.mocked(enterpriseService.getExecutiveSummary).mockReturnValueOnce(old.promise);
    await open(false);
    generate();
    advanceChatbocSessionRevision();
    await act(async () => old.resolve({ summary: 'Retired session summary' }));
    expect(screen.queryByText('Retired session summary')).not.toBeInTheDocument();
  });

  it('keeps current AI no-data feedback and requires an explicit retry after failure', async () => {
    vi.mocked(enterpriseService.getExecutiveSummary).mockRejectedValueOnce(new ApiError('current unavailable', 503)).mockResolvedValueOnce({ summary: '', reason_code: 'no_operational_data_in_period' });
    await open(false);
    generate();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resumen ejecutivo IA' })).toBeEnabled());
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(1);
    generate();
    expect(await screen.findByText('No hay datos operativos para este periodo.')).toBeInTheDocument();
    expect(enterpriseService.getExecutiveSummary).toHaveBeenCalledTimes(2);
  });
});
