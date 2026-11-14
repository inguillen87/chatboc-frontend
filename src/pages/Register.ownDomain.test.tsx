import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Register from './Register';
import { ClerkRuntimeProvider } from '@/components/auth/ClerkRuntimeContext';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';

const mocks = vi.hoisted(() => ({ tenantContext: vi.fn(), hostNeedsLookup: vi.fn(() => false) }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => mocks.tenantContext() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ setUser: vi.fn(), refreshUser: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock('@/services/passkeys', () => ({ isPasskeySupported: () => Promise.resolve(false), registerPasskey: vi.fn() }));
vi.mock('@/utils/tenantHostBinding', async original => ({ ...await original<typeof import('@/utils/tenantHostBinding')>(), requiresTenantHostLookup: () => mocks.hostNeedsLookup() }));

const renderRegister = () => render(
  <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ClerkRuntimeProvider value={{ enabled: false, loading: false, publishableKey: '', source: 'disabled', socialProviders: [] }}>
      <Routes><Route path="/register" element={<Register />} /><Route path="/login" element={<p>Pantalla de ingreso</p>} /></Routes>
    </ClerkRuntimeProvider>
  </MemoryRouter>,
);

describe('Register on an organization domain', () => {
  beforeEach(() => { mocks.hostNeedsLookup.mockReturnValue(false); });

  it('sends a resolved own domain to its login instead of creating accounts', () => {
    const binding = tenantHostFixture();
    mocks.hostNeedsLookup.mockReturnValue(true);
    mocks.tenantContext.mockReturnValue({ hostBinding: binding, currentSlug: binding.tenant.slug, tenant: null, isLoadingTenant: false });
    renderRegister();
    expect(screen.getByText('Pantalla de ingreso')).toBeInTheDocument();
  });

  it('fails closed on an unknown host that has not resolved', () => {
    mocks.hostNeedsLookup.mockReturnValue(true);
    mocks.tenantContext.mockReturnValue({ hostBinding: null, currentSlug: null, tenant: null, isLoadingTenant: false });
    renderRegister();
    expect(screen.getByText('Pantalla de ingreso')).toBeInTheDocument();
  });

  it('keeps registration on the platform host', () => {
    mocks.tenantContext.mockReturnValue({ hostBinding: null, currentSlug: null, tenant: null, isLoadingTenant: false });
    renderRegister();
    expect(screen.queryByText('Pantalla de ingreso')).toBeNull();
    expect(screen.getByRole('button', { name: /registr|crear/i })).toBeInTheDocument();
  });
});
