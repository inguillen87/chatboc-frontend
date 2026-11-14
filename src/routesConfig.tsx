
import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

// ... (importaciones existentes) ...
import { EDUCATION_FEATURE_FLAGS, FEATURE_ENCUESTAS } from '@/config/featureFlags';
import Index from '@/pages/Index';
import { TenantHostHomeRoute } from '@/components/tenant/TenantHostHomeRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import UserLogin from '@/pages/UserLogin';
import UserRegister from '@/pages/UserRegister';
const ClerkSsoCallbackPage = React.lazy(() => import('@/pages/ClerkSsoCallbackPage'));
const Demo = React.lazy(() => import('@/pages/Demo'));
const DisabilityAIAgentDemoPage = React.lazy(
  () => import('@/pages/public/DisabilityAIAgentDemoPage'),
);
const DemoCatalogDownloadPage = React.lazy(() => import('@/pages/DemoCatalogDownloadPage'));
const Perfil = React.lazy(() => import('@/components/access/ProfileEntry'));
const UserAccount = React.lazy(() => import('@/pages/UserAccount'));
const ChatPage = React.lazy(() => import('@/pages/ChatPage'));
const Checkout = React.lazy(() => import('@/pages/Checkout'));
const ChatPosPage = React.lazy(() => import('@/pages/ChatPosPage'));
const ChatCRMPage = React.lazy(() => import('@/pages/ChatCRMPage'));
const Integracion = React.lazy(() => import('@/pages/Integracion'));
const MetaCredentials = React.lazy(() => import('@/pages/MetaCredentials'));
const WhatsappEmbeddedSignupPage = React.lazy(() => import('@/pages/WhatsappEmbeddedSignupPage'));
const Documentacion = React.lazy(() => import('@/pages/Documentacion'));
const Faqs = React.lazy(() => import('@/pages/Faqs'));
const Privacy = React.lazy(() => import('@/pages/legal/Privacy'));
const Terms = React.lazy(() => import('@/pages/legal/Terms'));
const Cookies = React.lazy(() => import('@/pages/legal/Cookies'));
const DataDeletion = React.lazy(() => import('@/pages/legal/DataDeletion'));
const TicketsPanel = React.lazy(() => import('@/pages/TicketsPanel'));
const PedidosPage = React.lazy(() => import('@/pages/pyme/pedidos/PedidosPage'));
const IntegracionesPage = React.lazy(() => import('@/pages/pyme/integraciones/IntegracionesPage'));
const UsuariosPage = React.lazy(() => import('@/pages/UsuariosPage'));
import { buildTenantPath, TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/utils/tenantPaths';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getReservedPublicSlugRedirect } from '@/utils/publicRoutes';
import { TICKET_READ_CAPABILITIES } from '@/utils/moduleCapabilities';
import { DISABILITY_AI_AGENT_DEMO_PATH } from '@/config/publicPresentationRoutes';
const ProductCatalog = React.lazy(() => import('@/pages/ProductCatalog'));
const MunicipalMessageMetrics = React.lazy(() => import('@/pages/MunicipalMessageMetrics'));
const NotificationSettings = React.lazy(() => import('@/pages/NotificationSettings'));
const TramitesCatalog = React.lazy(() => import('@/pages/TramitesCatalog'));
const InternalUsers = React.lazy(() => import('@/pages/InternalUsers'));
const WhatsappIntegration = React.lazy(() => import('@/pages/WhatsappIntegration'));
const MunicipalSystems = React.lazy(() => import('@/pages/MunicipalSystems'));
const MunicipalPlaybookPage = React.lazy(() => import('@/pages/MunicipalPlaybook'));
const SatisfactionSurveys = React.lazy(() => import('@/pages/SatisfactionSurveys'));
const TicketLookup = React.lazy(() => import('@/pages/TicketLookup'));
const CustomerHistory = React.lazy(() => import('@/pages/CustomerHistory'));
const BudgetRequest = React.lazy(() => import('@/pages/BudgetRequest'));
const Reminders = React.lazy(() => import('@/pages/Reminders'));
const BusinessMetrics = React.lazy(() => import('@/pages/BusinessMetrics'));
const CrmIntegrations = React.lazy(() => import('@/pages/CrmIntegrations'));
const PredefinedQueries = React.lazy(() => import('@/pages/PredefinedQueries'));
const PermissionDenied = React.lazy(() => import('@/pages/PermissionDenied'));
const LogWorkbench = React.lazy(() => import('@/pages/LogWorkbench'));
const CartPage = React.lazy(() => import('@/pages/Cart'));
const ProductCheckoutPage = React.lazy(() => import('@/pages/ProductCheckoutPage'));
const OrderConfirmationPage = React.lazy(() => import('@/pages/OrderConfirmation'));
const GestionPlantillasPage = React.lazy(() => import('@/pages/GestionPlantillasPage'));
const CatalogMappingPage = React.lazy(() => import('@/pages/admin/CatalogMappingPage'));
const CategoryManagementPage = React.lazy(() => import('@/pages/admin/CategoryManagementPage'));
const CatalogManagementPage = React.lazy(() => import('@/pages/admin/CatalogManagementPage'));
const OpinarArPage = React.lazy(() => import('@/pages/OpinarArPage'));
const EstadisticasPage = React.lazy(() => import('@/pages/EstadisticasPage'));
const AnalyticsPage = React.lazy(() => import('@/pages/analytics/AnalyticsPage'));
const BotSettingsEnterprise = React.lazy(() => import('@/pages/BotSettingsEnterprise'));

const Iframe = React.lazy(() => import('@/pages/IframePage'));
const MarketCartPage = React.lazy(() => import('@/pages/market/MarketCartPage'));
const MarketplaceBlueprintPage = React.lazy(() => import('@/pages/market/MarketplaceBlueprintPage'));
const PublicSurveysIndex = React.lazy(() => import('@/pages/encuestas'));
const PublicSurveyPage = React.lazy(() => import('@/pages/e/[slug]'));
const RehearsalPage = React.lazy(() => import('@/pages/encuestas/RehearsalPage'));
const SurveyQrPage = React.lazy(() => import('@/pages/encuestas/QrPage'));
const AdminSurveysIndex = React.lazy(() => import('@/pages/admin/encuestas/index'));
const NewSurveyPage = React.lazy(() => import('@/pages/admin/encuestas/new'));
const SurveyDetailPage = React.lazy(() => import('@/pages/admin/encuestas/[id]'));
const SurveyAnalyticsPage = React.lazy(() => import('@/pages/admin/encuestas/[id]/analytics'));
const TenantHomePage = React.lazy(() => import('@/pages/tenant/TenantHomePage'));
const PublicCatalogPage = React.lazy(() => import('@/pages/PublicCatalogPage'));
const TenantNewsPage = React.lazy(() => import('@/pages/tenant/TenantNewsPage'));
const TenantEventsPage = React.lazy(() => import('@/pages/tenant/TenantEventsPage'));
const TenantSurveyListPage = React.lazy(() => import('@/pages/tenant/TenantSurveyListPage'));
const TenantSurveyDetailPage = React.lazy(() => import('@/pages/tenant/TenantSurveyDetailPage'));
const TenantTicketFormPage = React.lazy(() => import('@/pages/tenant/TenantTicketFormPage'));
const MarketCatalogPage = React.lazy(() => import('@/pages/tenant/market/MarketCatalogPage'));
const MarketProductPage = React.lazy(() => import('@/pages/tenant/market/MarketProductPage'));
const MarketCheckoutPage = React.lazy(() => import('@/pages/tenant/market/MarketCheckoutPage'));
const CreateTenantPage = React.lazy(() => import('@/pages/admin/CreateTenantPage'));
const SuperAdminDashboard = React.lazy(() => import('@/pages/admin/SuperAdminDashboard'));
const DemoLandingPage = React.lazy(() => import('@/pages/DemoLandingPage'));
const SmartPedidosWrapper = React.lazy(() => import('@/pages/SmartPedidosWrapper'));
const SmartNotificationsWrapper = React.lazy(() => import('@/pages/SmartNotificationsWrapper'));
const OrderTrackingPage = React.lazy(() => import('@/pages/pyme/pedidos/OrderTrackingPage'));
const TrackingExperiencePage = React.lazy(() => import('@/pages/tracking/TrackingExperiencePage'));
const FinanceWebviewPage = React.lazy(() => import('@/pages/finance/FinanceWebviewPage'));
const AdminOrderDetailPage = React.lazy(() => import('@/pages/admin/AdminOrderDetailPage'));
const ClientsPage = React.lazy(() => import('@/pages/pyme/crm/ClientsPage'));
const ClientDetailPage = React.lazy(() => import('@/pages/pyme/crm/ClientDetailPage'));
const EnterpriseOpsPage = React.lazy(() => import('@/pages/EnterpriseOpsPage'));
const KnowledgeSourcesPage = React.lazy(() => import('@/pages/admin/knowledge/KnowledgeSourcesPage').then(module => ({ default: module.KnowledgeSourcesPage })));
const TenantImplementationCenterPage = React.lazy(
  () => import('@/pages/TenantImplementationCenterPage'),
);
const EducationPublicPage = React.lazy(() => import('@/pages/education/EducationPublicPage'));
const EducationFamilyHomePage = React.lazy(() => import('@/pages/education/EducationFamilyHomePage'));
const EducationStaffInboxPage = React.lazy(() => import('@/pages/education/EducationStaffInboxPage'));
const EducationAttendancePage = React.lazy(() => import('@/pages/education/EducationAttendancePage'));
const EducationDocumentsPage = React.lazy(() => import('@/pages/education/EducationDocumentsPage'));
const EducationAdmissionsPage = React.lazy(() => import('@/pages/education/EducationAdmissionsPage'));
const EducationBillingPage = React.lazy(() => import('@/pages/education/EducationBillingPage'));
const EducationFamilyVerificationPage = React.lazy(() => import('@/pages/education/EducationFamilyVerificationPage'));
const TicketsBoardPage = React.lazy(() => import('@/features/tickets/TicketsBoardPage'));
const SurveyBuilderPage = React.lazy(() => import('@/features/surveys/SurveyBuilderPage'));
const AnalyticsHubPage = React.lazy(() => import('@/features/analytics/AnalyticsHubPage'));
const OperationsDashboardPage = React.lazy(() => import('@/features/analytics/OperationsDashboardPage'));

// Updated for Commerce Module & Mirror Catalog
// Final verification: Commerce & Admin modules active
// NUEVAS IMPORTACIONES PARA EL PORTAL DE USUARIO
// UserPortalLayout no se importa aquí si se usa como Layout Route en App.tsx
const UserDashboardPage = React.lazy(() => import('@/pages/user-portal/UserDashboardPage'));
const UserCatalogPage = React.lazy(() => import('@/pages/user-portal/UserCatalogPage'));
const UserOrdersPage = React.lazy(() => import('@/pages/user-portal/UserOrdersPage'));
const UserClaimsPage = React.lazy(() => import('@/pages/user-portal/UserClaimsPage'));
const UserNewsPage = React.lazy(() => import('@/pages/user-portal/UserNewsPage'));
const UserEventsPage = React.lazy(() => import('@/pages/user-portal/UserEventsPage'));
const UserBenefitsPage = React.lazy(() => import('@/pages/user-portal/UserBenefitsPage'));
const UserSurveysPage = React.lazy(() => import('@/pages/user-portal/UserSurveysPage'));
const UserAccountPage = React.lazy(() => import('@/pages/user-portal/UserAccountPage'));

export interface RouteConfig {
  path: string;
  tenantHost?: 'public' | 'private';
  tenantHostParam?: 'tenant' | 'tenantSlug' | 'slug';
  element: React.ReactElement;
  requiresSession?: boolean; // Bloquea el bootstrap privado antes de montar providers remotos
  roles?: string[]; // Roles para admin/empleado de Chatboc
  requiredCapabilities?: string[]; // Capacidades dinámicas provistas por backend
  requiredAllCapabilities?: string[]; // Capacidades obligatorias para integraciones/configuración sensible
  enforceCapabilities?: boolean; // Exige permisos de /api/me verificado sin atajos por rol
  userPortal?: boolean; // Flag para rutas del portal de usuario final (cliente/vecino)
  allowGuest?: boolean; // Permite acceder sin sesión (modo demo)
}

const LegacyTenantAliasRedirect = ({ suffix = '' }: { suffix?: string }) => {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant.trim() : '';
  const publicRedirect = getReservedPublicSlugRedirect(tenant);
  if (publicRedirect) {
    return <Navigate to={publicRedirect} replace />;
  }
  if (!tenant || TENANT_PLACEHOLDER_SLUGS.has(tenant.toLowerCase())) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/t/${encodeURIComponent(tenant)}${suffix}`} replace />;
};

const TicketDeskRedirect = () => <Navigate to="/perfil?tab=tickets" replace />;

const TenantTicketWorkspaceRoute = () => {
  const params = useParams();
  const tenantSlug = typeof params.tenant === 'string' ? params.tenant.trim() : '';

  return <TicketsPanel tenantSlugOverride={tenantSlug || null} embedded />;
};

const TenantHomeRoute = () => {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant.trim() : '';
  const publicRedirect = getReservedPublicSlugRedirect(tenant);
  if (publicRedirect) {
    return <Navigate to={publicRedirect} replace />;
  }
  return <TenantHomePage />;
};

const PortalTenantEntryRedirect = () => {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant.trim() : '';
  const publicRedirect = getReservedPublicSlugRedirect(tenant);
  if (publicRedirect || !tenant || TENANT_PLACEHOLDER_SLUGS.has(tenant.toLowerCase())) {
    return <Navigate to="/portal/dashboard" replace />;
  }
  return <Navigate to={buildTenantPath('/portal/dashboard', tenant)} replace />;
};

const TwilioTicketTemplateRedirect = () => {
  const params = useParams();
  const location = useLocation();
  const ticketId = typeof params.ticketId === 'string' ? params.ticketId.trim() : '';
  const suffix = `${encodeURIComponent(ticketId)}${location.search || ''}${location.hash || ''}`;
  return <Navigate to={`/tracking/claim/${suffix}`} replace />;
};

const LegacyDoubleChatTicketRedirect = () => {
  const params = useParams();
  const location = useLocation();
  const ticketId = typeof params.ticketId === 'string' ? params.ticketId.trim() : '';
  const suffix = `${encodeURIComponent(ticketId)}${location.search || ''}${location.hash || ''}`;
  return <Navigate to={`/tracking/claim/${suffix}`} replace />;
};

const LegacyPublicTenantSlugRedirect = ({ suffix }: { suffix: string }) => {
  const params = useParams();
  const location = useLocation();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  if (!slug || TENANT_PLACEHOLDER_SLUGS.has(slug.toLowerCase())) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/t/${encodeURIComponent(slug)}${suffix}${location.search || ''}`} replace />;
};

