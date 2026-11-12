import React from 'react';
import { flushSync } from 'react-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantModal } from './TenantModal';
import type { Tenant } from '@/types/superAdmin';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), createUser: vi.fn(), reset: vi.fn(), whatsapp: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: {
  superAdminUpdateTenant: mocks.update, superAdminCreateTenant: mocks.create,
  superAdminCreateAdminUser: mocks.createUser, superAdminResetPassword: mocks.reset, superAdminUpdateWhatsapp: mocks.whatsapp,
} }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/components/admin/platform/NativeAdminLegacyMembershipCard', () => ({ NativeAdminLegacyMembershipCard: () => null }));
const organization: Tenant = { id: 31, slug: 'selected-government', nombre: 'Gobierno seleccionado', tipo: 'municipio', plan: 'full', is_active: true, status: 'active', created_at: '' };
const props = () => ({ isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), onInstitutionProfile: vi.fn(), tenantToEdit: organization });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReset().mockResolvedValue(organization);
  mocks.create.mockReset().mockResolvedValue({});
  mocks.createUser.mockReset().mockResolvedValue({});
  mocks.reset.mockReset().mockResolvedValue({});
  mocks.whatsapp.mockReset().mockResolvedValue({});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('tenant plan and status scope', () => {
  it('opens the revisioned data editor for the exact selected tenant without submitting a legacy update', () => {
    const handlers = props();render(<TenantModal {...handlers} />);
    expect(screen.queryByRole('textbox', { name: 'Nombre' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar datos institucionales' }));
    expect(handlers.onInstitutionProfile).toHaveBeenCalledOnce();
    expect(handlers.onInstitutionProfile).toHaveBeenCalledWith(organization);
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
  });
  it('sends only plan and status for the selected tenant, without the institutional name', async () => {
    const handlers = props();render(<TenantModal {...handlers} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Estado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('selected-government', { plan: 'full', is_active: false }));
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(handlers.onInstitutionProfile).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([false, undefined])('keeps the institutional action unavailable without an active target or authorized navigation %s', (active) => {
    render(<TenantModal {...props()} tenantToEdit={{ ...organization, is_active: active === false ? false : true }} onInstitutionProfile={active === undefined ? undefined : vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Editar datos institucionales' })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rebinds the modal action and plan payload when the selected tenant changes', async () => {
    const handlers = props();const second: Tenant = { ...organization, id: 44, slug: 'selected-school', nombre: 'Colegio seleccionado', tipo: 'colegio', plan: 'pro' };
    const view = render(<TenantModal {...handlers} />);
    view.rerender(<TenantModal {...handlers} tenantToEdit={second} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('selected-school', { plan: 'pro', is_active: true }));
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});

const secondOrganization: Tenant = { ...organization, id: 44, slug: 'selected-school', nombre: 'Colegio seleccionado', tipo: 'colegio', plan: 'pro' };
const deferred = () => {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const fillAdministrator = (origin = 'A') => {
  fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: `Usuario sintético ${origin}` } });
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: `audit-${origin.toLowerCase()}@example.test` } });
  fireEvent.change(screen.getByPlaceholderText('Contraseña', { exact: true }), { target: { value: `synthetic-only-${origin}-123` } });
};
const userProps = () => ({ ...props(), initialTab: 'users' as const });

describe('tenant modal opening and authority ownership', () => {
  it.each(['direct tenant change', 'close and reopen'])('retires private administrator and password drafts on %s', (transition) => {
    const handlers = userProps();
    const view = render(<TenantModal {...handlers} />);
    fillAdministrator();
    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), { target: { value: 'synthetic-reset-only-A' } });
    if (transition === 'close and reopen') view.rerender(<TenantModal {...handlers} isOpen={false} />);
    view.rerender(<TenantModal {...handlers} tenantToEdit={secondOrganization} />);
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('');
    expect(screen.getByPlaceholderText('Email')).toHaveValue('');
    expect(screen.getByPlaceholderText('Contraseña', { exact: true })).toHaveValue('');
    expect(screen.getByPlaceholderText('Nueva contraseña')).toHaveValue('');
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('clears a cancelled draft before explicitly reopening the same organization', () => {
    const handlers = userProps();
    const view = render(<TenantModal {...handlers} />);
    fillAdministrator();
    fireEvent.keyDown(screen.getByPlaceholderText('Nombre'), { key: 'Escape' });
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<TenantModal {...handlers} isOpen={false} />);
    view.rerender(<TenantModal {...handlers} />);
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('');
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('preserves the current administrator draft after a recoverable error and a same-organization refresh', async () => {
    mocks.createUser.mockRejectedValueOnce(new Error('Synthetic unavailable'));
    const handlers = userProps();
    const view = render(<TenantModal {...handlers} />);
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Crear Usuario' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Error al crear usuario'));
    view.rerender(<TenantModal {...handlers} tenantToEdit={{ ...organization }} />);
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('Usuario sintético A');
    expect(screen.getByPlaceholderText('Email')).toHaveValue('audit-a@example.test');
    expect(screen.getByPlaceholderText('Contraseña', { exact: true })).toHaveValue('synthetic-only-A-123');
    expect(screen.getByRole('button', { name: 'Crear Usuario' })).toBeEnabled();
    expect(mocks.createUser).toHaveBeenCalledOnce();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
  });

  it('preserves plan/status edits when the same organization object is refreshed', () => {
    const handlers = props();
    const view = render(<TenantModal {...handlers} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Estado' }));
    view.rerender(<TenantModal {...handlers} tenantToEdit={{ ...organization }} />);
    expect(screen.getByRole('switch', { name: 'Estado' })).not.toBeChecked();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('associates administrator labels and keeps the password autocomplete appropriate for a new value', () => {
    render(<TenantModal {...userProps()} />);
    expect(screen.getByLabelText('Nombre del administrador')).toHaveAttribute('autoComplete', 'off');
    expect(screen.getByLabelText('Correo del administrador')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña del administrador')).toHaveAttribute('autoComplete', 'new-password');
    expect(screen.getByLabelText('Nueva contraseña del administrador')).toHaveAttribute('autoComplete', 'new-password');
  });

  it('retires create cancellation immediately even before the controlled parent closes', async () => {
    const pending = deferred(); mocks.create.mockReturnValueOnce(pending.promise);
    const handlers = props();
    const view = render(<TenantModal {...handlers} tenantToEdit={null} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Organización sintética' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'audit-org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Tenant' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handlers.onClose).toHaveBeenCalledOnce();
    view.rerender(<TenantModal {...handlers} tenantToEdit={null} isOpen={false} />);
    view.rerender(<TenantModal {...handlers} tenantToEdit={null} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Borrador nuevo' } });
    await act(async () => pending.resolve());
    expect(screen.getByLabelText('Nombre')).toHaveValue('Borrador nuevo');
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('preserves the current WhatsApp draft across a same-organization refresh', () => {
    const handlers = { ...props(), initialTab: 'integrations' as const };
    const view = render(<TenantModal {...handlers} />);
    fireEvent.change(screen.getByPlaceholderText('+54911...'), { target: { value: '+15550000001' } });
    view.rerender(<TenantModal {...handlers} tenantToEdit={{ ...organization, whatsapp_sender_id: '+15550000002' }} />);
    expect(screen.getByPlaceholderText('+54911...')).toHaveValue('+15550000001');
    expect(mocks.whatsapp).not.toHaveBeenCalled();
  });

  it('allows one administrator submission and locks editable fields until its receipt', async () => {
    const pending = deferred(); mocks.createUser.mockReturnValueOnce(pending.promise);
    render(<TenantModal {...userProps()} />);
    fillAdministrator();
    const form = screen.getByRole('button', { name: 'Crear Usuario' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(mocks.createUser).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('Nombre')).toBeDisabled();
    expect(screen.getByPlaceholderText('Contraseña', { exact: true })).toBeDisabled();
    await act(async () => pending.resolve());
    expect(mocks.success).toHaveBeenCalledWith('Usuario administrador creado');
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('');
    expect(mocks.createUser.mock.calls[0][0]).toBe(organization.slug);
  });

  it.each(['new organization', 'close/reopen same organization', 'A to B to A'])('ignores an old administrator ACK after %s', async (transition) => {
    const pending = deferred(); mocks.createUser.mockReturnValueOnce(pending.promise);
    const handlers = userProps();
    const view = render(<TenantModal {...handlers} />);
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Crear Usuario' }));
    await waitFor(() => expect(mocks.createUser).toHaveBeenCalledOnce());
    if (transition === 'close/reopen same organization') view.rerender(<TenantModal {...handlers} isOpen={false} />);
    else view.rerender(<TenantModal {...handlers} tenantToEdit={secondOrganization} />);
    if (transition !== 'new organization') view.rerender(<TenantModal {...handlers} />);
    fillAdministrator('B');
    await act(async () => pending.resolve());
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('Usuario sintético B');
    expect(mocks.success).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(mocks.createUser).toHaveBeenCalledOnce();
  });

  it.each(['resolve', 'reject'])('ignores a retired plan request %s after unmount', async (settlement) => {
    const pending = deferred(); mocks.update.mockReturnValueOnce(pending.promise);
    const handlers = props();
    const view = render(<TenantModal {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => settlement === 'resolve' ? pending.resolve() : pending.reject(new Error('Synthetic unavailable')));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
  });

  it('does not close the new organization when an old plan ACK arrives', async () => {
    const pending = deferred(); mocks.update.mockReturnValueOnce(pending.promise);
    const handlers = props();
    const view = render(<TenantModal {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    view.rerender(<TenantModal {...handlers} tenantToEdit={secondOrganization} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Estado' }));
    await act(async () => pending.resolve());
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Estado' })).not.toBeChecked();
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('does not close a replacement owner after the current success callback synchronously changes A to B to A', async () => {
    const pending = deferred(); mocks.update.mockReturnValueOnce(pending.promise);
    const handlers = props();
    let view: ReturnType<typeof render>;
    const success = vi.fn(() => {
      flushSync(() => view.rerender(<TenantModal {...handlers} tenantToEdit={secondOrganization} onSuccess={success} />));
      flushSync(() => view.rerender(<TenantModal {...handlers} onSuccess={success} />));
    });
    view = render(<TenantModal {...handlers} onSuccess={success} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    await act(async () => pending.resolve());
    expect(success).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it.each(['password', 'whatsapp'])('does not reset a new organization form after a retired %s ACK', async (kind) => {
    const pending = deferred();
    const api = kind === 'password' ? mocks.reset : mocks.whatsapp;
    api.mockReturnValueOnce(pending.promise);
    const handlers = { ...props(), initialTab: kind === 'password' ? 'users' as const : 'integrations' as const };
    const placeholder = kind === 'password' ? 'Nueva contraseña' : '+54911...';
    const button = kind === 'password' ? 'Resetear' : 'Guardar Integración';
    const view = render(<TenantModal {...handlers} />);
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: kind === 'password' ? 'synthetic-reset-only-A' : '+15550000001' } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(api).toHaveBeenCalledOnce());
    view.rerender(<TenantModal {...handlers} tenantToEdit={secondOrganization} />);
    const currentValue = kind === 'password' ? 'synthetic-reset-only-B' : '+15550000002';
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: currentValue } });
    await act(async () => pending.resolve());
    expect(screen.getByPlaceholderText(placeholder)).toHaveValue(currentValue);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(handlers.onSuccess).not.toHaveBeenCalled();
  });

  it('retires an open form on session revision and cannot automatically reopen or accept its delayed receipt', async () => {
    const pending = deferred(); mocks.createUser.mockReturnValueOnce(pending.promise);
    const handlers = userProps();
    const view = render(<TenantModal {...handlers} />);
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Crear Usuario' }));
    await waitFor(() => expect(mocks.createUser).toHaveBeenCalledOnce());
    act(() => { advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handlers.onClose).toHaveBeenCalledOnce();
    view.rerender(<TenantModal {...handlers} tenantToEdit={{ ...organization }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<TenantModal {...handlers} isOpen={false} />);
    view.rerender(<TenantModal {...handlers} />);
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('');
    fillAdministrator('B');
    await act(async () => pending.resolve());
    expect(screen.getByPlaceholderText('Nombre')).toHaveValue('Usuario sintético B');
    expect(mocks.success).not.toHaveBeenCalled();
    expect(handlers.onClose).toHaveBeenCalledOnce();
    expect(mocks.createUser).toHaveBeenCalledOnce();
  });

  it('closes the controlled parent once on a session boundary and allows its next explicit trigger to open a clean form', () => {
    const closed = vi.fn();
    function ControlledModal() {
      const [open, setOpen] = React.useState(true);
      return <><button onClick={() => setOpen(true)}>Abrir gestión</button>
        <output aria-label="Estado del modal">{open ? 'abierto' : 'cerrado'}</output>
        <TenantModal {...userProps()} isOpen={open} onClose={() => { closed(); setOpen(false); }} />
      </>;
    }
    render(<ControlledModal />);
    fillAdministrator();
    act(() => { advanceChatbocSessionRevision(); });
    expect(screen.getByLabelText('Estado del modal')).toHaveTextContent('cerrado');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir gestión' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText('Nombre del administrador')).toHaveValue('');
    expect(closed).toHaveBeenCalledOnce();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it.each(['Escape', 'Cancelar', 'Cerrar gestión de organización'])('returns focus to a connected external opener after owned %s closure', async (method) => {
    function ControlledModal() {
      const [open, setOpen] = React.useState(false);
      return <><button onClick={() => setOpen(true)}>Abrir organización</button>
        <TenantModal {...props()} tenantToEdit={null} isOpen={open} onClose={() => setOpen(false)} />
      </>;
    }
    render(<ControlledModal />);
    const trigger = screen.getByRole('button', { name: 'Abrir organización' });
    trigger.focus(); fireEvent.click(trigger);
    await screen.findByRole('dialog');
    if (method === 'Escape') fireEvent.keyDown(screen.getByLabelText('Nombre'), { key: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: method }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('does not take back voluntary external focus while an owned close retires', async () => {
    function ControlledModal() {
      const [open, setOpen] = React.useState(false);
      return <><button onClick={() => setOpen(true)}>Abrir organización</button><button>Otra tarea</button>
        <TenantModal {...props()} tenantToEdit={null} isOpen={open} onClose={() => setOpen(false)} />
      </>;
    }
    render(<ControlledModal />);
    const trigger = screen.getByRole('button', { name: 'Abrir organización' });
    trigger.focus(); fireEvent.click(trigger);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    const other = screen.getByRole('button', { name: 'Otra tarea' });
    other.focus();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(other).toHaveFocus();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
