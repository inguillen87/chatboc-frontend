import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ timeline: vi.fn(), addNote: vi.fn(), changeStage: vi.fn() }));
vi.mock('./commercialFollowUpApi', () => ({ commercialFollowUpApi: mocks }));
import { CommercialLeadEditor } from './CommercialLeadEditor';
import { commercialKey, type CommercialLead, type CommercialEvent } from './commercialFollowUp';
const lead = (tenantSlug = 'org-a', name = 'Ana'): CommercialLead => {
  const identity = { tenantSlug, ticketType: 'municipio' as const, ticketId: '12' };
  return { ...identity, key: commercialKey(identity), name, number: '9001', email: '', phone: '', category: '', stage: 'nuevo', lastSeen: null };
};
const event = (note: string): CommercialEvent => ({ at: '2026-09-23T14:00:00Z', actor: '9', event: 'tenant_note', from: '', to: '', note });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const props = () => ({ onLockChange: vi.fn(), onSaved: vi.fn(), onRevoked: vi.fn(), onBack: vi.fn() });
const ready = () => screen.findByText('No hay eventos registrados en el historial disponible.');
const reviewStage = async () => {
  await ready(); fireEvent.change(screen.getByLabelText('Nueva etapa'), { target: { value: 'ganado' } });
  fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'Propuesta aceptada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar cambio de etapa' }));
  return screen.findByRole('alertdialog', { name: 'Confirmar cambio de etapa' });
};
beforeEach(() => { mocks.timeline.mockReset().mockResolvedValue([]); mocks.addNote.mockReset(); mocks.changeStage.mockReset(); });
afterEach(cleanup);
describe('commercial lead editor', () => {
  it('canceling a reviewed stage change never writes', async () => {
    render(<CommercialLeadEditor lead={lead()} {...props()} />); const dialog = await reviewStage();
    expect(dialog).toHaveTextContent('ID 12'); expect(dialog).toHaveTextContent('quedará cerrado');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar cambio' }));
    expect(mocks.changeStage).not.toHaveBeenCalled(); expect(screen.getByLabelText('Motivo del cambio')).toHaveValue('Propuesta aceptada');
  });
  it('confirms the correct target once under a double click and retains unrelated notes', async () => {
    const pending = deferred<void>(); mocks.changeStage.mockReturnValue(pending.promise); const handlers = props();
    render(<CommercialLeadEditor lead={lead()} {...handlers} />); await ready();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Borrador de nota' } });
    const dialog = await reviewStage(); const button = within(dialog).getByRole('button', { name: 'Confirmar cambio' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.changeStage).toHaveBeenCalledExactlyOnceWith(lead(), 'ganado', 'Propuesta aceptada');
    expect(handlers.onSaved).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(await screen.findByText('Etapa Ganado guardada y confirmada por el servidor.')).toBeVisible();
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('Borrador de nota'); expect(handlers.onSaved).toHaveBeenCalledWith('ganado');
  });
  it('saves a note once and clears it only after the confirmed receipt', async () => {
    const pending = deferred<CommercialEvent[]>(); mocks.addNote.mockReturnValue(pending.promise);
    render(<CommercialLeadEditor lead={lead()} {...props()} />); await ready();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Llamada realizada' } });
    const button = screen.getByRole('button', { name: 'Guardar nota' }); fireEvent.click(button); fireEvent.click(button);
    expect(mocks.addNote).toHaveBeenCalledExactlyOnceWith(lead(), 'Llamada realizada');
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('Llamada realizada');
    await act(async () => pending.resolve([event('Llamada realizada')]));
    expect(await screen.findByText('Nota guardada y confirmada por el servidor.')).toBeVisible();
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue(''); expect(screen.getByText('Llamada realizada')).toBeVisible();
  });
  it('preserves a draft and freezes writes after an uncertain result until explicit read', async () => {
    mocks.addNote.mockRejectedValue(new TypeError('Network failure'));
    render(<CommercialLeadEditor lead={lead()} {...props()} />); await ready();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'No reenviar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' })); await screen.findByText(/No se confirmó el guardado/);
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('No reenviar');
    expect(screen.getByRole('button', { name: 'Guardar nota' })).toBeDisabled(); expect(mocks.addNote).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar historial' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar nota' })).toBeEnabled());
    expect(mocks.addNote).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404])('removes private drafts and revokes on %s', async (status) => {
    mocks.addNote.mockRejectedValue({ status }); const handlers = props();
    render(<CommercialLeadEditor lead={lead()} {...handlers} />); await ready();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Privado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));
    await waitFor(() => expect(handlers.onRevoked).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue(''); expect(mocks.addNote).toHaveBeenCalledOnce();
  });
  it('ignores a late history from another tenant with the same internal ID', async () => {
    const old = deferred<CommercialEvent[]>(); mocks.timeline.mockReturnValueOnce(old.promise).mockResolvedValueOnce([event('Historial B')]);
    const view = render(<CommercialLeadEditor lead={lead()} {...props()} />);
    view.rerender(<CommercialLeadEditor lead={lead('org-b', 'Bea')} {...props()} />);
    expect(await screen.findByText('Historial B')).toBeVisible(); await act(async () => old.resolve([event('Historial A privado')]));
    expect(screen.queryByText('Historial A privado')).not.toBeInTheDocument(); expect(screen.getByText('Historial B')).toBeVisible();
  });
  it('does not clear or confirm the new editor when an old write resolves', async () => {
    const old = deferred<CommercialEvent[]>(); mocks.addNote.mockReturnValue(old.promise); const handlers = props();
    const view = render(<CommercialLeadEditor lead={lead()} {...handlers} />); await ready();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Nota A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));
    view.rerender(<CommercialLeadEditor lead={lead('org-b', 'Bea')} {...handlers} />); await ready();
    fireEvent.change(screen.getByLabelText('Nota de seguimiento'), { target: { value: 'Borrador B' } });
    await act(async () => old.resolve([event('Nota A')]));
    expect(screen.getByLabelText('Nota de seguimiento')).toHaveValue('Borrador B'); expect(handlers.onSaved).not.toHaveBeenCalled();
  });
  it('separates a confirmed stage update from failure of the subsequent history read', async () => {
    mocks.changeStage.mockResolvedValue(undefined); const handlers = props();
    render(<CommercialLeadEditor lead={lead()} {...handlers} />); const dialog = await reviewStage(); mocks.timeline.mockRejectedValueOnce(new Error('Unavailable'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cambio' }));
    await screen.findByText(/No pudimos verificar el historial/);
    expect(screen.getByText('Etapa Ganado guardada y confirmada por el servidor.')).toBeVisible();
    expect(screen.queryByText(/No se confirmó el guardado/)).not.toBeInTheDocument(); expect(handlers.onSaved).toHaveBeenCalledWith('ganado');
  });
});
