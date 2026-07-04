
import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

// ... (importaciones existentes) ...
import { EDUCATION_FEATURE_FLAGS, FEATURE_ENCUESTAS } from '@/config/featureFlags';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import UserLogin from '@/pages/UserLogin';
import UserRegister from '@/pages/UserRegister';
const ClerkSsoCallbackPage = React.lazy(() => import('@/pages/ClerkSsoCallbackPage'));
const Demo = React.lazy(() => import('@/pages/Demo'));
const DemoCatalogDownloadPage = React.lazy(() => import('@/pages/DemoCatalogDownloadPage'));
const Perfil = React.lazy(() => import('@/pages/Perfil'));
const UserAccount = React.lazy(() => import('@/pages/UserAccount'));
const ChatPage = React.lazy(() => import('@/pages/ChatPage'));
const Checkout = React.lazy(() => import('@/pages/Checkout'));
const ChatPosPage = React.lazy(() => import('@/pages/ChatPosPage'));
const ChatCRMPage = React.lazy(() => import('@/pages/ChatCRMPage'));
const Integracion = React.lazy(() => import('@/pages/Integracion'));
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
  element: React.ReactElement;
  roles?: string[]; // Roles para admin/empleado de Chatboc
  requiredCapabilities?: string[]; // Capacidades dinámicas provistas por backend
  requiredAllCapabilities?: string[]; // Capacidades obligatorias para integraciones/configuración sensible
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
  const suffix = `${encodeURIComponent(ticketId)}${location.search || ''}`;
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
    path: `/${prefix}${pathSuffix}`,
  }));
};

const userPortalRoutes: RouteConfig[] = [
  {
    path: '/portal/dashboard',
    element: <UserDashboardPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/catalogo',
    element: <UserCatalogPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/pedidos',
    element: <UserOrdersPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/reclamos',
    element: <UserClaimsPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/portal/noticias',
    element: <UserNewsPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/eventos',
    element: <UserEventsPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/beneficios',
    element: <UserBenefitsPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/encuestas',
    element: <UserSurveysPage />,
    userPortal: true,
    allowGuest: true,
  },
  {
    path: '/portal/cuenta',
    element: <UserAccountPage />,
    userPortal: true,
    allowGuest: true,
  },
];

const publicLegacyRoutes: RouteConfig[] = [
  {
    path: '/noticias/eventos',
    element: <TenantEventsPage />,
    allowGuest: true,
  },
  {
    path: '/noticias/encuestas',
    element: <PublicSurveysIndex />,
    allowGuest: true,
  },
  {
    path: '/municipio/reclamos/nuevo',
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
    roles: route.roles,
    requiredCapabilities: route.requiredCapabilities,
    requiredAllCapabilities: route.requiredAllCapabilities,
  }),
);


