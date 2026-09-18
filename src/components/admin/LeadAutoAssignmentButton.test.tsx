import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ assign: vi.fn(), success: vi.fn(), error: vi.fn(), confirmed: vi.fn() }));
vi.mock('@/services/enterpriseService', () => ({ enterpriseService: { autoAssignTenantTicket: mocks.assign } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { ApiError } from '@/utils/api';
import LeadAutoAssignmentButton from './LeadAutoAssignmentButton';

const lead = { ticket_type: 'municipio', source_model: 'MunicipioTicket', ticket_id: 403, nro_ticket: 378430 };
const row = { source_model: 'MunicipioTicket', id: 403, ticket_id: 403, assignee_id: 22 };
const snapshot = (rows: unknown[] = [row]) => ({ tenantSlug: 'junin', raw: {
  contract_version: 'employee.routing.v1', tenant: { slug: 'junin' }, queues: { open: rows },
} });
const success = { ok: true, assigned: true, ticket_id: 403, ticket_type: 'municipio', employee: { id: 10, name: 'Ana' } };
const props = () => ({ lead, tenantSlug: 'junin', routingSnapshot: snapshot(), requiredPermission: 'tickets.assign', onConfirmed: mocks.confirmed });

describe('LeadAutoAssignmentButton', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.assign.mockResolvedValue(success);
  });
  afterEach(cleanup);

  it('usa ID de fila y el responsable publicado, sin sustituir por nro_ticket o por otra tabla', async () => {
    render(<LeadAutoAssignmentButton {...props()} routingSnapshot={snapshot([{ ...row, source_model: 'TenantTicket', assignee_id: 77 }, row])} />);
    fireEvent.click(screen.getByRole('button', { name: /^Autoasignar empleado/ }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Caso asignado a Ana'));
    expect(mocks.assign).toHaveBeenCalledWith('junin', 'municipio', 403, { expected_assignee_id: 22, required_permission: 'tickets.assign' });
    expect(mocks.confirmed).toHaveBeenCalledTimes(1);
  });

  it('envía null únicamente cuando está publicado explícitamente', async () => {
    render(<LeadAutoAssignmentButton {...props()} routingSnapshot={snapshot([{ ...row, assignee_id: null }])} />);
    fireEvent.click(screen.getByRole('button', { name: /^Autoasignar empleado/ }));
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('junin', 'municipio', 403, expect.objectContaining({ expected_assignee_id: null })));
  });

  it.each([
    { source_model: 'MunicipioTicket', id: 403, ticket_id: 403 },
    { ...row, assignee_id: undefined },
    { ...row, id: 404 },
    { ...row, assignee_id: false },
  ])('bloquea responsable ausente o identidad inválida: %j', (invalidRow) => {
    render(<LeadAutoAssignmentButton {...props()} routingSnapshot={snapshot([invalidRow])} />);
    expect(screen.getByRole('button', { name: /^Autoasignar empleado/ })).toBeDisabled();
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('bloquea un lead sin ticket_id aunque tenga un número visible', () => {
    render(<LeadAutoAssignmentButton {...props()} lead={{ ...lead, ticket_id: undefined }} />);
    expect(screen.getByRole('button', { name: /^Autoasignar empleado/ })).toBeDisabled();
  });

  it('bloquea TenantTicket porque esta ruta administrativa no lo admite', () => {
    render(<LeadAutoAssignmentButton {...props()} lead={{ ...lead, ticket_type: 'tenant', source_model: 'TenantTicket' }} />);
    expect(screen.getByRole('button', { name: /^Autoasignar empleado/ })).toBeDisabled();
    expect(screen.getByText(/no está disponible para este tipo/)).toBeInTheDocument();
  });

  it.each([{ ...lead, source_model: undefined }, { ...lead, source_id: 404 }])('bloquea la identidad incompleta o contradictoria %j', (invalidLead) => {
    render(<LeadAutoAssignmentButton {...props()} lead={invalidLead} />);
    expect(screen.getByRole('button', { name: /^Autoasignar empleado/ })).toBeDisabled();
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('usa el tipo pyme exacto y su responsable publicado', async () => {
    mocks.assign.mockResolvedValue({ ...success, ticket_type: 'pyme' });
    render(<LeadAutoAssignmentButton {...props()}
      lead={{ ...lead, ticket_type: 'pyme', source_model: 'PymeTicket' }}
      routingSnapshot={snapshot([{ ...row, source_model: 'PymeTicket' }])}
    />);
    fireEvent.click(screen.getByRole('button', { name: /^Autoasignar empleado/ }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
    expect(mocks.assign).toHaveBeenCalledWith('junin', 'pyme', 403, { expected_assignee_id: 22, required_permission: 'tickets.assign' });
  });

  it.each([403, 409])('no confirma ni reintenta tras %s y requiere recargar', async (status) => {
    mocks.assign.mockRejectedValue(new ApiError('No autorizado', status));
    render(<LeadAutoAssignmentButton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Autoasignar empleado/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    expect(mocks.assign).toHaveBeenCalledTimes(1);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.confirmed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Autoasignar empleado/ })).toBeDisabled();
  });

  it.each([{ ok: false, assigned: false, reason: 'no_match' }, { ...success, ticket_id: 404 }])('no inventa éxito para respuesta %j', async (result) => {
    mocks.assign.mockResolvedValue(result);
    render(<LeadAutoAssignmentButton {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Autoasignar empleado/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.confirmed).not.toHaveBeenCalled();
  });

  it('no confirma una respuesta vieja después de cambiar de tenant', async () => {
    let resolve!: (value: unknown) => void;
    mocks.assign.mockReturnValue(new Promise((done) => { resolve = done; }));
    const initial = props();
    const { rerender } = render(<LeadAutoAssignmentButton {...initial} />);
    fireEvent.click(screen.getByRole('button', { name: /^Autoasignar empleado/ }));
    rerender(<LeadAutoAssignmentButton {...initial} tenantSlug="otro" />);
    resolve(success);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Autoasignar empleado/ })).toBeDisabled());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.confirmed).not.toHaveBeenCalled();
  });
});