const resolvePreferredTenantForEducation = (): string | null => {
  try {
    const storedSlug = safeLocalStorage.getItem('tenantSlug');
    if (storedSlug?.trim()) return storedSlug.trim();

    const rawUser = safeLocalStorage.getItem('user');
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser);
    const candidate = parsed?.tenant_slug || parsed?.tenantSlug || parsed?.tenant;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  } catch {
    return null;
  }
};

const EducationStaffLegacyRedirect = () => {
  const preferredTenant = resolvePreferredTenantForEducation();
  if (!preferredTenant) return <Navigate to="/educacion" replace />;
  return <Navigate to={`/t/${encodeURIComponent(preferredTenant)}/educacion/staff/inbox`} replace />;
};

const withTenantPrefixes = (
  pathSuffix: string,
  config: Omit<RouteConfig, 'path'>,
): RouteConfig[] =>
  TENANT_ROUTE_PREFIXES.filter((prefix) => prefix === 't').map((prefix) => ({
    ...config,
    tenantHost: config.tenantHost,
    tenantHostParam: config.tenantHostParam ?? (pathSuffix.startsWith('/:tenant') ? 'tenant' : undefined),
    path: `/${prefix}${pathSuffix}`,
  }));

const withTenantPrefixesExcept = (
  pathSuffix: string,
  config: Omit<RouteConfig, 'path'>,
  exclude: readonly (typeof TENANT_ROUTE_PREFIXES)[number][] = [],
): RouteConfig[] => {
  const exclusionSet = new Set(exclude.map((value) => value.toLowerCase()));

  return TENANT_ROUTE_PREFIXES.filter((prefix) => !exclusionSet.has(prefix.toLowerCase())).map((prefix) => ({
    ...config,
    tenantHost: config.tenantHost,
    tenantHostParam: config.tenantHostParam ?? (pathSuffix.startsWith('/:tenant') ? 'tenant' : undefined),
    path: `/${prefix}${pathSuffix}`,
  }));
};