const routes: RouteConfig[] = [
  // --- SPECIFIC ROUTES FIRST (Priority) ---

  // Cart & Checkout (Tenant) - Must be before generic tenant home
  ...withTenantPrefixes('/:tenant/cart', { element: <MarketCartPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/productos', { element: <ProductCatalog /> }),
  ...withTenantPrefixes('/:tenant/checkout-productos', { element: <ProductCheckoutPage /> }),
  ...withTenantPrefixes('/:tenant/pedido/confirmado', { element: <OrderConfirmationPage /> }),

  // FIX: Short routes for direct access (e.g. /municipio/productos without slug)
  // This allows the router to match /municipio/productos specifically before /municipio/:tenant (where tenant="productos")
  ...withTenantPrefixes('/cart', { element: <CartPage /> }),
  ...withTenantPrefixes('/productos', { element: <ProductCatalog /> }),
  ...withTenantPrefixes('/checkout-productos', { element: <ProductCheckoutPage /> }),
  ...withTenantPrefixes('/encuestas', { element: <PublicSurveysIndex /> }),

  // Market specific
  ...withTenantPrefixes('/:tenant/market', { element: <MarketCatalogPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/product/:slug', { element: <MarketProductPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/checkout', { element: <MarketCheckoutPage />, allowGuest: true }),
  ...withTenantPrefixes('/:tenant/market/blueprint', { element: <MarketplaceBlueprintPage /> }),

  // Tenant Portal Sections
  ...withTenantPrefixes('/:tenant/noticias', { element: <TenantNewsPage /> }),
  ...withTenantPrefixes('/:tenant/eventos', { element: <TenantEventsPage /> }),
  ...withTenantPrefixes('/:tenant/reclamos/nuevo', { element: <TenantTicketFormPage /> }),

  // Explicit aliases to match user mental model
  ...withTenantPrefixes('/:tenant/reclamos', {
    element: <TicketsPanel />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/tickets', {
    element: <TicketsPanel />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/inbox', {
    element: <TicketsPanel />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  }),
  ...withTenantPrefixes('/:tenant/pedidos', { element: <SmartPedidosWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/pedidos/:id', { element: <AdminOrderDetailPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/notificaciones', { element: <SmartNotificationsWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/categorias', { element: <CategoryManagementPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }),

  // CRM
  ...withTenantPrefixes('/:tenant/crm/clientes', { element: <ClientsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/crm/clientes/:contactId', { element: <ClientDetailPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),

  // Surveys
  ...(FEATURE_ENCUESTAS
    ? [
        { path: '/encuestas', element: <PublicSurveysIndex /> },
        { path: '/encuestas/:slug/qr', element: <SurveyQrPage /> },
        { path: '/e/:slug', element: <PublicSurveyPage /> },
        ...withTenantPrefixes('/:tenant/encuestas', { element: <TenantSurveyListPage /> }),
        ...withTenantPrefixes('/:tenant/encuestas/:slug', { element: <TenantSurveyDetailPage /> }),
      ]
    : []),

  // Auth (Tenant)
  ...withTenantPrefixes('/:tenant/login', { element: <Login /> }),
  ...withTenantPrefixes('/:tenant/register', { element: <UserRegister /> }),
  ...withTenantPrefixes('/:tenant/user/login', { element: <UserLogin /> }),
  ...withTenantPrefixes('/:tenant/user/register', { element: <UserRegister /> }),

  // Integrations & Admin (Tenant Scoped)
  ...withTenantPrefixes('/:tenant/integracion', {
    element: <IntegracionesPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/new', {
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin', 'catalog_manager'],
    requiredAllCapabilities: ['market.catalog.write'],
  }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/:mappingId', {
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin', 'catalog_manager'],
    requiredAllCapabilities: ['market.catalog.write'],
  }),
  ...withTenantPrefixes('/:tenant/admin/catalog', {
    element: <CatalogManagementPage />,
    roles: ['tenant_admin', 'superadmin', 'empleado'],
    requiredAllCapabilities: ['market.catalog.write'],
  }),


  // --- EDUCATION FOUNDATION ROUTES ---
  ...(EDUCATION_FEATURE_FLAGS.education_enabled
    ? [
        { path: '/educacion', element: <EducationPublicPage /> },
        ...(EDUCATION_FEATURE_FLAGS.family_portal_enabled
          ? [
              { path: '/educacion/familia', element: <EducationFamilyHomePage />, allowGuest: true },
              { path: '/educacion/familia/verificacion', element: <EducationFamilyVerificationPage />, allowGuest: true },
            ]
          : []),
        ...(EDUCATION_FEATURE_FLAGS.attendance_enabled
          ? [{ path: '/educacion/familia/asistencia', element: <EducationAttendancePage />, allowGuest: true }]
          : []),
        ...(EDUCATION_FEATURE_FLAGS.documents_enabled
          ? [{ path: '/educacion/familia/documentos', element: <EducationDocumentsPage />, allowGuest: true }]
          : []),
        { path: '/educacion/staff/inbox', element: <EducationStaffLegacyRedirect />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/t/:tenant/educacion/staff/inbox', element: <EducationStaffInboxPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        ...(EDUCATION_FEATURE_FLAGS.admissions_enabled
          ? [{ path: '/educacion/staff/admisiones', element: <EducationAdmissionsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }]
          : []),
        ...(EDUCATION_FEATURE_FLAGS.billing_enabled
          ? [{ path: '/educacion/staff/cobranzas', element: <EducationBillingPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }]
          : []),
      ]
    : []),

  // --- USER PORTAL ROUTES ---
  { path: '/portal/:tenant', element: <PortalTenantEntryRedirect />, userPortal: true, allowGuest: true },
  ...userPortalRoutes,
  ...canonicalTenantPortalRoutes,
  ...tenantPortalRoutes,
  ...publicLegacyRoutes,

  // --- GENERIC / FALLBACK ROUTES ---

  { path: '/', element: <Index /> },

  // Clean URL Support (Root Level Tenant Routes)
  // Placing these carefully to avoid conflicts, though React Router v6 is smart about specificity.
  { path: '/:tenant/productos', element: <LegacyTenantAliasRedirect suffix="/productos" /> },
  { path: '/:tenant/catalogo', element: <LegacyTenantAliasRedirect suffix="/productos" /> },
  { path: '/:tenant/cart', element: <LegacyTenantAliasRedirect suffix="/cart" /> },
  { path: '/:tenant/checkout-productos', element: <LegacyTenantAliasRedirect suffix="/checkout-productos" /> },
  { path: '/:tenant/pedido/confirmado', element: <LegacyTenantAliasRedirect suffix="/pedido/confirmado" /> },
  // Public Order Tracking
  { path: '/pyme/pedidos/:nro_pedido', element: <OrderTrackingPage /> },
  { path: '/tracking/claim', element: <TrackingExperiencePage kind="claim" /> },
  { path: '/tracking/claim/:code', element: <TrackingExperiencePage kind="claim" /> },
  { path: '/tracking/order', element: <TrackingExperiencePage kind="order" /> },
  { path: '/tracking/order/:code', element: <TrackingExperiencePage kind="order" /> },
  { path: '/t/chat/:ticketId', element: <TwilioTicketTemplateRedirect /> },
  { path: '/catalogo/:slug', element: <LegacyPublicTenantSlugRedirect suffix="/market" />, allowGuest: true },
  { path: '/checkout/:slug', element: <LegacyPublicTenantSlugRedirect suffix="/checkout" />, allowGuest: true },
  { path: '/finanzas/:tenantSlug/:flow/:operationCode', element: <FinanceWebviewPage />, allowGuest: true },
  // Missing root integration route
  {
    path: '/:tenant/integracion',
    element: <LegacyTenantAliasRedirect suffix="/integracion" />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },

  // Generic Tenant Home (Dashboard/Landing) - Must be LAST among tenant routes to avoid swallowing others
  ...withTenantPrefixes('/:tenant', { element: <TenantHomeRoute /> }),
  { path: '/:tenant', element: <LegacyTenantAliasRedirect /> }, // Legacy root tenant alias -> canonical

  // Global Routes
  { path: '/admin', element: <Navigate to="/perfil" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/sso-callback', element: <ClerkSsoCallbackPage /> },
  { path: '/auth/sso-callback', element: <ClerkSsoCallbackPage /> },
  { path: '/user/login', element: <UserLogin /> },
  ...withTenantPrefixes('/:tenant/user/login', { element: <UserLogin /> }),
  { path: '/user/register', element: <UserRegister /> },
  ...withTenantPrefixes('/:tenant/user/register', { element: <UserRegister /> }),
  { path: '/cuenta', element: <UserAccount /> },
  { path: '/demo', element: <Demo /> },
  { path: '/contacto', element: <Navigate to="/demo?intent=ventas" replace /> },
  { path: '/demo-catalogs/:catalogFile', element: <DemoCatalogDownloadPage /> },
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
  { path: '/perfil', element: <Perfil /> },
  { path: '/enterprise', element: <EnterpriseOpsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/bot-settings', element: <BotSettingsEnterprise />, roles: ['tenant_admin', 'tenant_admin', 'superadmin'] },
  { path: '/perfil/pedidos', element: <Navigate to="/pedidos" replace /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/chat/:ticketId', element: <TicketLookup /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/chatpos', element: <ChatPosPage /> },
  { path: '/chatcrm', element: <ChatCRMPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/opinar', element: <OpinarArPage /> },
  {
    path: '/integracion/whatsapp/connect',
    element: <WhatsappEmbeddedSignupPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },
  {
    path: '/integracion',
    element: <Integracion />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['settings.tenant.write'],
  },
  { path: '/documentacion', element: <Documentacion /> },
  { path: '/faqs', element: <Faqs /> },
  { path: '/productos', element: <ProductCatalog /> },
  { path: '/cart', element: <CartPage /> },
  { path: '/market/blueprint', element: <MarketplaceBlueprintPage /> },
  { path: '/checkout-productos', element: <ProductCheckoutPage /> },
  { path: '/pedido/confirmado', element: <OrderConfirmationPage /> },
  { path: '/legal/privacy', element: <Privacy /> },
  { path: '/legal/terms', element: <Terms /> },
  { path: '/legal/cookies', element: <Cookies /> },
  { path: '/legal/data-deletion', element: <DataDeletion /> },
  { path: '/privacidad', element: <Privacy /> },
  { path: '/terminos', element: <Terms /> },
  { path: '/eliminacion-datos', element: <DataDeletion /> },
  {
    path: '/tickets',
    element: <TicketDeskRedirect />,
  },
  { path: '/notificaciones', element: <SmartNotificationsWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  {
    path: '/tickets/board',
    element: <TicketsBoardPage />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: TICKET_READ_CAPABILITIES,
  },
  { path: '/surveys', element: <SurveyBuilderPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/analytics/hub', element: <AnalyticsHubPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/analytics/operations', element: <OperationsDashboardPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  {
    path: '/pedidos',
    element: <SmartPedidosWrapper />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['market.orders.read'],
  },
  {
    path: '/usuarios',
    element: <UsuariosPage />,
    roles: ['tenant_admin', 'superadmin'],
  },
  { path: '/notifications', element: <NotificationSettings /> },
  { path: '/ticket', element: <TicketLookup /> },
  { path: '/ticket/:ticketId', element: <TicketLookup /> },
  { path: '/historial', element: <CustomerHistory /> },
  { path: '/presupuestos', element: <BudgetRequest /> },
  { path: '/recordatorios', element: <Reminders /> },
  {
    path: '/logs',
    element: <LogWorkbench />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['tickets.admin'],
  },
  { path: '/pyme/metrics', element: <BusinessMetrics /> },
  { path: '/crm/integrations', element: <CrmIntegrations /> },
  { path: '/consultas', element: <PredefinedQueries /> },
  { path: '/403', element: <PermissionDenied /> },
  ...(FEATURE_ENCUESTAS
    ? [
        { path: '/admin/encuestas', element: <AdminSurveysIndex />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/admin/encuestas/new', element: <NewSurveyPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/admin/encuestas/:id', element: <SurveyDetailPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
        { path: '/admin/encuestas/:id/analytics', element: <SurveyAnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
      ]
    : []),
  { path: '/pyme/catalog', element: <ProductCatalog />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/tramites', element: <TramitesCatalog />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/categorias', element: <CategoryManagementPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/usuarios', element: <InternalUsers />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/whatsapp', element: <WhatsappIntegration />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/integrations', element: <MunicipalSystems />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/surveys', element: <SatisfactionSurveys /> },
  { path: '/municipal/playbook', element: <MunicipalPlaybookPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/message-metrics', element: <MunicipalMessageMetrics />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/analytics', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/stats', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/municipal/incidents', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  {
    path: '/estadisticas',
    element: <EstadisticasPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredCapabilities: ['analytics.read'],
  },
  { path: '/:tenant/estadisticas', element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/estadisticas', { element: <EstadisticasPage />, roles: ['tenant_admin', 'superadmin', 'analytics_viewer'] }),
  {
    path: '/analytics',
    element: <AnalyticsPage />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['analytics.read'],
  },
  { path: '/:tenant/analytics/operations', element: <OperationsDashboardPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/analytics/operations', { element: <OperationsDashboardPage />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer'] }),
  { path: '/:tenant/analytics', element: <AnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  ...withTenantPrefixes('/:tenant/analytics', { element: <AnalyticsPage />, roles: ['tenant_admin', 'employee', 'superadmin', 'analytics_viewer'] }),
  { path: '/perfil/plantillas-respuesta', element: <GestionPlantillasPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },

  {
    path: '/admin/catalog',
    element: <CatalogManagementPage />,
    roles: ['tenant_admin', 'superadmin', 'empleado'],
    requiredAllCapabilities: ['market.catalog.write'],
  },
  {
    path: '/catalog-mappings/new',
    element: <CatalogMappingPage />,
    roles: ['tenant_admin', 'superadmin'],
    requiredAllCapabilities: ['market.catalog.write'],
  },
  {
    path: '/catalog-mappings/:mappingId',
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
