import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MetaCredentials from './MetaCredentials';
import { META_CREDENTIAL_TARGETS, metaCredentialApi, type MetaCredentialPlan } from '@/features/metaCredentials/metaCredentialApi';
import { planFor, statusFor, tokenFor } from '@/features/metaCredentials/__tests__/fixtures';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const session = vi.hoisted(() => ({ loading: false, hasVerifiedSession: true,
  organizationProfileVerified: true, user: { id: 42, role: 'superadmin', rol: 'superadmin' } }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => session }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/metaCredentials/metaCredentialApi', async () => ({
  ...await vi.importActual('@/features/metaCredentials/metaCredentialApi'),
  metaCredentialApi: { status: vi.fn(), plan: vi.fn(), apply: vi.fn(), inspectConnection: vi.fn() },
}));
const api = vi.mocked(metaCredentialApi);
const app = () => <MemoryRouter initialEntries={['/integracion/meta/credenciales']}><Routes>
  <Route path="/integracion/meta/credenciales" element={<MetaCredentials />} />
  <Route path="/integracion" element={<p>Integraciones de destino</p>} />
</Routes></MemoryRouter>;
const receipt = (plan: MetaCredentialPlan) => ({ target: plan.target, revision: plan.nextRevision,
  expiresAt: plan.expiresAt, planSha256: plan.planSha256 });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, promise };
};
const fields = async () => {
  await screen.findByLabelText('Token de acceso · Destino autorizado A');
  return META_CREDENTIAL_TARGETS.map(target => screen.getByLabelText(`Token de acceso · ${statusFor(target).label}`) as HTMLInputElement);
};
const fill = async () => {
  const inputs = await fields();
  inputs.forEach((input, index) => fireEvent.change(input, { target: { value: tokenFor(META_CREDENTIAL_TARGETS[index]) } }));
  return inputs;
};
const review = async () => {
  const inputs = await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Validar credenciales' }));
  await screen.findByRole('button', { name: 'Aplicar credenciales validadas' });
  return inputs;
};

