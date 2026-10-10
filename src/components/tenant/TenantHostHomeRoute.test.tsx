import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantHostHomeRoute } from './TenantHostHomeRoute';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
const state = vi.hoisted(() => ({ binding: null as unknown }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ hostBinding: state.binding }) }));
vi.mock('@/pages/tenant/TenantHomePage', () => ({ default: () => <h1>Existing organization home</h1> }));
beforeEach(() => { state.binding = null; });
describe('same application root on an active bound domain', () => {
  it('preserves the shared Chatboc root', () => {
    render(<TenantHostHomeRoute><h1>Shared Chatboc</h1></TenantHostHomeRoute>);
    expect(screen.getByRole('heading', { name: 'Shared Chatboc' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Existing organization home' })).not.toBeInTheDocument();
  });
  it('uses the existing tenant home rather than creating another landing', async () => {
    state.binding = tenantHostFixture(); render(<TenantHostHomeRoute><h1>Shared Chatboc</h1></TenantHostHomeRoute>);
    expect(await screen.findByRole('heading', { name: 'Existing organization home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shared Chatboc' })).not.toBeInTheDocument();
  });
});