const userPortalRoutes: RouteConfig[] = [
  {
    path: '/portal/dashboard', tenantHost: 'public',
    element: <UserDashboardPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/catalogo', tenantHost: 'public',
    element: <UserCatalogPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/pedidos', tenantHost: 'public',
    element: <UserOrdersPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/reclamos', tenantHost: 'public',
    element: <UserClaimsPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/noticias', tenantHost: 'public',
    element: <UserNewsPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/eventos', tenantHost: 'public',
    element: <UserEventsPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/beneficios', tenantHost: 'public',
    element: <UserBenefitsPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/encuestas', tenantHost: 'public',
    element: <UserSurveysPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/cuenta', tenantHost: 'public',
    element: <UserAccountPage />,
    userPortal: true,
    allowGuest: true,
  },
];

const publicLegacyRoutes: RouteConfig[] = [
  {
    path: '/noticias/eventos', tenantHost: 'public',
    element: <TenantEventsPage />,
    allowGuest: true,
  },
  {
    path: '/noticias/encuestas', tenantHost: 'public',
    element: <PublicSurveysIndex />,
    allowGuest: true,
  },
  {
    path: '/municipio/reclamos/nuevo', tenantHost: 'public',
    element: <TenantTicketFormPage />,
    allowGuest: true,
  },
];