beforeEach(() => {
  vi.resetAllMocks();
  advanceChatbocSessionRevision();
  session.loading = false; session.hasVerifiedSession = true; session.organizationProfileVerified = true;
  session.user = { id: 42, role: 'superadmin', rol: 'superadmin' };
  api.status.mockImplementation(async target => statusFor(target));
  api.plan.mockImplementation(async status => planFor(status));
  api.apply.mockImplementation(async plan => receipt(plan));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('private credential loading', () => {
  it.each(['unverified', 'profile', 'tenant_admin'])('does not request or expose secret fields for %s', async condition => {
    if (condition === 'unverified') session.hasVerifiedSession = false;
    if (condition === 'profile') session.organizationProfileVerified = false;
    if (condition === 'tenant_admin') session.user.role = session.user.rol = 'tenant_admin';
    render(app());
    expect(screen.getByText('Acceso exclusivo de administración')).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(api.status).not.toHaveBeenCalled();
  });

  it('uses two hidden inputs, backend destination names, no storage, and an explicit review before apply', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    render(app());
    const inputs = await review();
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveAttribute('autocomplete', 'new-password');
      expect(input).toBeDisabled();
      expect(document.body.textContent).not.toContain(input.value);
      expect(document.body.innerHTML).not.toContain(input.value);
    }
    expect(api.plan).toHaveBeenCalledTimes(2);
    expect(api.apply).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(screen.getByText('Revisión 0 → 1')).toBeInTheDocument();
    expect(screen.getByText('Revisión 6 → 7')).toBeInTheDocument();
    expect(screen.getByText('Fecha verificada con Meta.')).toBeInTheDocument();
    expect(screen.getByText('Límite local de 30 días, aplicado después de validar la credencial con Meta.')).toBeInTheDocument();
  });

  it('suppresses repeated validation and apply clicks while each operation is in flight', async () => {
    const pending = deferred<MetaCredentialPlan>();
    api.plan.mockImplementationOnce(() => pending.promise);
    render(app()); await fill();
    const form = screen.getByRole('button', { name: 'Validar credenciales' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(api.plan).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(planFor(statusFor('junin-production'))));
    const button = await screen.findByRole('button', { name: 'Aplicar credenciales validadas' });
    const firstApply = deferred<ReturnType<typeof receipt>>();
    api.apply.mockImplementationOnce(() => firstApply.promise);
    fireEvent.click(button); fireEvent.click(button);
    expect(api.apply).toHaveBeenCalledOnce();
    await act(async () => firstApply.resolve(receipt(planFor(statusFor('junin-production')))));
    await screen.findByText('Las credenciales se guardaron y el servidor confirmó las nuevas revisiones.');
    expect(api.apply).toHaveBeenCalledTimes(2);
    expect(api.plan).toHaveBeenCalledTimes(2);
  });

  it('clears both entered values after successful confirmation and never sends them through status', async () => {
    render(app()); const inputs = await review();
    expect(screen.queryByRole('button', { name: 'Verificar conexión' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar credenciales validadas' }));
    await screen.findByText('Las credenciales se guardaron y el servidor confirmó las nuevas revisiones.');
    inputs.forEach(input => expect(input.value).toBe(''));
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(api.apply.mock.calls.map(call => call[1])).toEqual(META_CREDENTIAL_TARGETS.map(tokenFor));
    expect(api.status.mock.calls.every(call => call.length === 2 && typeof call[1] === 'object')).toBe(true);
    expect(screen.getByRole('button', { name: 'Verificar conexión' })).toBeEnabled();
    expect(api.inspectConnection).not.toHaveBeenCalled();
  });

  it('erases both fields on a validation error and shows only a fixed message', async () => {
    api.plan.mockRejectedValueOnce(new Error(`unsafe echo ${tokenFor('junin-production')}`));
    render(app()); const inputs = await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Validar credenciales' }));
    await screen.findByRole('alert');
    inputs.forEach(input => expect(input.value).toBe(''));
    expect(screen.getByRole('alert').textContent).not.toContain(tokenFor('junin-production'));
    expect(api.apply).not.toHaveBeenCalled();
  });

  it('preserves the first confirmation when the second write needs a status check', async () => {
    api.apply.mockResolvedValueOnce(receipt(planFor(statusFor('junin-production'))))
      .mockRejectedValueOnce(new Error('second acknowledgement lost'));
    render(app()); const inputs = await review();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar credenciales validadas' }));
    await screen.findByRole('button', { name: 'Verificar resultado' });
    expect(screen.queryByRole('button', { name: 'Verificar conexión' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Revisión 1 confirmada/)).toBeInTheDocument();
    inputs.forEach(input => expect(input.value).toBe(''));
    const plan = planFor(statusFor('tdf-sandbox'));
    api.status.mockResolvedValueOnce({ ...statusFor(plan.target), currentRevision: plan.nextRevision,
      expiresAt: plan.expiresAt, lastPlanSha256: plan.planSha256, operationAvailable: false });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar resultado' }));
    await screen.findByText('El estado del servidor confirmó la credencial guardada.');
    expect(screen.getByText(/^Revisión 7 confirmada/)).toBeInTheDocument();
    expect(api.apply).toHaveBeenCalledTimes(2);
    expect(api.status.mock.calls.at(-1)?.[0]).toBe('tdf-sandbox');
    expect(screen.queryByRole('button', { name: 'Actualizar operaciones pendientes' })).not.toBeInTheDocument();
  });

  it('checks the exact persisted plan after an uncertain write without replaying either token', async () => {
    api.apply.mockRejectedValueOnce(new Error('connection lost after commit'));
    render(app()); const inputs = await review();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar credenciales validadas' }));
    const verify = await screen.findByRole('button', { name: 'Verificar resultado' });
    inputs.forEach(input => expect(input.value).toBe(''));
    expect(screen.queryByRole('button', { name: 'Validar credenciales' })).not.toBeInTheDocument();
    expect(api.apply).toHaveBeenCalledOnce();
    // A revision match alone does not prove which plan committed.
    const plan = planFor(statusFor('junin-production'));
    api.status.mockResolvedValueOnce({ ...statusFor(plan.target), currentRevision: plan.nextRevision,
      expiresAt: plan.expiresAt, lastPlanSha256: 'c'.repeat(64), operationAvailable: false });
    fireEvent.click(verify);
    await screen.findByText('El estado todavía no confirma ese plan. No se enviará otro intento; verificá nuevamente.');
    expect(api.apply).toHaveBeenCalledOnce();
    api.status.mockResolvedValueOnce({ ...statusFor(plan.target), currentRevision: plan.nextRevision,
      expiresAt: plan.expiresAt, lastPlanSha256: plan.planSha256, operationAvailable: false });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar resultado' }));
    await screen.findByText('El estado del servidor confirmó la credencial guardada.');
    expect(api.apply).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Actualizar operaciones pendientes' })).toBeInTheDocument();
  });

  it.each(['cancel', 'unmount', 'pagehide'])('clears detached input elements on %s', async action => {
    const view = render(app()); const inputs = await fill();
    if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancelar y borrar' }));
    if (action === 'unmount') view.unmount();
    if (action === 'pagehide') act(() => window.dispatchEvent(new Event('pagehide')));
    inputs.forEach(input => expect(input.value).toBe(''));
    expect(api.plan).not.toHaveBeenCalled();
    expect(api.apply).not.toHaveBeenCalled();
  });

  it('retires an in-flight validation and clears the DOM when the same actor logs in again', async () => {
    const pending = deferred<MetaCredentialPlan>();
    api.plan.mockImplementationOnce(() => pending.promise);
    render(app()); const inputs = await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Validar credenciales' }));
    const requestScope = api.plan.mock.calls[0][2];
    act(() => { advanceChatbocSessionRevision(); });
    expect(requestScope.isCurrent()).toBe(false);
    inputs.forEach(input => expect(input.value).toBe(''));
    await act(async () => pending.resolve(planFor(statusFor('junin-production'))));
    await fields();
    expect(screen.queryByRole('button', { name: 'Aplicar credenciales validadas' })).not.toBeInTheDocument();
    expect(api.plan).toHaveBeenCalledOnce();
    expect(api.apply).not.toHaveBeenCalled();
  });
});
