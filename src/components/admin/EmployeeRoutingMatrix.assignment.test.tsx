import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/api/v2/saas', () => ({
  getEmployeeRoutingV2: mocks.get,
  postEmployeeRoutingAutoAssignV2: mocks.post,
  patchEmployeeRoutingScopeV2: mocks.patch,
}));

import { ApiError } from '@/utils/api';
import EmployeeRoutingMatrix from './EmployeeRoutingMatrix';

const row = { source_model: 'MunicipioTicket', id: 403, ticket_id: 403, assignee_id: null };
const target = { source_model: 'MunicipioTicket', id: 403, expected_assignee_id: null };
const frozenTarget = { ...target, expected_suggested_assignee_id: 10 };
const preview = (employeeId = 10) => ({
  contract_version: 'employee.routing.auto_assign.v1', tenant: { slug: 'junin' }, dry_run: true,
  applied_count: 0, items: [{ ticket: { ...row }, suggested_assignee: { id: employeeId, name: 'Ana' }, applied: false, assignment: null }],
});
const applied = () => ({
  ...preview(), dry_run: false, applied_count: 1,
  items: [{ ...preview().items[0], applied: true, assignment: { assignee_id: 10 } }],
});
const routing = (slug = 'junin', rows = [row]) => ({
  contract_version: 'employee.routing.v1', employees: [], dimensions: {}, recommendations: [],
  queues: { open: rows, unassigned: rows, unassigned_count: rows.length },
  raw: { contract_version: 'employee.routing.v1', tenant: { slug }, queues: { open: rows, unassigned: rows } },
});
const employeeRouting = (slug: string) => ({
  ...routing(slug),
  employees: [{ id: slug === 'junin' ? '10' : '20', name: `Equipo ${slug}`, workload_open: 0,
    scope: { categorias: ['bacheo'], zonas: [], channels: [], permisos: [], raw: {} }, raw: {} }],
});
const showPreview = async () => {
  render(<EmployeeRoutingMatrix tenantSlug="junin" />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeEnabled());
};

