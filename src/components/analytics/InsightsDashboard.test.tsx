import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InsightsDashboard from './InsightsDashboard';
import { analyticsService } from '@/services/analyticsService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'junin' }) }));
vi.mock('@/services/analyticsService', () => ({ analyticsService: { getInsights: vi.fn() } }));

describe('backend recommendations', () => {
  beforeEach(() => { vi.mocked(analyticsService.getInsights).mockReset().mockResolvedValue([]); });
  afterEach(cleanup);
  const open = (props: Partial<React.ComponentProps<typeof InsightsDashboard>> = {}) =>
    render(<InsightsDashboard tenantProfileId={22} tenantSlug="junin" scope="municipio" {...props} />);

  it('renders only recommendations supplied by the backend and refreshes through the provided read', async () => {
    const refresh = vi.fn();
    open({ recommendations: ['Revisar la cola del servicio'], onRefreshRecommendations: refresh });
    expect(await screen.findByText('Revisar la cola del servicio')).toBeInTheDocument();
    expect(screen.queryByText('Optimizar Horarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Actualizar FAQ: Envíos')).not.toBeInTheDocument();
    expect(screen.queryByText(/15%|Lunes|Costo de envío/)).not.toBeInTheDocument();
    expect(analyticsService.getInsights).toHaveBeenCalledWith({ tenant_profile_id: 22, tenantSlug: 'junin', scope: 'municipio' }, 'junin');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar recomendaciones' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, [], ['', '   '], [null, 15, {}] as unknown as string[]])('provides an actionable empty state without inventing evidence: %j', async (recommendations) => {
    open({ recommendations, onRefreshRecommendations: vi.fn() });
    expect(await screen.findByText(/No hay recomendaciones disponibles para este alcance/)).toBeInTheDocument();
    expect(screen.queryByText(/No se detectaron patrones|Patrones detectados por IA|15%|Lunes|Costo de envío/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar recomendaciones' })).toBeEnabled();
  });

  it('hides previous recommendations while the current read is loading', async () => {
    open({ recommendations: ['Lectura anterior'], recommendationsLoading: true, onRefreshRecommendations: vi.fn() });
    expect(await screen.findByRole('status')).toHaveTextContent('Consultando recomendaciones');
    expect(screen.queryByText('Lectura anterior')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar recomendaciones' })).toBeDisabled();
  });

  it('keeps real recommendations and their refresh available while the separate insights read is pending', () => {
    vi.mocked(analyticsService.getInsights).mockReturnValueOnce(new Promise(() => {}));
    const refresh = vi.fn();
    open({ recommendations: ['Revisar la cola del servicio'], onRefreshRecommendations: refresh });
    expect(screen.getByText('Analizando datos...')).toBeInTheDocument();
    expect(screen.getByText('Revisar la cola del servicio')).toBeInTheDocument();
    expect(screen.getByText('Recomendaciones en tiempo real')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar recomendaciones' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not convert an insights read failure into an assertion of no unusual patterns', async () => {
    vi.mocked(analyticsService.getInsights).mockRejectedValueOnce(new Error('service unavailable'));
    open();
    expect(await screen.findByText(/No hay hallazgos disponibles/)).toBeInTheDocument();
    expect(screen.queryByText('No se detectaron patrones inusuales.')).not.toBeInTheDocument();
    expect(screen.queryByText(/15%|Lunes|Costo de envío/)).not.toBeInTheDocument();
  });

  it('retires an insight payload when its session changes before resolution', async () => {
    let finish!: (value: unknown[]) => void;
    vi.mocked(analyticsService.getInsights).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = open();
    advanceChatbocSessionRevision();
    await act(async () => { finish([{ text: 'Hallazgo de una sesión retirada' }]); });
    expect(screen.queryByText('Hallazgo de una sesión retirada')).not.toBeInTheDocument();
    view.unmount();
  });
});
