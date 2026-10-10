import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter,useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar from './Navbar';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
const logout=vi.hoisted(()=>vi.fn());
vi.mock('@/utils/sessionLogout',async original=>({...await original<typeof import('@/utils/sessionLogout')>(),logoutChatbocSession:logout}));

// Preserve real Link refs, accessible names and DOM attributes in navigation tests.
vi.mock('react-router-dom', async()=>await vi.importActual('react-router-dom'));

const useUserMock = vi.fn();
const useCapabilitiesMock = vi.fn();
const useSessionAuthorityMock = vi.fn();
const useTenantMock = vi.fn();

vi.mock('@/components/brand/ChatbocBrandLockup', () => ({
  default: () => <span>Chatboc.ar</span>,
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => useUserMock(),
}));

vi.mock('@/hooks/useCartCount', () => ({
  default: () => 0,
}));

vi.mock('@/hooks/useLandingExperience', () => ({
  useLandingExperience: () => ({ experience: null }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => useTenantMock(),
}));

vi.mock('@/context/CapabilitiesContext', () => ({
  useCapabilities: () => useCapabilitiesMock(),
}));

vi.mock('@/components/access/SessionAuthorityContext', () => ({
  useSessionAuthority: () => useSessionAuthorityMock(),
}));


const canonicalOrganizationUser = (kind = 'municipio', slug = 'civic-workspace', canEdit = true) => ({
  id: 9001, name: 'Personal operator', email: 'operator@example.test',
  rol: 'admin_municipio', tipo_chat: 'pyme', rubro: 'medico', plan: 'full',
  tenant_slug: slug, tenantSlug: slug,
  avatar_url: 'https://cdn.example.test/personal.png', avatar_consent: true,
  capabilities: ['tickets.read', 'orders.read'],
  organization_profile: {
    contract_version: 'organization.profile_settings.v1', tenant: { id: 303, slug },
    revision: 'a'.repeat(64), can_edit: canEdit,
    editability: { mode: canEdit ? 'editable' : 'read_only' },
    values: {
      nombre_empresa: 'Verified institution', telefono: '+541112345678', actividad: 'Public services',
      direccion: 'Institutional address', ciudad: 'Institutional city', provincia: 'Province', pais: 'Argentina',
      latitud: null, longitud: null, link_web: 'https://institution.example.test',
      logo_url: 'https://cdn.example.test/institution.png', horario_json: [],
    },
    ui: { organization_type_label_contract: 'organization.type_label.v1',
      organization_type_label: kind === 'municipio' ? 'Gobierno' : kind === 'colegio' ? 'Educación' : 'Empresa' },
  },
  organization_workspace: {
    contract_version: 'organization.profile_workspace.v1', tenant: { id: 303, slug },
    organization_type: kind,
  },
});

describe('Navbar account menu routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.clearAllMocks();
    useTenantMock.mockReturnValue({currentSlug:'junin'});
    window.localStorage.clear();
    document.body.classList.remove('chatboc-mobile-menu-open');
    useUserMock.mockReturnValue({
      user: {
        rol: 'admin',
        tipo_chat: 'municipio',
        nombre_empresa: 'Municipalidad de Junín',
        plan: 'full',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read', 'orders.read'],
      hasAnyCapability: (required: string[]) =>
        required.some((capability) => ['tickets.read', 'orders.read'].includes(capability)),
    });
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'disabled',
      hasBearerSession: true,
      hasVerifiedSession: true,
    });
  });
  it('brands the bound root from its published identity and keeps public access on the same host', () => {
    const binding = tenantHostFixture();
    useTenantMock.mockReturnValue({ currentSlug: binding.tenant.slug, hostBinding: binding, tenant: binding.tenant });
    useUserMock.mockReturnValue({ user: null, loading: false });
    useSessionAuthorityMock.mockReturnValue({ hasVerifiedSession: false, hasBearerSession: false });
    render(<MemoryRouter initialEntries={['/']}><Navbar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Organización de prueba/ })).toHaveAttribute('href', '/');
    expect(screen.getByText('atencion.example.test')).toBeInTheDocument();
    expect(screen.queryByText('Chatboc.ar')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' }).every(link => link.getAttribute('href') === '/login')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Ver demo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /carrito/i })).not.toBeInTheDocument();
  });
  it('replaces the organization route with central login before remote retirement completes',()=>{
    logout.mockReturnValue(new Promise(()=>{}));
    const RouteProbe=()=>{const location=useLocation();return <output data-testid="logout-route">{location.pathname+location.search}</output>;};
    render(<MemoryRouter initialEntries={['/admin/knowledge?tenant_slug=junin']}><Navbar/><RouteProbe/></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:/abrir men/i}));fireEvent.click(screen.getByRole('button',{name:'Cerrar sesión'}));
    expect(screen.getByTestId('logout-route')).toHaveTextContent('/login');expect(screen.getByTestId('logout-route')).not.toHaveTextContent('tenant_slug');expect(logout).toHaveBeenCalledOnce();
  });

  it.each(['/superadmin', '/superadmin?section=crm&tenant_slug=junin'])('shows platform identity at %s instead of the linked trial business', (path) => {
    useUserMock.mockReturnValue({ user: { rol: 'super_admin', name: 'Marcelo', nombre_empresa: 'MyB Store', plan: 'free' } });
    render(<MemoryRouter initialEntries={[path]}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByText('ChatBoc · Plataforma')).toBeInTheDocument();
    expect(screen.getByText('Superadministrador')).toBeInTheDocument();
    expect(screen.queryByText('MyB Store')).not.toBeInTheDocument();
    expect(screen.queryByText('Plan y facturación')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /carrito/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('href', '/superadmin?section=organizations');
    expect(screen.getByRole('link', { name: 'CRM comercial' })).toHaveAttribute('href', '/superadmin?section=crm');
  });

  it.each(['/t/junin/perfil', '/T/junin/perfil', '/junin/analytics', '/junin/estadisticas', '/junin/analytics/operations'])('retains organization identity at %s', (path) => {
    useUserMock.mockReturnValue({ organizationProfileVerified: true, user: { rol: 'super_admin', name: 'Marcelo', nombre_empresa: 'MyB Store' } });
    useTenantMock.mockReturnValue({ currentSlug: 'junin', tenant: { slug: 'junin', tipo: 'municipio', publishedIdentity: { tenantId: 2, tenantSlug: 'junin', name: 'Municipalidad de Junín' } } });
    render(<MemoryRouter initialEntries={[path]}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByText('Municipalidad de Junín')).toBeInTheDocument();
    expect(screen.queryByText('ChatBoc · Plataforma')).not.toBeInTheDocument();
  });
  it('keeps the ordinary public-site link own-scoped despite a foreign query and public tenant context', () => {
    const user = canonicalOrganizationUser('municipio', 'junin'), before = JSON.stringify(user);
    useUserMock.mockReturnValue({ user, organizationProfileVerified: true, loading: false });
    useTenantMock.mockReturnValue({ currentSlug: 'tierra-del-fuego' });
    render(<MemoryRouter initialEntries={['/perfil?tab=perfil&tenant_slug=tierra-del-fuego']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: /abrir men/i}));
    expect(screen.getByRole('link', {name: 'Ver sitio publico'})).toHaveAttribute('href', '/t/junin');
    expect(screen.getByRole('link', {name: 'Panel de Verified institution'})).toHaveAttribute('href', '/perfil');
    expect(screen.getByRole('link', {name: 'Perfil y organización'})).toHaveAttribute('href', '/perfil?tab=perfil&tenant_slug=junin&section=general');
    expect(screen.getByRole('link', {name: 'Pedidos'})).toHaveAttribute('href', '/perfil?tab=pedidos&tenant_slug=junin');
    expect(JSON.stringify(user)).toBe(before);
  });

  it('uses the selected knowledge organization identity and scoped profile without relabeling the actor home', () => {
    useUserMock.mockReturnValue({ organizationProfileVerified: true, user: { id: 8, rol: 'superadmin', name: 'Marcelo', nombre_empresa: 'MyB Store', tenant_slug: 'actor-home', tipo_chat: 'pyme', plan: 'free' } });
    useTenantMock.mockReturnValue({ currentSlug: 'selected-organization', tenant: { slug: 'selected-organization', tipo: 'municipio', publishedIdentity: { tenantId: 7, tenantSlug: 'selected-organization', name: 'Organización elegida' } } });
    render(<MemoryRouter initialEntries={['/admin/knowledge?tenant_slug=selected-organization']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByText('Organización elegida')).toBeVisible();
    expect(screen.getByText('Municipio')).toBeVisible();
    expect(screen.queryByText('MyB Store')).not.toBeInTheDocument();
    expect(screen.queryByText('Plan Inicial')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perfil y organización' })).toHaveAttribute('href', '/perfil?tab=perfil&tenant_slug=selected-organization');
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/perfil?tab=pedidos&tenant_slug=selected-organization');
    expect(screen.getByRole('link', { name: 'Ver sitio publico' })).toHaveAttribute('href', '/t/selected-organization');
  });
  it.each(['pending','foreign','unverified','missing'])('uses a neutral selected organization label while identity is %s', state => {
    useUserMock.mockReturnValue({ organizationProfileVerified: state !== 'unverified', user: { rol: 'superadmin', name: 'Marcelo', nombre_empresa: 'MyB Store' } });
    useTenantMock.mockReturnValue({ currentSlug: 'selected-organization', isLoadingTenant: state === 'pending', tenant: { slug: 'selected-organization', tipo: 'pyme', publishedIdentity: state === 'missing' ? null : { tenantId: 7, tenantSlug: state === 'foreign' ? 'other-organization' : 'selected-organization', name: 'Untrusted organization label' } } });
    render(<MemoryRouter initialEntries={['/admin/knowledge?tenant_slug=selected-organization']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByText('Organización seleccionada')).toBeVisible();
    expect(screen.queryByText('MyB Store')).not.toBeInTheDocument();
    expect(screen.queryByText('Untrusted organization label')).not.toBeInTheDocument();
    expect(screen.queryByText('Empresa')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/perfil?tab=pedidos');
  });

  it('opens municipal claims from the tenant profile tab instead of the protected root route on mobile', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('opens knowledge from the normal account menu for a verified scoped delegate without inheriting a public tenant', () => {
    useUserMock.mockReturnValue({ organizationProfileVerified: true, user: { id: 8, rol: 'empleado', tenant_slug: 'authorized-organization' } });
    useTenantMock.mockReturnValue({ currentSlug: 'previous-public-space' });
    useCapabilitiesMock.mockReturnValue({ capabilities: ['knowledge.read'], hasAnyCapability: (required: string[]) => required.includes('knowledge.read') });
    render(<MemoryRouter initialEntries={['/perfil']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByRole('link', { name: 'Fuentes de conocimiento' })).toHaveAttribute('href', '/admin/knowledge');
  });

  it.each([{ verified: false, grant: true }, { verified: true, grant: false }])('hides knowledge when the backend profile or grant is unavailable: %j', ({ verified, grant }) => {
    useUserMock.mockReturnValue({ organizationProfileVerified: verified, user: { id: 8, rol: 'tenant_admin', tenant_slug: 'authorized-organization' } });
    useCapabilitiesMock.mockReturnValue({ capabilities: grant ? ['knowledge.read'] : [], hasAnyCapability: () => grant });
    render(<MemoryRouter initialEntries={['/perfil']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.queryByRole('link', { name: 'Fuentes de conocimiento' })).not.toBeInTheDocument();
  });

  it('preserves an explicit SuperAdmin organization in the knowledge shortcut', () => {
    useUserMock.mockReturnValue({ organizationProfileVerified: true, user: { id: 8, rol: 'super_admin', tenant_slug: 'platform-account-home' } });
    useCapabilitiesMock.mockReturnValue({ capabilities: ['knowledge.read'], hasAnyCapability: (required: string[]) => required.includes('knowledge.read') });
    render(<MemoryRouter initialEntries={['/perfil?tenant_slug=selected-organization']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByRole('link', { name: 'Fuentes de conocimiento' })).toHaveAttribute('href', '/admin/knowledge?tenant_slug=selected-organization');
  });

  it('groups organization, plan, configuration and session inside the account menu', () => {
    useUserMock.mockReturnValue({organizationProfileVerified:true,loading:false,user:{id:9,rol:'admin',tenant_slug:'junin',nombre_empresa:'Municipalidad de Junín',tipo_chat:'municipio',plan:'full'}});
    render(
      <MemoryRouter initialEntries={['/perfil?tab=tickets']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(within(screen.getByRole('navigation',{name:'Navegación principal móvil'})).getByText('Municipalidad de Junín')).toBeInTheDocument();
    expect(screen.getByText('Organización')).toBeInTheDocument();
    expect(screen.getByText('Plan y facturación')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Sesión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Plan Full/i })).toHaveAttribute(
      'href',
      '/perfil?tab=perfil&section=plan',
    );
    expect(screen.getByRole('link', { name: /Perfil y organización/i })).toHaveAttribute(
      'href',
      '/perfil?tab=perfil',
    );
  });

  it.each([
    { surface: 'desktop', slug: 'junin', actorId: 101, tenantId: 7 },
    { surface: 'mobile', slug: 'junin', actorId: 101, tenantId: 7 },
    { surface: 'desktop', slug: 'tierra-del-fuego', actorId: 449, tenantId: 46 },
    { surface: 'mobile', slug: 'tierra-del-fuego', actorId: 449, tenantId: 46 },
  ])('routes administrative orders into the verified workspace: $surface $slug', async ({ surface, slug, actorId, tenantId }) => {
    const user = canonicalOrganizationUser('municipio', slug);
    user.id = actorId;
    user.organization_profile.tenant.id = tenantId;
    user.organization_workspace.tenant.id = tenantId;
    const originalActor = JSON.stringify(user);
    useUserMock.mockReturnValue({ user, organizationProfileVerified: true, loading: false });
    useTenantMock.mockReturnValue({ currentSlug: 'previous-public-workspace' });
    const RouteProbe = () => {
      const route = useLocation();
      return <output data-testid="orders-route">{route.pathname + route.search}</output>;
    };
    render(<MemoryRouter initialEntries={['/perfil?tab=tickets&tenant_slug=foreign-workspace']}><Navbar /><RouteProbe /></MemoryRouter>);

    let ordersLink: HTMLElement;
    if (surface === 'desktop') {
      fireEvent.keyDown(screen.getByRole('button', { name: /Mi cuenta/i }), { key: 'Enter' });
      ordersLink = await screen.findByRole('menuitem', { name: 'Pedidos' });
    } else {
      fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
      ordersLink = screen.getByRole('link', { name: 'Pedidos' });
    }
    const destination = `/perfil?tab=pedidos&tenant_slug=${slug}`;
    expect(ordersLink).toHaveAttribute('href', destination);
    fireEvent.click(ordersLink);
    expect(screen.getByTestId('orders-route')).toHaveTextContent(destination);
    expect(screen.getByTestId('orders-route')).not.toHaveTextContent('foreign-workspace');
    expect(JSON.stringify(user)).toBe(originalActor);
  });

  it.each([
    { verified: false, loading: false, foreign: false },
    { verified: true, loading: true, foreign: false },
    { verified: true, loading: false, foreign: true },
  ])('does not borrow an orders tenant from unverified contracts or public context: %j', ({ verified, loading, foreign }) => {
    const user = canonicalOrganizationUser();
    if (foreign) user.organization_workspace.tenant.slug = 'foreign-workspace';
    useUserMock.mockReturnValue({ user, organizationProfileVerified: verified, loading });
    useTenantMock.mockReturnValue({ currentSlug: 'foreign-workspace' });
    render(<MemoryRouter initialEntries={['/perfil?tenant_slug=foreign-workspace']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/perfil?tab=pedidos');
  });

  it.each([
    { surface: 'desktop', ownSlug: 'junin', selected: false },
    { surface: 'mobile', ownSlug: 'junin', selected: false },
    { surface: 'desktop', ownSlug: 'tierra-del-fuego', selected: false },
    { surface: 'mobile', ownSlug: 'tierra-del-fuego', selected: false },
    { surface: 'desktop', ownSlug: 'tierra-del-fuego', selected: true },
    { surface: 'mobile', ownSlug: 'tierra-del-fuego', selected: true },
  ])('preserves the verified survey workspace: $surface $ownSlug selected=$selected', async ({ surface, ownSlug, selected }) => {
    const user = canonicalOrganizationUser('municipio', ownSlug);
    if (selected) user.rol = 'superadmin';
    const originalActor = JSON.stringify(user);
    const destinationSlug = selected ? 'junin' : ownSlug;
    useUserMock.mockReturnValue({ user, organizationProfileVerified: true, loading: false });
    useTenantMock.mockReturnValue(selected ? {
      currentSlug: 'junin', isLoadingTenant: false,
      tenant: { slug: 'junin', tipo: 'municipio', publishedIdentity: { tenantId: 22, tenantSlug: 'junin', name: 'Selected institution' } },
    } : { currentSlug: 'previous-public-workspace' });
    const RouteProbe = () => {
      const route = useLocation();
      return <output data-testid="survey-route">{route.pathname + route.search}</output>;
    };
    render(<MemoryRouter initialEntries={[selected ? '/perfil?tenant_slug=junin' : '/perfil?tenant_slug=foreign-workspace']}><Navbar /><RouteProbe /></MemoryRouter>);
    let surveyLink: HTMLElement;
    if (surface === 'desktop') {
      fireEvent.keyDown(screen.getByRole('button', { name: /Mi cuenta/i }), { key: 'Enter' });
      surveyLink = await screen.findByRole('menuitem', { name: 'Panel de encuestas' });
    } else {
      fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
      surveyLink = screen.getByRole('link', { name: 'Panel de encuestas' });
    }
    const destination = `/admin/encuestas?tenant_slug=${destinationSlug}`;
    expect(surveyLink).toHaveAttribute('href', destination);
    fireEvent.click(surveyLink);
    expect(screen.getByTestId('survey-route')).toHaveTextContent(destination);
    expect(JSON.stringify(user)).toBe(originalActor);
  });

  it.each(['unverified', 'loading', 'foreign_contract', 'selected_pending', 'selected_foreign', 'signed_out'])('does not expose an unverified survey destination: %s', state => {
    const user = canonicalOrganizationUser('municipio', 'tierra-del-fuego');
    const selected = state.startsWith('selected_');
    if (selected) user.rol = 'superadmin';
    if (state === 'foreign_contract') user.organization_workspace.tenant.slug = 'foreign-workspace';
    useUserMock.mockReturnValue({ user, organizationProfileVerified: state !== 'unverified', loading: state === 'loading' });
    if (state === 'signed_out') useSessionAuthorityMock.mockReturnValue({ hasVerifiedSession: false });
    useTenantMock.mockReturnValue({
      currentSlug: 'junin', isLoadingTenant: state === 'selected_pending',
      tenant: { slug: 'junin', tipo: 'municipio', publishedIdentity: { tenantId: 22, tenantSlug: state === 'selected_foreign' ? 'foreign-workspace' : 'junin', name: 'Untrusted identity' } },
    });
    render(<MemoryRouter initialEntries={['/perfil?tenant_slug=junin']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.queryByRole('link', { name: 'Panel de encuestas' })).not.toBeInTheDocument();
  });

  it('does not expose orders from a stale signed-out administrative account', () => {
    useUserMock.mockReturnValue({ user: canonicalOrganizationUser(), organizationProfileVerified: true, loading: false });
    useSessionAuthorityMock.mockReturnValue({ hasVerifiedSession: false });
    render(<MemoryRouter initialEntries={['/perfil']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.queryByRole('link', { name: 'Pedidos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mi cuenta/i })).not.toBeInTheDocument();
  });

  it('keeps administrative orders gated by the existing capability policy for delegates', () => {
    const user = canonicalOrganizationUser('municipio', 'civic-workspace', false);
    user.rol = 'employee';
    useUserMock.mockReturnValue({ user, organizationProfileVerified: true, loading: false });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['tickets.read'],
      hasAnyCapability: (required: string[]) => required.includes('tickets.read'),
    });
    render(<MemoryRouter initialEntries={['/perfil']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByRole('link', { name: 'Reclamos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pedidos' })).not.toBeInTheDocument();
  });

  it('routes backoffice live chat into the operational ticket desk on mobile', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Chat$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets&focus=live_chat',
    );
  });

  it('keeps the public chat shortcut for end users', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'chat_user',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Chat$/i })).toHaveAttribute('href', '/chat');
  });

  it('keeps the municipal claims shortcut for tenant admins even while backend capabilities are partial', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'admin_municipio',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('keeps the claims shortcut when the backend role uses a municipal admin alias', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'municipal_admin',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: ['analytics.read'],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('keeps the generic tickets label for non-municipal tenants', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'admin',
        tipo_chat: 'pyme',
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getByRole('link', { name: /^Tickets$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('keeps the account menu available for a Clerk session transported only by cookie', () => {
    useUserMock.mockReturnValue({ user: null });
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_cookie_navbar');
    window.localStorage.setItem(
      'user',
      JSON.stringify({ rol: 'admin', tipo_chat: 'municipio', name: 'Operador Junin' }),
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));
    expect(screen.getByRole('link', { name: /^Reclamos$/i })).toHaveAttribute(
      'href',
      '/perfil?tab=tickets',
    );
  });

  it('does not expose an account badge or admin links from stale user data without a verified session', () => {
    window.localStorage.setItem('authProvider', 'clerk');
    window.localStorage.setItem('clerkUserId', 'user_stale_navbar');
    window.localStorage.setItem(
      'user',
      JSON.stringify({ rol: 'admin', tipo_chat: 'municipio', name: 'Operador stale' }),
    );
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'loading',
      hasBearerSession: true,
      hasVerifiedSession: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Mi cuenta')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Reclamos$/i })).not.toBeInTheDocument();
  });

  it('does not expose claims to backoffice profiles without ticket role or capability', () => {
    useUserMock.mockReturnValue({
      user: {
        rol: 'analytics_viewer',
        tipo_chat: 'municipio',
      },
    });
    useCapabilitiesMock.mockReturnValue({
      capabilities: [],
      hasAnyCapability: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir men/i }));

    expect(screen.queryByRole('link', { name: /^Reclamos$/i })).not.toBeInTheDocument();
  });

  it('keeps the public landing navigation concise and the demo CTA stable', () => {
    useUserMock.mockReturnValue({ user: null });
    useSessionAuthorityMock.mockReturnValue({
      clerkStatus: 'disabled',
      hasBearerSession: false,
      hasVerifiedSession: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(navigation).toHaveTextContent('Plataforma');
    expect(navigation).toHaveTextContent('Soluciones');
    expect(navigation).toHaveTextContent('Casos');
    expect(navigation).toHaveTextContent('Planes');
    expect(navigation.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Ver demo' })).toHaveAttribute('href', '/demo');
    expect(screen.queryByRole('link', { name: 'Ver carrito' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir al inicio de Chatboc' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Ir al inicio de Chatboc' })).toHaveAttribute(
      'title',
      'Chatboc.ar · Inicio',
    );
  });

  it('exposes a keyboard-safe mobile navigation disclosure and coordinates the accessibility dock', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole('button', { name: /abrir men/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'chatboc-mobile-navigation');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', { name: 'Navegación principal móvil' }),
    ).toHaveAttribute('id', 'chatboc-mobile-navigation');
    expect(screen.getAllByRole('button', { name: 'Activar modo oscuro' })).toHaveLength(2);
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Navegación principal móvil' })).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');

    fireEvent.click(menuButton);
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');
    unmount();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
  });

  it('resets the mobile overlay and moves focus to a visible control at the desktop breakpoint', () => {
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      get matches() {
        return matches;
      },
      media: '(min-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    );

    const menuButton = screen.getByRole('button', { name: /abrir men/i });
    fireEvent.click(menuButton);
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');

    act(() => {
      matches = true;
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    expect(screen.queryByRole('navigation', { name: 'Navegación principal móvil' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
    expect(screen.getByRole('button', { name: 'Ir al inicio de Chatboc' })).toHaveFocus();

    act(() => {
      matches = false;
      listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
    expect(mediaQuery.removeEventListener).toHaveBeenCalled();
  });

  it.each([
    {kind: 'municipio', label: 'Gobierno'},
    {kind: 'empresa', label: 'Empresa'},
    {kind: 'colegio', label: 'Educación'},
  ])('presents the verified institution independently of actor fields and role: $kind', ({kind, label}) => {
    const user = canonicalOrganizationUser(kind);
    useUserMock.mockReturnValue({user, organizationProfileVerified: true, loading: false});
    useTenantMock.mockReturnValue({currentSlug: 'previous-public-workspace'});
    render(<MemoryRouter initialEntries={['/perfil']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: /abrir men/i}));
    const nav = within(screen.getByRole('navigation', {name: 'Navegación principal móvil'}));
    expect(nav.getByText('Verified institution')).toBeInTheDocument();
    expect(nav.getByText(label)).toBeInTheDocument();
    expect(nav.getByRole('link', {name: 'Perfil y organización'})).toHaveAttribute(
      'href', '/perfil?tab=perfil&tenant_slug=civic-workspace&section=general');
    expect(user.name).toBe('Personal operator');
    expect(user.tipo_chat).toBe('pyme');
    expect(user.rol).toBe('admin_municipio');
    expect(user.capabilities).toEqual(['tickets.read', 'orders.read']);
  });

  it.each([
    {verified: false, loading: false, wrongTenant: false},
    {verified: true, loading: true, wrongTenant: false},
    {verified: true, loading: false, wrongTenant: true},
  ])('withholds cached or contradictory institutional identity: %j', ({verified, loading, wrongTenant}) => {
    const user = canonicalOrganizationUser();
    if (wrongTenant) user.organization_workspace.tenant.id = 404;
    useUserMock.mockReturnValue({user, organizationProfileVerified: verified, loading});
    render(<MemoryRouter initialEntries={['/perfil']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: /abrir men/i}));
    const nav = within(screen.getByRole('navigation', {name: 'Navegación principal móvil'}));
    expect(nav.queryByText('Verified institution')).not.toBeInTheDocument();
    expect(nav.queryByText('Gobierno')).not.toBeInTheDocument();
    expect(nav.getByRole('link', {name: 'Perfil y organización'})).toHaveAttribute('href', '/perfil?tab=perfil');
  });

  it.each([true, false])('uses canonical or neutral identity outside supported private branding routes, verified=%s', verified => {
    const user = {...canonicalOrganizationUser(), nombre_empresa: 'Legacy actor company'};
    useUserMock.mockReturnValue({user, organizationProfileVerified: verified, loading: false});
    render(<MemoryRouter initialEntries={['/settings']}><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name: /abrir men/i}));
    const nav = within(screen.getByRole('navigation', {name: 'Navegación principal móvil'}));
    expect(nav.queryByText('Legacy actor company')).not.toBeInTheDocument();
    if (verified) {
      expect(nav.getByText('Verified institution')).toBeInTheDocument();
      expect(nav.getByText('Gobierno')).toBeInTheDocument();
    } else {
      expect(nav.queryByText('Verified institution')).not.toBeInTheDocument();
      expect(nav.queryByText('Gobierno')).not.toBeInTheDocument();
    }
  });

});

describe('verified institutional entry branding',()=>{
  const tenant=()=>({slug:'org-a',nombre:'Organización de prueba',publishedIdentity:{tenantId:7,tenantSlug:'org-a',name:'Organización de prueba',logoUrl:'/qa-logo.svg'}});
  beforeEach(()=>{vi.clearAllMocks();window.localStorage.clear();useUserMock.mockReturnValue({user:null});useSessionAuthorityMock.mockReturnValue({hasVerifiedSession:false});useCapabilitiesMock.mockReturnValue({capabilities:[],hasAnyCapability:()=>false});useTenantMock.mockReturnValue({currentSlug:'org-a',tenant:tenant(),isLoadingTenant:false,tenantError:null});});
  it('uses the verified name and public home on the institutional login',()=>{
    render(<MemoryRouter initialEntries={['/t/org-a/login']}><Navbar/></MemoryRouter>);
    expect(screen.getByTestId('institutional-access-brand')).toHaveAttribute('href','/t/org-a');
    expect(screen.getByRole('link',{name:'Organización de prueba'})).toBeVisible();
    expect(screen.queryByRole('button',{name:'Ir al inicio de Chatboc'})).not.toBeInTheDocument();
  });
  it.each(['/login','/','/superadmin','/perfil'])('keeps the platform brand on %s despite ambient tenant data',path=>{
    render(<MemoryRouter initialEntries={[path]}><Navbar/></MemoryRouter>);
    expect(screen.queryByTestId('institutional-access-brand')).not.toBeInTheDocument();
    expect(screen.getByText('Chatboc.ar')).toBeVisible();
  });
  it('does not show a name that only came from a normalized request',()=>{
    useTenantMock.mockReturnValue({currentSlug:'org-a',tenant:{slug:'org-a',nombre:'Not verified'}});
    render(<MemoryRouter initialEntries={['/t/org-a/login']}><Navbar/></MemoryRouter>);
    expect(screen.queryByText('Not verified')).not.toBeInTheDocument();expect(screen.queryByTestId('institutional-access-brand')).not.toBeInTheDocument();
  });
  it.each([{isLoadingTenant:true},{tenantError:'unavailable'},{currentSlug:'org-b'}])('does not retain a stale identity %s',overrides=>{
    useTenantMock.mockReturnValue({currentSlug:'org-a',tenant:tenant(),isLoadingTenant:false,...overrides});
    render(<MemoryRouter initialEntries={['/t/org-a/login']}><Navbar/></MemoryRouter>);
    expect(screen.queryByTestId('institutional-access-brand')).not.toBeInTheDocument();
  });
});
