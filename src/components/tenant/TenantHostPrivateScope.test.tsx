import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantHostPrivateScope } from './TenantHostPrivateScope';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';

const state = vi.hoisted(() => ({ binding: null as unknown, user: null as unknown, loading: false, verified: true, session: true }));
vi.mock('@/context/TenantContext', () => ({ useTenantContextPresence: () => ({ hostBinding: state.binding }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: state.user, loading: state.loading, organizationProfileVerified: state.verified }) }));
vi.mock('@/components/access/SessionAuthorityContext', () => ({ useSessionAuthority: () => ({ hasVerifiedSession: state.session }) }));
const actor = (id = 17, slug = 'government-east') => ({
  tenant_slug: slug, rol: 'admin',
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id, slug }, values: { nombre_empresa: 'Organización de prueba' } },
  organization_workspace: { contract_version: 'organization.profile_workspace.v1', tenant: { id, slug }, organization_type: 'gobierno' },
});
beforeEach(() => { state.binding = tenantHostFixture(); state.user = actor(); state.loading = false; state.verified = true; state.session = true; });
function renderScope() { return render(<TenantHostPrivateScope><div>private content</div></TenantHostPrivateScope>); }
describe('custom host private scope', () => {
  it('leaves shared-host authorization unchanged', () => { state.binding = null; state.user = null; renderScope(); expect(screen.getByText('private content')).toBeInTheDocument(); });
  it('admits only the exact fresh authenticated ID and slug', () => { renderScope(); expect(screen.getByText('private content')).toBeInTheDocument(); });
  it.each([[18, 'government-east'], [17, 'old-workspace']])('withholds private children for mismatched ID/slug %s %s', (id, slug) => {
    state.user = actor(id as number, slug as string); renderScope();
    expect(screen.queryByText('private content')).not.toBeInTheDocument();
    expect(screen.getByText('Esta cuenta no corresponde a este espacio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al acceso central' })).toHaveAttribute('href', 'https://www.chatboc.ar/login');
  });
  it.each(['verified', 'session'] as const)('does not turn stale %s into authorization', key => { state[key] = false; renderScope(); expect(screen.queryByText('private content')).not.toBeInTheDocument(); });
  it('withholds private children during refresh', () => { state.loading = true; renderScope(); expect(screen.queryByText('private content')).not.toBeInTheDocument(); expect(screen.getByText('Validando acceso institucional')).toBeInTheDocument(); });
});