describe('EmployeeRoutingMatrix assignment snapshot', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockImplementation((slug) => Promise.resolve(routing(slug)));
    mocks.post.mockReset().mockResolvedValue(preview());
    mocks.patch.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('previsualiza, revalida y aplica solo identidades y responsables explícitos del snapshot', async () => {
    mocks.post.mockResolvedValueOnce(preview()).mockResolvedValueOnce(preview()).mockResolvedValueOnce(applied());
    await showPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar preview' }));
    await screen.findByText('Asignacion aplicada');
    expect(mocks.post.mock.calls).toEqual([
      [{ dry_run: true, tickets: [target], limit: 1 }, 'junin'],
      [{ dry_run: true, tickets: [frozenTarget], limit: 1 }, 'junin'],
      [{ dry_run: false, tickets: [frozenTarget], limit: 1 }, 'junin'],
    ]);
    expect(screen.getByText('1 casos revisados. 1 asignaciones sugeridas o aplicadas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeDisabled();
  });

  it('no infiere null si no se publicó el responsable observado', async () => {
    const incomplete = { source_model: 'MunicipioTicket', id: 403, ticket_id: 403 };
    mocks.get.mockResolvedValue(routing('junin', [incomplete as typeof row]));
    render(<EmployeeRoutingMatrix tenantSlug="junin" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    await screen.findByText(/No se publicó el responsable actual/);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeDisabled();
  });

  it('invalida el preview al refrescar la lista, sin tomar targets nuevos para aplicar', async () => {
    await showPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it.each(['suggestion', 'removed', 'owner'])('no aplica si cambia %s durante la revalidación', async (change) => {
    const changed = preview(22);
    if (change === 'removed') changed.items = [];
    if (change === 'owner') changed.items[0].ticket.assignee_id = 22 as unknown as null;
    mocks.post.mockResolvedValueOnce(preview()).mockResolvedValueOnce(changed);
    await showPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar preview' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled());
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.post.mock.calls.every(([payload]) => payload.dry_run === true)).toBe(true);
    expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeDisabled();
    expect(screen.queryByText('Asignacion aplicada')).not.toBeInTheDocument();
  });

  it.each([403, 409])('no confirma ni reintenta la aplicación rechazada con %s', async (status) => {
    mocks.post.mockResolvedValueOnce(preview()).mockResolvedValueOnce(preview()).mockRejectedValueOnce(new ApiError('Solicitud rechazada', status));
    await showPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar preview' }));
    await screen.findByText('Solicitud rechazada');
    expect(mocks.post).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('Asignacion aplicada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeDisabled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('no anuncia éxito si el servidor omite targets del resultado aplicado', async () => {
    mocks.post.mockResolvedValueOnce(preview()).mockResolvedValueOnce(preview()).mockResolvedValueOnce({ ...applied(), items: [], applied_count: 0 });
    await showPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar preview' }));
    await screen.findByText(/No se confirmaron todas las asignaciones/);
    expect(screen.queryByText('Asignacion aplicada')).not.toBeInTheDocument();
  });

  it('descarta una respuesta de preview que llega después de cambiar de tenant', async () => {
    let resolve!: (value: unknown) => void;
    mocks.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { rerender } = render(<EmployeeRoutingMatrix tenantSlug="junin" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    rerender(<EmployeeRoutingMatrix tenantSlug="otro" />);
    resolve(preview());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Aplicar preview' })).toBeDisabled();
    expect(screen.queryByText('Previsualizacion lista')).not.toBeInTheDocument();
  });

  it('un PATCH anterior no recarga su tenant ni deja pegada la carga del tenant nuevo', async () => {
    let resolvePatch!: (value: unknown) => void;
    let resolveOther!: (value: unknown) => void;
    mocks.get.mockResolvedValueOnce(employeeRouting('junin'))
      .mockReturnValueOnce(new Promise((done) => { resolveOther = done; }));
    mocks.patch.mockReturnValueOnce(new Promise((done) => { resolvePatch = done; }));
    const { rerender } = render(<EmployeeRoutingMatrix tenantSlug="junin" />);
    fireEvent.click(await screen.findByRole('button', { name: /Equipo junin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cobertura' }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    rerender(<EmployeeRoutingMatrix tenantSlug="otro" />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    await act(async () => { resolvePatch({ ok: true }); });
    await act(async () => { resolveOther(employeeRouting('otro')); });
    await screen.findByRole('button', { name: /Equipo otro/ });
    expect(mocks.get.mock.calls.map(([slug]) => slug)).toEqual(['junin', 'otro']);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previsualizar' })).toBeEnabled();
    expect(screen.queryByPlaceholderText('categorias separadas por coma')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cobertura actualizada/)).not.toBeInTheDocument();
  });

  it('un error del PATCH anterior no pisa el error actual ni reintenta cambios', async () => {
    let rejectOld!: (error: unknown) => void;
    mocks.get.mockImplementation((slug) => Promise.resolve(employeeRouting(slug)));
    mocks.patch.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }))
      .mockRejectedValueOnce(new ApiError('Error vigente de otro', 403));
    const { rerender } = render(<EmployeeRoutingMatrix tenantSlug="junin" />);
    fireEvent.click(await screen.findByRole('button', { name: /Equipo junin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cobertura' }));
    rerender(<EmployeeRoutingMatrix tenantSlug="otro" />);
    fireEvent.click(await screen.findByRole('button', { name: /Equipo otro/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cobertura' }));
    await screen.findByText('Error vigente de otro');
    await act(async () => { rejectOld(new ApiError('Error viejo de junin', 409)); });
    expect(screen.getByText('Error vigente de otro')).toBeInTheDocument();
    expect(screen.queryByText('Error viejo de junin')).not.toBeInTheDocument();
    expect(mocks.patch.mock.calls.map(([id, _payload, slug]) => [id, slug])).toEqual([['10', 'junin'], ['20', 'otro']]);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Guardar cobertura' })).toBeEnabled();
  });
});