// Generar rutas con prefijo de tenant para el portal
// Esto permite /:tenant/portal/dashboard, etc.
const tenantPortalRoutes: RouteConfig[] = userPortalRoutes.map(route => ({
  ...route,
  path: `/:tenant${route.path}`,
}));

const canonicalTenantPortalRoutes: RouteConfig[] = userPortalRoutes.flatMap((route) =>
  withTenantPrefixes(`/:tenant${route.path}`, {
    element: route.element,
    userPortal: route.userPortal,
    allowGuest: route.allowGuest,
    tenantHost: route.tenantHost,
    tenantHostParam: route.tenantHostParam,
    roles: route.roles,
    requiredCapabilities: route.requiredCapabilities,
    requiredAllCapabilities: route.requiredAllCapabilities,
  }),
);


const routes: RouteConfig[] = [
  // --- SPECIFIC ROUTES FIRST (Priority) ---

  // Cart & Checkout (Tenant) - Must be before generic tenant home
  ...withTenantPrefixes('/:tenant/cart', { tenantHost: 'public', element: <MarketCartPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/productos', { tenantHost: 'public', element: <ProductCatalog /> }),
  ...withTenantPrefixes('/:tenant/checkout-productos', { tenantHost: 'public', element: <ProductCheckoutPage /> }),
  ...withTenantPrefixes('/:tenant/pedido/confirmado', { tenantHost: 'public', element: <OrderConfirmationPage /> }),

  // FIX: Short routes for direct access (e.g. /municipio/productos without slug)
  // This allows the router to match /municipio/productos specifically before /municipio/:tenant (where tenant="productos")
  ...withTenantPrefixes('/cart', { tenantHost: 'public', element: <CartPage /> }),
  ...withTenantPrefixes('/productos', { tenantHost: 'public', element: <ProductCatalog /> }),
  ...withTenantPrefixes('/checkout-productos', { tenantHost: 'public', element: <ProductCheckoutPage /> }),
  ...withTenantPrefixes('/encuestas', { tenantHost: 'public', element: <PublicSurveysIndex /> }),

  // Market specific
  ...withTenantPrefixes('/:tenant/market', { tenantHost: 'public', element: <MarketCatalogPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/product/:slug', { tenantHost: 'public', element: <MarketProductPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/checkout', { tenantHost: 'public', element: <MarketCheckoutPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/market/blueprint', { element: <MarketplaceBlueprintPage /> }),

  // Tenant Portal Sections
  ...withTenantPrefixes('/:tenant/noticias', { tenantHost: 'public', element: <TenantNewsPage /> }),
  ...withTenantPrefixes('/:tenant/eventos', { tenantHost: 'public', element: <TenantEventsPage /> }),
  ...withTenantPrefixes('/:tenant/reclamos/nuevo', { tenantHost: 'public', element: <TenantTicketFormPage /> }),

  // Explicit aliases to match user mental model
  ...withTenantPrefixes('/:tenant/reclamos', { tenantHost: 'private',
    element: <TenantTicketWorkspaceRoute />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/tickets/board', { tenantHost: 'private',
    element: <TicketsBoardPage />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/tickets', { tenantHost: 'private',
    element: <TenantTicketWorkspaceRoute />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/inbox', { tenantHost: 'private',
    element: <TenantTicketWorkspaceRoute />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/pedidos', { tenantHost: 'private', element: <SmartPedidosWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/pedidos/:id', { tenantHost: 'private', element: <AdminOrderDetailPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/notificaciones', { tenantHost: 'private', element: <SmartNotificationsWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/categorias', { tenantHost: 'private', element: <CategoryManagementPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }),

  // CRM
  ...withTenantPrefixes('/:tenant/crm/clientes', { tenantHost: 'private', element: <ClientsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/crm/clientes/:contactId', { tenantHost: 'private', element: <ClientDetailPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),

  // Surveys
  ...(FEATURE_ENCUESTAS
    ? [
        { path: '/encuestas', tenantHost: 'public', element: <PublicSurveysIndex /> },
        { path: '/encuestas/:slug/qr', tenantHost: 'public', element: <SurveyQrPage /> },
        { path: '/e/:slug', tenantHost: 'public', element: <PublicSurveyPage /> },
        { path: '/pruebas/encuestas/:tenantSlug/:runId', element: <RehearsalPage />, allowGuest: true },
        ...withTenantPrefixes('/:tenant/encuestas', { tenantHost: 'public', element: <TenantSurveyListPage /> }),
        ...withTenantPrefixes('/:tenant/encuestas/:slug', { tenantHost: 'public', element: <TenantSurveyDetailPage /> }),
      ] satisfies RouteConfig[]
    : []),

  // Auth (Tenant)
  ...withTenantPrefixes('/:tenant/login', { tenantHost: 'public', element: <Login /> }),
  ...withTenantPrefixes('/:tenant/register', { tenantHost: 'public', element: <UserRegister /> }),
  ...withTenantPrefixes('/:tenant/user/login', { tenantHost: 'public', element: <UserLogin /> }),
  ...withTenantPrefixes('/:tenant/user/register', { tenantHost: 'public', element: <UserRegister /> }),

  // Integrations & Admin (Tenant Scoped)
  ...withTenantPrefixes('/:tenant/integracion', { tenantHost: 'private',
    element: <IntegracionesPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/new', { tenantHost: 'private',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin', 'catalog_manager'],
    requiredAllCapabilities: ['market.catalog.write'],
  }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/:mappingId', { tenantHost: 'private',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin', 'catalog_manager'],
    requiredAllCapabilities: ['market.catalog.write'],
  }),
  ...withTenantPrefixes('/:tenant/admin/catalog', { tenantHost: 'private',
    element: <CatalogManagementPage />,
    roles: ['tenant_admin', 'superadmin', 'empleado'],
    requiredAllCapabilities: ['market.catalog.write'],
  }),


  // --- EDUCATION FOUNDATION ROUTES ---
  ...(EDUCATION_FEATURE_FLAGS.education_enabled
    ? [
        { path: '/educacion', tenantHost: 'public', element: <EducationPublicPage /> },
        ...(EDUCATION_FEATURE_FLAGS.family_portal_enabled
          ? [
              { path: '/educacion/familia', tenantHost: 'public', element: <EducationFamilyHomePage />, allowGuest: true },
              { path: '/educacion/familia/verificacion', tenantHost: 'public', element: <EducationFamilyVerificationPage />, allowGuest: true },
            ] satisfies RouteConfig[]
          : []),
        ...(EDUCATION_FEATURE_FLAGS.attendance_enabled
          ? [{ path: '/educacion/familia/asistencia', tenantHost: 'public', element: <EducationAttendancePage />, allowGuest: true }] satisfies RouteConfig[]
          : []),
        ...(EDUCATION_FEATURE_FLAGS.documents_enabled
          ? [{ path: '/educacion/familia/documentos', tenantHost: 'public', element: <EducationDocumentsPage />, allowGuest: true }] satisfies RouteConfig[]
          : []),
        { path: '/educacion/staff/inbox', tenantHost: 'private', element: <EducationStaffLegacyRedirect />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/t/:tenant/educacion/staff/inbox', tenantHost: 'private', tenantHostParam: 'tenant', element: <EducationStaffInboxPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        ...(EDUCATION_FEATURE_FLAGS.admissions_enabled
          ? [
              { path: '/educacion/staff/admisiones', tenantHost: 'private', element: <EducationAdmissionsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
              {
                path: '/t/:tenant/educacion/staff/admisiones', tenantHost: 'private', tenantHostParam: 'tenant',
                element: <EducationAdmissionsPage />,
                roles: ['tenant_admin', 'employee', 'superadmin'],
                requiredAllCapabilities: ['interviews.cases.read'],
              },
              {
                path: '/t/:tenant/educacion/staff/admisiones/:sessionId', tenantHost: 'private', tenantHostParam: 'tenant',
                element: <EducationAdmissionsPage />,
                roles: ['tenant_admin', 'employee', 'superadmin'],
                requiredAllCapabilities: ['interviews.sessions.conduct'],
              },
            ] satisfies RouteConfig[]
          : []),
        ...(EDUCATION_FEATURE_FLAGS.billing_enabled
          ? [{ path: '/educacion/staff/cobranzas', tenantHost: 'private', element: <EducationBillingPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }] satisfies RouteConfig[]
          : []),
      ] satisfies RouteConfig[]
    : []),

  // --- USER PORTAL ROUTES ---
  { path: '/portal/:tenant', tenantHost: 'public', tenantHostParam: 'tenant', element: <PortalTenantEntryRedirect />, userPortal: true, allowGuest: true },
  ...userPortalRoutes,
  ...canonicalTenantPortalRoutes,
  ...tenantPortalRoutes,
  ...publicLegacyRoutes,

  // --- GENERIC / FALLBACK ROUTES ---

  { path: '/', tenantHost: 'public', element: <TenantHostHomeRoute><Index /></TenantHostHomeRoute> },

  // Clean URL Support (Root Level Tenant Routes)
  // Placing these carefully to avoid conflicts, though React Router v6 is smart about specificity.
  { path: '/:tenant/productos', tenantHost: 'public', tenantHostParam: 'tenant', element: <LegacyTenantAliasRedirect suffix="/productos" /> },
  { path: '/:tenant/catalogo', tenantHost: 'public', tenantHostParam: 'tenant', element: <LegacyTenantAliasRedirect suffix="/productos" /> },
  { path: '/:tenant/cart', tenantHost: 'public', tenantHostParam: 'tenant', element: <LegacyTenantAliasRedirect suffix="/cart" /> },
  { path: '/:tenant/checkout-productos', tenantHost: 'public', tenantHostParam: 'tenant', element: <LegacyTenantAliasRedirect suffix="/checkout-productos" /> },
  { path: '/:tenant/pedido/confirmado', tenantHost: 'public', tenantHostParam: 'tenant', element: <LegacyTenantAliasRedirect suffix="/pedido/confirmado" /> },
  // Public Order Tracking
  { path: '/pyme/pedidos/:nro_pedido', tenantHost: 'public', element: <OrderTrackingPage /> },
  { path: '/tracking/claim', tenantHost: 'public', element: <TrackingExperiencePage kind="claim" /> },
  { path: '/tracking/claim/:code', tenantHost: 'public', element: <TrackingExperiencePage kind="claim" /> },
  { path: '/tracking/order', tenantHost: 'public', element: <TrackingExperiencePage kind="order" /> },
  { path: '/tracking/order/:code', tenantHost: 'public', element: <TrackingExperiencePage kind="order" /> },
  { path: '/t/chat/:ticketId', tenantHost: 'public', element: <TwilioTicketTemplateRedirect /> },
  { path: '/chat/chat/:ticketId', tenantHost: 'public', element: <LegacyDoubleChatTicketRedirect /> },
  { path: '/catalogo/:slug', tenantHost: 'public', tenantHostParam: 'slug', element: <LegacyPublicTenantSlugRedirect suffix="/market" />, allowGuest: true },
  { path: '/checkout/:slug', tenantHost: 'public', tenantHostParam: 'slug', element: <LegacyPublicTenantSlugRedirect suffix="/checkout" />, allowGuest: true },
  { path: '/finanzas/:tenantSlug/:flow/:operationCode', tenantHost: 'public', tenantHostParam: 'tenantSlug', element: <FinanceWebviewPage />, allowGuest: true },
  // Missing root integration route
  {
    path: '/:tenant/integracion', tenantHost: 'private', tenantHostParam: 'tenant',
    element: <LegacyTenantAliasRedirect suffix="/integracion" />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },

  // Generic Tenant Home (Dashboard/Landing) - Must be LAST among tenant routes to avoid swallowing others
  ...withTenantPrefixes('/:tenant', { tenantHost: 'public', element: <TenantHomeRoute /> }),
  { path: '/:tenant', tenantHost: 'public', tenantHostParam: 'tenant', element: <LegacyTenantAliasRedirect /> }, // Legacy root tenant alias -> canonical

  // Global Routes
  { path: '/admin', tenantHost: 'private', element: <Navigate to="/perfil" replace />, requiresSession: true },
  { path: '/login', tenantHost: 'public', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/sso-callback', tenantHost: 'public', element: <ClerkSsoCallbackPage /> },
  { path: '/auth/sso-callback', tenantHost: 'public', element: <ClerkSsoCallbackPage /> },
  { path: '/user/login', tenantHost: 'public', element: <UserLogin /> },
  ...withTenantPrefixes('/:tenant/user/login', { tenantHost: 'public', element: <UserLogin /> }),
  { path: '/user/register', tenantHost: 'public', element: <UserRegister /> },
  ...withTenantPrefixes('/:tenant/user/register', { tenantHost: 'public', element: <UserRegister /> }),
  { path: '/cuenta', tenantHost: 'public', element: <UserAccount /> },
  { path: '/demo', element: <Demo /> },
  { path: '/contacto', element: <Navigate to="/demo?intent=ventas" replace /> },
  { path: '/demo-catalogs/:catalogFile', element: <DemoCatalogDownloadPage /> },
  {
    path: DISABILITY_AI_AGENT_DEMO_PATH,
    element: <DisabilityAIAgentDemoPage />,
    allowGuest: true,
  },
  { path: '/demo/:slug', element: <DemoLandingPage /> },
  { path: '/casos', element: <Navigate to="/demo" replace /> },
  { path: '/casos-de-uso', element: <Navigate to="/demo" replace /> },
  { path: '/sectores', element: <Navigate to="/demo" replace /> },
  { path: '/pymes', element: <Navigate to="/demo?sector=empresas" replace /> },
  { path: '/empresas', element: <Navigate to="/demo?sector=empresas" replace /> },
  { path: '/municipios', element: <Navigate to="/demo?sector=gobierno" replace /> },
  { path: '/gobiernos', element: <Navigate to="/demo?sector=gobierno" replace /> },
  { path: '/colegios', element: <Navigate to="/demo?sector=educacion" replace /> },
  { path: '/soluciones/gobierno', element: <Navigate to="/demo?sector=gobierno" replace /> },
  { path: '/soluciones/empresas', element: <Navigate to="/demo?sector=empresas" replace /> },
  { path: '/perfil', tenantHost: 'private', element: <Perfil />, requiresSession: true },
  { path: '/enterprise', tenantHost: 'private', element: <EnterpriseOpsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  {
    path: '/admin/knowledge', tenantHost: 'private',
    element: <KnowledgeSourcesPage />,
    requiresSession: true,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['knowledge.read'],
    enforceCapabilities: true,
  },
  {
    path: '/implementacion', tenantHost: 'private',
    element: <TenantImplementationCenterPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },
  { path: '/bot-settings', tenantHost: 'private', element: <BotSettingsEnterprise />, roles: ['tenant_admin', 'tenant_admin', 'superadmin'] },
  { path: '/perfil/pedidos', tenantHost: 'private', element: <Navigate to="/pedidos" replace />, requiresSession: true },
  { path: '/chat', element: <ChatPage /> },
  { path: '/chat/:ticketId', tenantHost: 'public', element: <TicketLookup /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/chatpos', element: <ChatPosPage /> },
  { path: '/chatcrm', tenantHost: 'private', element: <ChatCRMPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/opinar', element: <OpinarArPage /> },
  {
    path: '/integracion/meta/credenciales',
    element: <MetaCredentials />,
    requiresSession: true,
    roles: ['superadmin'],
  },
  {
    path: '/integracion/whatsapp/connect', tenantHost: 'private',
    element: <WhatsappEmbeddedSignupPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },
  {
    path: '/integracion', tenantHost: 'private',
    element: <Integracion />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },
  { path: '/documentacion', element: <Documentacion /> },
  { path: '/faqs', element: <Faqs /> },
  { path: '/productos', tenantHost: 'public', element: <ProductCatalog /> },
  { path: '/cart', tenantHost: 'public', element: <CartPage /> },
  { path: '/market/blueprint', element: <MarketplaceBlueprintPage /> },
  { path: '/checkout-productos', tenantHost: 'public', element: <ProductCheckoutPage /> },
  { path: '/pedido/confirmado', tenantHost: 'public', element: <OrderConfirmationPage /> },
  { path: '/legal/privacy', tenantHost: 'public', element: <Privacy /> },
  { path: '/legal/terms', tenantHost: 'public', element: <Terms /> },
  { path: '/legal/cookies', tenantHost: 'public', element: <Cookies /> },
  { path: '/legal/data-deletion', tenantHost: 'public', element: <DataDeletion /> },
  { path: '/privacidad', tenantHost: 'public', element: <Privacy /> },
  { path: '/terminos', tenantHost: 'public', element: <Terms /> },
  { path: '/eliminacion-datos', tenantHost: 'public', element: <DataDeletion /> },
  {
    path: '/tickets', tenantHost: 'private',
    element: <TicketDeskRedirect />,
    requiresSession: true,
  },
  { path: '/notificaciones', tenantHost: 'private', element: <SmartNotificationsWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  {
    path: '/tickets/board', tenantHost: 'private',
    element: <TicketsBoardPage />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  },
  { path: '/surveys', tenantHost: 'private', element: <SurveyBuilderPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/analytics/hub', tenantHost: 'private', element: <AnalyticsHubPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/analytics/operations', tenantHost: 'private', element: <OperationsDashboardPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  {
    path: '/pedidos', tenantHost: 'private',
    element: <SmartPedidosWrapper />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['market.orders.read'],
  },
  {
    path: '/usuarios', tenantHost: 'private',
    element: <UsuariosPage />,
    roles: ['tenant_admin', 'superadmin'],
  },
  { path: '/notifications', element: <NotificationSettings /> },
  { path: '/ticket', tenantHost: 'public', element: <TicketLookup /> },
  { path: '/ticket/:ticketId', tenantHost: 'public', element: <TicketLookup /> },
  { path: '/historial', element: <CustomerHistory /> },
  { path: '/presupuestos', element: <BudgetRequest /> },
  { path: '/recordatorios', element: <Reminders /> },
  {
    path: '/logs', tenantHost: 'private',
    element: <LogWorkbench />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['tickets.admin'],
  },
  { path: '/pyme/metrics', element: <BusinessMetrics /> },
  { path: '/crm/integrations', element: <CrmIntegrations /> },
  { path: '/consultas', element: <PredefinedQueries /> },
  { path: '/403', tenantHost: 'public', element: <PermissionDenied /> },
  ...(FEATURE_ENCUESTAS
    ? [
        { path: '/admin/encuestas', tenantHost: 'private', element: <AdminSurveysIndex />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/admin/encuestas/new', tenantHost: 'private', element: <NewSurveyPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/admin/encuestas/:id', tenantHost: 'private', element: <SurveyDetailPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/admin/encuestas/:id/analytics', tenantHost: 'private', element: <SurveyAnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
      ] satisfies RouteConfig[]
    : []),
  { path: '/pyme/catalog', tenantHost: 'private', element: <ProductCatalog />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/tramites', tenantHost: 'private', element: <TramitesCatalog />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/categorias', tenantHost: 'private', element: <CategoryManagementPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/usuarios', tenantHost: 'private', element: <InternalUsers />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/whatsapp', tenantHost: 'private', element: <WhatsappIntegration />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/integrations', tenantHost: 'private', element: <MunicipalSystems />, roles: ['tenant_admin', 'superadmin'] },
  {
    path: '/municipal/surveys', tenantHost: 'private',
    element: <SatisfactionSurveys />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
  },
  { path: '/municipal/playbook', tenantHost: 'private', element: <MunicipalPlaybookPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/message-metrics', tenantHost: 'private', element: <MunicipalMessageMetrics />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/analytics', tenantHost: 'private', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/stats', tenantHost: 'private', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/incidents', tenantHost: 'private', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  {
    path: '/estadisticas', tenantHost: 'private',
    element: <EstadisticasPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredCapabilities: ['analytics.read'],
  },
  { path: '/:tenant/estadisticas', tenantHost: 'private', tenantHostParam: 'tenant', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/estadisticas', { tenantHost: 'private', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin', 'analytics_viewer'] }),
  {
    path: '/analytics', tenantHost: 'private',
    element: <AnalyticsPage />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['analytics.read'],
  },
  { path: '/:tenant/analytics/operations', tenantHost: 'private', tenantHostParam: 'tenant', element: <OperationsDashboardPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/analytics/operations', { tenantHost: 'private', element: <OperationsDashboardPage />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer'] }),
  { path: '/:tenant/analytics', tenantHost: 'private', tenantHostParam: 'tenant', element: <AnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/analytics', { tenantHost: 'private', element: <AnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer'] }),
  { path: '/perfil/plantillas-respuesta', tenantHost: 'private', element: <GestionPlantillasPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/perfil/plantillas-respuesta', { tenantHost: 'private',
    element: <GestionPlantillasPage />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
  }),

  {
    path: '/admin/catalog', tenantHost: 'private',
    element: <CatalogManagementPage />,
    roles: ['tenant_admin', 'superadmin', 'empleado'],
    requiredAllCapabilities: ['market.catalog.write'],
  },
  {
    path: '/catalog-mappings/new', tenantHost: 'private',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['market.catalog.write'],
  },
  {
    path: '/catalog-mappings/:mappingId', tenantHost: 'private',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['market.catalog.write'],
  },
  // Rutas para la gestión de mapeo de catálogos por PYME
  {
    path: '/admin/pyme/:pymeId/catalog-mappings/new',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['market.catalog.write'],
  },
  {
    path: '/admin/pyme/:pymeId/catalog-mappings/:mappingId',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['market.catalog.write'],
  },

  {
    path: '/superadmin',
    element: <SuperAdminDashboard />,
    roles: ['superadmin'],
  },
  { path: '/admin/tenants', element: <SuperAdminDashboard />, roles: ['superadmin'] },
  {
    path: '/empleados',
    element: <InternalUsers />,
    roles: ['tenant_admin', 'superadmin'],
  },

  {
    path: '/iframe',
    element: (
      <React.Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-transparent" />}>
        <Iframe />
      </React.Suspense>
    ),
  },
];

export default routes;
