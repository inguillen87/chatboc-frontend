import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperadminLeadsPipeline from '@/components/admin/SuperadminLeadsPipeline';

const mocks = vi.hoisted(() => ({ pipeline: vi.fn(), strategy: vi.fn(), health: vi.fn(), empty: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));
vi.mock('@/services/enterpriseService', () => ({ enterpriseService: {
  getLeadsPipeline: mocks.pipeline, getStrategicOverview: mocks.strategy, getTenantHealth: mocks.health,
  getLeadInteractions: mocks.empty, getCatalogQuality: mocks.empty, getStrategicHeatmapCategoriesZones: mocks.empty,
  getRealtimeAiOverview: mocks.empty, getGlobalEncuestasOverview: mocks.empty, getTenantUnreadSummary: mocks.empty,
} }));
vi.mock('@/components/admin/LeadAutoAssignmentButton', () => ({ default: () => null }));
function Probe() { const location = useLocation(); return <output data-testid="pipeline-location">{location.search}</output>; }
function mount(entry = '/superadmin?section=crm') { return render(<MemoryRouter initialEntries={[entry]}><SuperadminLeadsPipeline /><Probe /></MemoryRouter>); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pipeline.mockResolvedValue({ total: 3, conversion_rate: 1 / 3, avg_first_response_seconds: null, items: [] });
  mocks.strategy.mockResolvedValue({ totals: { total_leads: 100, open_leads: 80, sla_breached: 0, win_rate: 20 } });
  mocks.health.mockResolvedValue({ items: [{ tenant_slug: 'organization-a', health_score: 60, win_rate: 20, sla_breached: 0, survey_responses: 0 }] });
});

describe('pipeline workspace regression', () => {
  it('keeps bounded conversion, global metrics and 0–100 health in their source units', async () => {
    mount();
    const selection = screen.getByRole('generic', { name: 'Métricas de la selección comercial' });
    await waitFor(() => expect(within(selection).getByText('33.3%')).toBeInTheDocument());
    expect(within(selection).getByText('3')).toBeInTheDocument();
    expect(within(selection).getByText('No disponible')).toBeInTheDocument();
    expect(screen.getByText('60 / 100')).toBeInTheDocument();
    expect(screen.queryByText('6000%')).not.toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('20.0%')).toHaveLength(2);
    expect(screen.getByText(/El filtro de organización del listado no se aplica/)).toBeInTheDocument();
  });
  it('preserves the platform section when pipeline filters are changed and cleared', async () => {
    mount('/superadmin?section=crm&tenant_slug=organization-a&sla_only=1&q=before');
    await waitFor(() => expect(screen.getByText('60 / 100')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrar CRM por organización' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar oportunidades' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solo SLA vencido' }));
    const query = screen.getByTestId('pipeline-location').textContent || '';
    expect(query).toContain('section=crm');
    expect(query).not.toContain('tenant_slug'); expect(query).not.toContain('sla_only'); expect(query).not.toContain('q=');
  });
  it.each([{}, { total: 0, conversion_rate: 0 }])('does not manufacture a measured rate for unavailable or empty selections: %j', async (response) => {
    mocks.pipeline.mockResolvedValue(response); mocks.strategy.mockResolvedValue(null); mocks.health.mockResolvedValue({ items: [] });
    mount();
    await waitFor(() => expect(screen.queryAllByText('Cargando…')).toHaveLength(0));
    const selection = screen.getByRole('generic', { name: 'Métricas de la selección comercial' });
    expect(within(selection).queryByText('0.0%')).not.toBeInTheDocument();
    expect(within(selection).getAllByText('No disponible').length).toBeGreaterThanOrEqual(2);
  });
});
