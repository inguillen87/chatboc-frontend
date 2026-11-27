import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TenantHostRouteBoundary, type TenantHostRouteDefinition } from './TenantHostRouteBoundary';

const binding = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ hostBinding: binding.current }) }));
vi.mock('@/pages/NotFound', () => ({ default: () => <p>no encontrada</p> }));
vi.mock('./TenantHostPrivateScope', () => ({ TenantHostPrivateScope: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const routes: TenantHostRouteDefinition[] = [
  { path: '/', tenantHost: 'public' },
  { path: '/t/:tenant/reclamos/nuevo', tenantHost: 'public', tenantHostParam: 'tenant' },
  { path: '/perfil', tenantHost: 'private' },
  { path: '/superadmin' },
];
const Where = () => { const location = useLocation(); return <p>en {location.pathname}{location.search}</p>; };
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><TenantHostRouteBoundary routes={routes}><Where /></TenantHostRouteBoundary></MemoryRouter>,
);

describe('TenantHostRouteBoundary', () => {
  it('opens the short form of a public page on the organization address', () => {
    binding.current = { host: 'demo.example.org', tenant: { id: 7, slug: 'demo' } };
    renderAt('/reclamos/nuevo?origen=qr');
    expect(screen.getByText('en /t/demo/reclamos/nuevo?origen=qr')).toBeInTheDocument();
  });
  it('keeps unknown and platform-only paths closed', () => {
    binding.current = { host: 'demo.example.org', tenant: { id: 7, slug: 'demo' } };
    renderAt('/superadmin');
    expect(screen.getByText('no encontrada')).toBeInTheDocument();
  });
  it('never rewrites a path that names another organization', () => {
    binding.current = { host: 'demo.example.org', tenant: { id: 7, slug: 'demo' } };
    renderAt('/t/otra/reclamos/nuevo');
    expect(screen.getByText('no encontrada')).toBeInTheDocument();
  });
  it('does nothing on the shared platform address', () => {
    binding.current = null;
    renderAt('/reclamos/nuevo');
    expect(screen.getByText('en /reclamos/nuevo')).toBeInTheDocument();
  });
});
