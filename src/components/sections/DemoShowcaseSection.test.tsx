import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DemoShowcaseSection from './DemoShowcaseSection';
import type { DemoCatalogResponse } from '@/features/demo/demoTypes';

const api = vi.hoisted(() => ({ getDemoCatalog: vi.fn(), createDemoSession: vi.fn() }));
vi.mock('@/features/demo/demoApi', () => api);

const experience = { demo_showcase: {
  eyebrow: 'Recorridos', title: 'Explorá la plataforma', description: 'Escenarios de ejemplo, sin operación real.',
  loading_title: 'Consultando catálogo', loading_description: 'Cargando las opciones disponibles.',
  error_message: 'No pudimos consultar las opciones.', empty_message: 'No hay recorridos disponibles.',
  retry_label: 'Reintentar catálogo', start_error_message: 'No pudimos preparar la demostración.',
  starting_label: 'Preparando demostración…', card_label: 'Recorrido de ejemplo', open_label: 'Ver recorrido',
} };
const catalog = () => ({ rubros: [], sector_groups: [{ key: 'gobierno', label: 'Gobierno', description: 'Escenario informativo.', default_rubro: 'municipio', cta_label: 'Abrir escenario' }] }) as unknown as DemoCatalogResponse;
const emptyCatalog = { rubros: [], sector_groups: [] } as unknown as DemoCatalogResponse;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
const mount = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><button>Control externo</button><DemoShowcaseSection experience={experience} /></MemoryRouter>);

describe('landing demonstration availability', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses neutral published loading copy rather than an operational claim', () => {
    api.getDemoCatalog.mockReturnValue(new Promise(() => undefined));
    mount();
    expect(screen.getByRole('region', { name: 'Explorá la plataforma' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Consultando catálogo')).toBeInTheDocument();
    expect(screen.queryByText(/demos reales|recorrido publicado/i)).not.toBeInTheDocument();
  });

  it('keeps an empty valid catalog distinct from an error and offers an explicit retry', async () => {
    api.getDemoCatalog.mockResolvedValue(emptyCatalog);
    mount();
    expect(await screen.findByText('No hay recorridos disponibles.')).toBeInTheDocument();
    expect(screen.queryByText('No pudimos consultar las opciones.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar catálogo' })).toBeInTheDocument();
  });

  it('deduplicates a pending retry and restores only its still-focused owner to the heading', async () => {
    const retry = deferred<DemoCatalogResponse>();
    api.getDemoCatalog.mockRejectedValueOnce(new Error('PRIVATE PROVIDER RAW DETAIL')).mockReturnValueOnce(retry.promise);
    mount();
    const button = await screen.findByRole('button', { name: 'Reintentar catálogo' });
    expect(screen.queryByText('PRIVATE PROVIDER RAW DETAIL')).not.toBeInTheDocument();
    button.focus(); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(api.getDemoCatalog).toHaveBeenCalledTimes(2));
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    await act(async () => retry.resolve(catalog()));
    expect(screen.getByRole('heading', { name: 'Explorá la plataforma' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Reintentar catálogo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir escenario' })).toBeInTheDocument();
    expect(screen.queryByText(/experiencias publicadas/)).not.toBeInTheDocument();
  });

  it.each(['external', 'body'] as const)('does not reclaim focus after voluntary departure to %s', async (destination) => {
    const retry = deferred<DemoCatalogResponse>();
    api.getDemoCatalog.mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(retry.promise);
    mount();
    const button = await screen.findByRole('button', { name: 'Reintentar catálogo' });
    button.focus(); fireEvent.click(button);
    const external = screen.getByRole('button', { name: 'Control externo' });
    if (destination === 'external') external.focus(); else button.blur();
    await act(async () => retry.resolve(catalog()));
    if (destination === 'external') expect(external).toHaveFocus(); else expect(document.body).toHaveFocus();
  });

  it('does not focus the heading on the initial catalog response', async () => {
    const initial = deferred<DemoCatalogResponse>(); api.getDemoCatalog.mockReturnValue(initial.promise);
    mount(); const external = screen.getByRole('button', { name: 'Control externo' }); external.focus();
    await act(async () => initial.resolve(catalog()));
    expect(external).toHaveFocus();
  });

  it('keeps the same retry control while recovering an empty catalog', async () => {
    const retry = deferred<DemoCatalogResponse>();
    api.getDemoCatalog.mockResolvedValueOnce(emptyCatalog).mockReturnValueOnce(retry.promise);
    mount();
    const button = await screen.findByRole('button', { name: 'Reintentar catálogo' });
    button.focus(); fireEvent.click(button);
    await waitFor(() => expect(api.getDemoCatalog).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Reintentar catálogo' })).toBe(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(api.getDemoCatalog).toHaveBeenCalledTimes(2);
    await act(async () => retry.resolve(emptyCatalog));
    expect(screen.getByRole('button', { name: 'Reintentar catálogo' })).toBe(button);
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveFocus();
  });

  it.each(['external', 'body'] as const)('preserves voluntary %s focus during empty-catalog recovery', async (destination) => {
    const retry = deferred<DemoCatalogResponse>();
    api.getDemoCatalog.mockResolvedValueOnce(emptyCatalog).mockReturnValueOnce(retry.promise);
    mount();
    const button = await screen.findByRole('button', { name: 'Reintentar catálogo' });
    button.focus(); fireEvent.click(button);
    const external = screen.getByRole('button', { name: 'Control externo' });
    if (destination === 'external') external.focus(); else button.blur();
    await act(async () => retry.resolve(catalog()));
    if (destination === 'external') expect(external).toHaveFocus(); else expect(document.body).toHaveFocus();
  });

  it('retires an empty-catalog recovery on unmount without reclaiming external focus', async () => {
    const retry = deferred<DemoCatalogResponse>();
    api.getDemoCatalog.mockResolvedValueOnce(emptyCatalog).mockReturnValueOnce(retry.promise);
    const { unmount } = mount();
    const button = await screen.findByRole('button', { name: 'Reintentar catálogo' });
    button.focus(); fireEvent.click(button); unmount();
    const external = document.createElement('button'); document.body.append(external); external.focus();
    try {
      await act(async () => retry.resolve(catalog()));
      expect(external).toHaveFocus();
      expect(api.getDemoCatalog).toHaveBeenCalledTimes(2);
    } finally { external.remove(); }
  });

  it('shows only contract copy after a session preparation error', async () => {
    api.getDemoCatalog.mockResolvedValue(catalog()); api.createDemoSession.mockRejectedValue(new Error('SQL SECRET DETAIL'));
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Abrir escenario' }));
    expect(await screen.findByText('No pudimos preparar la demostración.')).toBeInTheDocument();
    expect(screen.queryByText('SQL SECRET DETAIL')).not.toBeInTheDocument();
  });

  it('does not fabricate demo copy or anonymous actions when the marketing contract is absent', async () => {
    api.getDemoCatalog.mockResolvedValue({ rubros: [], sector_groups: [{ key: 'gobierno', label: 'Gobierno' }] });
    render(<MemoryRouter><DemoShowcaseSection /></MemoryRouter>);
    await screen.findByRole('tab', { name: 'Gobierno' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/conversación real|experiencias publicadas/)).not.toBeInTheDocument();
  });
});
