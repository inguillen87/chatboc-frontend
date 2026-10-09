import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { syntheticMembership, syntheticMembershipApplied, syntheticMembershipRequestId,
  syntheticMembershipTenant as tenant } from '../../../../tests/fixtures/native-admin-membership.synthetic';
import type { NativeAdminLegacyMembership } from './nativeAdminLegacyMembership';
import { TenantModal } from '@/components/admin/TenantModal';
import type { Tenant } from '@/types/superAdmin';

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), apply: vi.fn(), session: {
  user: { id: 'synthetic-sa', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true,
} }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.session }));
vi.mock('./nativeAdminLegacyMembership', () => ({
  listNativeAdminLegacyMemberships: mocks.list,
  getNativeAdminLegacyMembership: mocks.get,
  applyNativeAdminLegacyMembership: mocks.apply,
}));
import { NativeAdminLegacyMembershipCard } from './NativeAdminLegacyMembershipCard';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => {
  mocks.session = { user: { id: 'synthetic-sa', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true };
  mocks.list.mockReset().mockResolvedValue([syntheticMembership()]);
  mocks.get.mockReset().mockResolvedValue(syntheticMembership());
  mocks.apply.mockReset().mockResolvedValue(syntheticMembershipApplied());
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(syntheticMembershipRequestId);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const openReview = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar vinculación de admin@example.invalid' }));
  const dialog = await screen.findByRole('dialog', { name: 'Revisar vinculación' });
  await within(dialog).findByText('Referencia actual:');
  return dialog;
};
const confirmButton = () => screen.getByRole('button', { name: 'Confirmar corrección de referencia' });

describe('existing native administrator reference review', () => {
  it('loads existing users through the municipal organization modal only after opening its Users tab', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const municipalTenant = { ...tenant, tipo: 'municipio', plan: 'enterprise', is_active: true } as Tenant;
    const props = { isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), tenantToEdit: municipalTenant };
    const view = render(<TenantModal {...props} initialTab="general" />);
    expect(mocks.list).not.toHaveBeenCalled();
    view.rerender(<TenantModal {...props} initialTab="users" />);
    await screen.findByRole('region', { name: 'Administradores existentes' });
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(municipalTenant, expect.any(Function));
    view.rerender(<TenantModal {...props} isOpen={false} initialTab="users" />);
    expect((mocks.list.mock.calls[0][1] as () => boolean)()).toBe(false);
  });

  it('reviews a listed user before allowing an explicit correction, without credential inputs', async () => {
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />);
    await screen.findByText('Administrador de prueba');
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
    const dialog = await openReview();
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(tenant, expect.any(Function));
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(tenant, 77, expect.any(Function));
    expect(within(dialog).getByText('77')).toBeVisible(); expect(within(dialog).getByText('20')).toBeVisible();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());
    await screen.findByText('Vinculación corregida y resultado verificado.');
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(syntheticMembership(), syntheticMembershipRequestId, expect.any(Function));
    expect(confirmButton()).toBeDisabled();
    expect(mocks.get).toHaveBeenCalledOnce();
  });

  it.each(['already_consistent', 'blocked'] as const)('does not submit when the server reports %s', async state => {
    const review = syntheticMembership();
    const blocked = { ...review, state, can_apply: false, permissions: { ...review.permissions, can_normalize_legacy_reference: false } };
    mocks.get.mockResolvedValueOnce(blocked);
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />); await openReview();
    expect(confirmButton()).toBeDisabled(); fireEvent.click(confirmButton()); expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('requires a fresh human read and confirmation after a conflict, without reusing the old revision', async () => {
    const next = { ...syntheticMembership(), expected_revision: 'c'.repeat(64) };
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(syntheticMembershipRequestId).mockReturnValueOnce('12345678-1234-4567-89ab-123456789abd');
    mocks.apply.mockRejectedValueOnce(new ApiError('revision_conflict', 412)).mockResolvedValueOnce(syntheticMembershipApplied(next));
    mocks.get.mockResolvedValueOnce(syntheticMembership()).mockResolvedValueOnce(next);
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />); await openReview(); fireEvent.click(confirmButton());
    await screen.findByText('La vinculación cambió. Volvé a consultarla antes de confirmar.');
    expect(screen.queryByRole('button', { name: 'Confirmar corrección de referencia' })).not.toBeInTheDocument();
    expect(mocks.apply).toHaveBeenCalledOnce(); expect(mocks.get).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }));
    await screen.findByText('Referencia actual:');
    expect(mocks.apply).toHaveBeenCalledOnce();
    fireEvent.click(confirmButton()); await screen.findByText('Vinculación corregida y resultado verificado.');
    expect(mocks.apply.mock.calls[1][0].expected_revision).toBe('c'.repeat(64));
    expect(mocks.apply.mock.calls[1][1]).not.toBe(mocks.apply.mock.calls[0][1]);
  });

  it.each([503, 502] as const)('retains a clear unknown result after HTTP %s without another write', async status => {
    mocks.apply.mockRejectedValueOnce(new ApiError('unverified_result', status));
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />); await openReview(); fireEvent.click(confirmButton());
    await screen.findByText('No pudimos comprobar el resultado. Volvé a consultar la vinculación antes de realizar otra acción.');
    expect(mocks.apply).toHaveBeenCalledOnce(); expect(mocks.get).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Confirmar corrección de referencia' })).not.toBeInTheDocument();
  });

  it('clears the old list after denied access and never submits an action', async () => {
    mocks.get.mockRejectedValueOnce(new ApiError('superadmin_required', 403));
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar vinculación de admin@example.invalid' }));
    await within(await screen.findByRole('dialog')).findByText('No tenés acceso a esta revisión.');
    expect(screen.queryByRole('button', { name: 'Revisar vinculación de admin@example.invalid' })).not.toBeInTheDocument();
    expect(screen.queryByText('Administrador de prueba')).not.toBeInTheDocument();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('prevents a double click and closes only after the pending write is resolved', async () => {
    const pending = deferred<NativeAdminLegacyMembership>(); mocks.apply.mockReturnValueOnce(pending.promise);
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />); await openReview();
    const confirm = confirmButton(); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.apply).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeVisible();
    await act(async () => pending.resolve(syntheticMembershipApplied()));
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled();
  });

  it.each(['unverified', 'unverified profile', 'tenant administrator'] as const)('does not request data for an %s actor', kind => {
    if (kind === 'unverified') mocks.session.hasVerifiedSession = false;
    if (kind === 'unverified profile') mocks.session.organizationProfileVerified = false;
    if (kind === 'tenant administrator') mocks.session.user.rol = 'admin_municipio';
    const { container } = render(<NativeAdminLegacyMembershipCard tenant={tenant} />);
    expect(container).toBeEmptyDOMElement(); expect(mocks.list).not.toHaveBeenCalled();
  });

  it.each(['actor', 'tenant', 'unverified'] as const)('discards a late review after changing the %s', async kind => {
    const pending = deferred<NativeAdminLegacyMembership>(); mocks.get.mockReturnValueOnce(pending.promise);
    const view = render(<NativeAdminLegacyMembershipCard tenant={tenant} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar vinculación de admin@example.invalid' }));
    const isCurrent = mocks.get.mock.calls[0][2] as () => boolean;
    expect(isCurrent()).toBe(true);
    if (kind === 'actor') mocks.session.user = { id: 'different-sa', rol: 'superadmin' };
    if (kind === 'unverified') mocks.session.hasVerifiedSession = false;
    const nextTenant = kind === 'tenant' ? { id: 23, slug: 'other-municipality', nombre: 'Otra organización' } : tenant;
    view.rerender(<NativeAdminLegacyMembershipCard tenant={nextTenant} />);
    expect(isCurrent()).toBe(false);
    await act(async () => pending.resolve(syntheticMembership()));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('retires logout without requiring a component render and hides an eventual write receipt', async () => {
    const pending = deferred<NativeAdminLegacyMembership>(); mocks.apply.mockReturnValueOnce(pending.promise);
    render(<NativeAdminLegacyMembershipCard tenant={tenant} />); await openReview(); fireEvent.click(confirmButton());
    const isCurrent = mocks.apply.mock.calls[0][2] as () => boolean;
    expect(isCurrent()).toBe(true); advanceChatbocSessionRevision(); expect(isCurrent()).toBe(false);
    await act(async () => pending.resolve(syntheticMembershipApplied()));
    expect(screen.queryByText('Vinculación corregida y resultado verificado.')).not.toBeInTheDocument();
    expect(mocks.apply).toHaveBeenCalledOnce();
  });

  it('discards late list data after unmount', async () => {
    const pending = deferred<NativeAdminLegacyMembership[]>(); mocks.list.mockReturnValueOnce(pending.promise);
    const view = render(<NativeAdminLegacyMembershipCard tenant={tenant} />);
    const isCurrent = mocks.list.mock.calls[0][1] as () => boolean;
    view.unmount(); expect(isCurrent()).toBe(false);
    await act(async () => pending.resolve([syntheticMembership()]));
    expect(screen.queryByText('Administrador de prueba')).not.toBeInTheDocument();
  });
});
