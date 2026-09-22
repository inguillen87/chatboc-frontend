import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { surveyCardFixture } from '../../../../tests/fixtures/survey-card-actions';

const mocks = vi.hoisted(() => ({ useSurveyAdmin: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));
import AdminSurveysIndex from './index';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const makeState = (mode: 'draft' | 'live' = 'draft', tenantSlug = 'qa-a') => ({
  surveys: { data: [surveyCardFixture(mode)] },
  tenantSlug,
  isLoadingList: false,
  isLoadingMoreSurveys: false,
  hasMoreSurveys: false,
  listError: null as string | null,
  listRefreshError: null as string | null,
  loadMoreError: null,
  surveyListProgress: { loaded: 1, total: 1 },
  publishSurvey: vi.fn().mockResolvedValue(undefined),
  closeSurvey: vi.fn().mockResolvedValue(undefined),
  deleteSurvey: vi.fn().mockResolvedValue(undefined),
  seedSurvey: vi.fn().mockResolvedValue({ creadas: 100 }),
  refetchList: vi.fn().mockResolvedValue({ data: [] }),
  loadMoreSurveys: vi.fn(),
  // Deliberately false: local progress must not wait for a mutation observer.
  isPublishing: false,
  isClosing: false,
  isDeleting: false,
  isSeeding: false,
});
let state: ReturnType<typeof makeState>;
const page = () => <MemoryRouter><AdminSurveysIndex /></MemoryRouter>;
const openDelete = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Borrar borrador' }));
  return screen.getByRole('alertdialog');
};
const openClose = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
  return screen.getByRole('alertdialog');
};

beforeEach(() => {
  state = makeState();
  mocks.useSurveyAdmin.mockImplementation(() => state);
  mocks.toast.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('survey workspace with the real card and page handlers', () => {
  it('keeps a failed deletion rejected and its unchanged confirmation open', async () => {
    state.deleteSurvey.mockRejectedValue(new Error('rechazo de borrado'));
    render(page());
    fireEvent.click(within(openDelete()).getByRole('button', { name: 'Eliminar', exact: true }));
    await waitFor(() => expect(state.refetchList).toHaveBeenCalledWith({ throwOnError: true }));
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar', exact: true })).not.toBeDisabled());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'No pudimos borrar la encuesta' }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Encuesta eliminada' }));
    expect(state.deleteSurvey).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed close rejected and reconciles its capabilities', async () => {
    state = makeState('live');
    state.closeSurvey.mockRejectedValue(new Error('conflicto de cierre'));
    render(page());
    fireEvent.click(within(openClose()).getByRole('button', { name: 'Cerrar definitivamente' }));
    await waitFor(() => expect(state.refetchList).toHaveBeenCalledWith({ throwOnError: true }));
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrar definitivamente' })).not.toBeDisabled());
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Encuesta cerrada' }));
  });

  it.each(['draft', 'live'] as const)('does not report a confirmed %s write as failed when read-back fails', async (mode) => {
    state = makeState(mode);
    state.refetchList.mockRejectedValueOnce(new Error('lectura temporalmente caída'));
    render(page());
    const dialog = mode === 'draft' ? openDelete() : openClose();
    fireEvent.click(within(dialog).getByRole('button', { name: mode === 'draft' ? 'Eliminar' : 'Cerrar definitivamente', exact: true }));
    await screen.findByText('Listado pendiente de actualización');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: mode === 'draft' ? 'Encuesta eliminada' : 'Encuesta cerrada' }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(screen.getByRole('button', { name: mode === 'draft' ? 'Borrar borrador' : 'Cerrar participación' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar listado' }));
    await waitFor(() => expect(screen.queryByText('Listado pendiente de actualización')).toBeNull());
    expect(state.deleteSurvey.mock.calls.length + state.closeSurvey.mock.calls.length).toBe(1);
    expect(state.refetchList).toHaveBeenCalledTimes(2);
  });

  it('treats missing read-back as unverified, not a successful refresh', async () => {
    state.refetchList.mockResolvedValue(undefined);
    render(page());
    fireEvent.click(within(openDelete()).getByRole('button', { name: 'Eliminar', exact: true }));
    await screen.findByText('Listado pendiente de actualización');
    expect(state.deleteSurvey).toHaveBeenCalledTimes(1);
  });

  it('shows local deletion progress, blocks the other card and submits only once', async () => {
    const pending = deferred<void>();
    state.deleteSurvey.mockReturnValue(pending.promise);
    state.surveys.data.push({ ...surveyCardFixture('live'), id: 302, titulo: 'Otra consulta' });
    render(page());
    const confirm = within(openDelete()).getByRole('button', { name: 'Eliminar', exact: true });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(state.deleteSurvey).toHaveBeenCalledTimes(1));
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Borrando…' })).toBeDisabled();
    // The modal makes the page inaccessible while open; inspect hidden controls.
    expect(screen.getByRole('button', { name: 'Cerrar participación', hidden: true })).toBeDisabled();
    await act(async () => pending.resolve(undefined));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(state.closeSurvey).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('ignores a late %s after switching tenants A -> B -> A', async (outcome) => {
    state = makeState('live');
    const original = state;
    const oldRequest = deferred<void>();
    original.closeSurvey.mockReturnValue(oldRequest.promise);
    const view = render(page());
    fireEvent.click(within(openClose()).getByRole('button', { name: 'Cerrar definitivamente' }));
    await waitFor(() => expect(original.closeSurvey).toHaveBeenCalledTimes(1));
    state = makeState('live', 'qa-b'); view.rerender(page());
    state = makeState('live', 'qa-a'); view.rerender(page());
    const current = state;
    const newRequest = deferred<void>();
    current.closeSurvey.mockReturnValue(newRequest.promise);
    fireEvent.click(within(openClose()).getByRole('button', { name: 'Cerrar definitivamente' }));
    await waitFor(() => expect(current.closeSurvey).toHaveBeenCalledTimes(1));
    await act(async () => {
      if (outcome === 'resolve') oldRequest.resolve(undefined);
      else oldRequest.reject(new Error('respuesta antigua'));
    });
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(original.refetchList).not.toHaveBeenCalled();
    expect(current.refetchList).not.toHaveBeenCalled();
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrando…' })).toBeDisabled();
    await act(async () => newRequest.resolve(undefined));
    await waitFor(() => expect(current.refetchList).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('does not toast or explicitly refetch after leaving the workspace', async () => {
    const request = deferred<void>();
    state.deleteSurvey.mockReturnValue(request.promise);
    const view = render(page());
    fireEvent.click(within(openDelete()).getByRole('button', { name: 'Eliminar', exact: true }));
    await waitFor(() => expect(state.deleteSurvey).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => request.resolve(undefined));
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(state.refetchList).not.toHaveBeenCalled();
  });

  it('labels a cached refresh failure and does not offer a writable stale card', () => {
    state.listRefreshError = 'fallo de lectura';
    render(page());
    expect(screen.getByText('Listado pendiente de actualización')).toBeInTheDocument();
    expect(screen.getByText(state.surveys.data[0].titulo)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar borrador' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nueva encuesta' })).toBeDisabled();
    expect(state.deleteSurvey).not.toHaveBeenCalled();
  });

  it('does not carry search filters to the next tenant', () => {
    const view = render(page());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar instrumentos' }), { target: { value: 'sin coincidencias' } });
    state = makeState('draft', 'qa-b'); view.rerender(page());
    expect(screen.getByRole('searchbox', { name: 'Buscar instrumentos' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Borrar borrador' })).not.toBeDisabled();
  });
});
