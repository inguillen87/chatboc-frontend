import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantModal } from './TenantModal';
import type { Tenant } from '@/types/superAdmin';

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: { superAdminUpdateTenant: mocks.update, superAdminCreateTenant: mocks.create } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/platform/NativeAdminLegacyMembershipCard', () => ({ NativeAdminLegacyMembershipCard: () => null }));
const organization: Tenant = { id: 31, slug: 'selected-government', nombre: 'Gobierno seleccionado', tipo: 'municipio', plan: 'full', is_active: true, status: 'active', created_at: '' };
const props = () => ({ isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), onInstitutionProfile: vi.fn(), tenantToEdit: organization });
beforeEach(() => {
  vi.clearAllMocks(); mocks.update.mockResolvedValue(organization);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

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
