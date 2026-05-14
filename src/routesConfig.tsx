
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

// ... (importaciones existentes) ...
import { EDUCATION_FEATURE_FLAGS, FEATURE_ENCUESTAS } from '@/config/featureFlags';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import UserLogin from '@/pages/UserLogin';
import UserRegister from '@/pages/UserRegister';
import Demo from '@/pages/Demo';
import DemoCatalogDownloadPage from '@/pages/DemoCatalogDownloadPage';
import Perfil from '@/pages/Perfil';
import UserAccount from '@/pages/UserAccount';
import ChatPage from '@/pages/ChatPage';
import Checkout from '@/pages/Checkout';
import ChatPosPage from '@/pages/ChatPosPage';
import ChatCRMPage from '@/pages/ChatCRMPage';
import Integracion from '@/pages/Integracion';
import Documentacion from '@/pages/Documentacion';
import Faqs from '@/pages/Faqs';
import Privacy from '@/pages/legal/Privacy';
import Terms from '@/pages/legal/Terms';
import Cookies from '@/pages/legal/Cookies';
import TicketsPanel from '@/pages/TicketsPanel';
import { TicketInboxPage } from '@/components/tickets/inbox';
import PedidosPage from '@/pages/pyme/pedidos/PedidosPage';
import IntegracionesPage from '@/pages/pyme/integraciones/IntegracionesPage';
import UsuariosPage from '@/pages/UsuariosPage';
import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/utils/tenantPaths';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getReservedPublicSlugRedirect } from '@/utils/publicRoutes';
import ProductCatalog from '@/pages/ProductCatalog';
import MunicipalMessageMetrics from '@/pages/MunicipalMessageMetrics';
import NotificationSettings from '@/pages/NotificationSettings';
import TramitesCatalog from '@/pages/TramitesCatalog';
import InternalUsers from '@/pages/InternalUsers';
import WhatsappIntegration from '@/pages/WhatsappIntegration';
import MunicipalSystems from '@/pages/MunicipalSystems';
import MunicipalPlaybookPage from '@/pages/MunicipalPlaybook';
import SatisfactionSurveys from '@/pages/SatisfactionSurveys';
import TicketLookup from '@/pages/TicketLookup';
import CustomerHistory from '@/pages/CustomerHistory';
import BudgetRequest from '@/pages/BudgetRequest';
import Reminders from '@/pages/Reminders';
import BusinessMetrics from '@/pages/BusinessMetrics';
import CrmIntegrations from '@/pages/CrmIntegrations';
import PredefinedQueries from '@/pages/PredefinedQueries';
import PermissionDenied from '@/pages/PermissionDenied';
import LogWorkbench from '@/pages/LogWorkbench';
import CartPage from '@/pages/Cart';
import ProductCheckoutPage from '@/pages/ProductCheckoutPage';
import OrderConfirmationPage from '@/pages/OrderConfirmation';
import GestionPlantillasPage from '@/pages/GestionPlantillasPage';
import CatalogMappingPage from '@/pages/admin/CatalogMappingPage';
import CategoryManagementPage from '@/pages/admin/CategoryManagementPage';
import CatalogManagementPage from '@/pages/admin/CatalogManagementPage';
import OpinarArPage from '@/pages/OpinarArPage';
import EstadisticasPage from '@/pages/EstadisticasPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import BotSettingsEnterprise from '@/pages/BotSettingsEnterprise';

const Iframe = React.lazy(() => import('@/pages/IframePage'));
import MarketCartPage from '@/pages/market/MarketCartPage';
import MarketplaceBlueprintPage from '@/pages/market/MarketplaceBlueprintPage';
import PublicSurveysIndex from '@/pages/encuestas';
import PublicSurveyPage from '@/pages/e/[slug]';
import SurveyQrPage from '@/pages/encuestas/QrPage';
import AdminSurveysIndex from '@/pages/admin/encuestas/index';
import NewSurveyPage from '@/pages/admin/encuestas/new';
import SurveyDetailPage from '@/pages/admin/encuestas/[id]';
import SurveyAnalyticsPage from '@/pages/admin/encuestas/[id]/analytics';
import TenantHomePage from '@/pages/tenant/TenantHomePage';
import PublicCatalogPage from '@/pages/PublicCatalogPage';
import TenantNewsPage from '@/pages/tenant/TenantNewsPage';
import TenantEventsPage from '@/pages/tenant/TenantEventsPage';
import TenantSurveyListPage from '@/pages/tenant/TenantSurveyListPage';
import TenantSurveyDetailPage from '@/pages/tenant/TenantSurveyDetailPage';
import TenantTicketFormPage from '@/pages/tenant/TenantTicketFormPage';
import MarketCatalogPage from '@/pages/tenant/market/MarketCatalogPage';
import MarketProductPage from '@/pages/tenant/market/MarketProductPage';
import MarketCheckoutPage from '@/pages/tenant/market/MarketCheckoutPage';
import CreateTenantPage from '@/pages/admin/CreateTenantPage';
import SuperAdminDashboard from '@/pages/admin/SuperAdminDashboard';
import DemoLandingPage from '@/pages/DemoLandingPage';
import SmartPedidosWrapper from '@/pages/SmartPedidosWrapper';
import SmartNotificationsWrapper from '@/pages/SmartNotificationsWrapper';
import OrderTrackingPage from '@/pages/pyme/pedidos/OrderTrackingPage';
import TrackingExperiencePage from '@/pages/tracking/TrackingExperiencePage';
import AdminOrderDetailPage from '@/pages/admin/AdminOrderDetailPage';
import ClientsPage from '@/pages/pyme/crm/ClientsPage';
import ClientDetailPage from '@/pages/pyme/crm/ClientDetailPage';
import EnterpriseOpsPage from '@/pages/EnterpriseOpsPage';
import EducationPublicPage from '@/pages/education/EducationPublicPage';
import EducationFamilyHomePage from '@/pages/education/EducationFamilyHomePage';
import EducationStaffInboxPage from '@/pages/education/EducationStaffInboxPage';
import EducationAttendancePage from '@/pages/education/EducationAttendancePage';
import EducationDocumentsPage from '@/pages/education/EducationDocumentsPage';
import EducationAdmissionsPage from '@/pages/education/EducationAdmissionsPage';
import EducationBillingPage from '@/pages/education/EducationBillingPage';
import EducationFamilyVerificationPage from '@/pages/education/EducationFamilyVerificationPage';
import TicketsBoardPage from '@/features/tickets/TicketsBoardPage';
import SurveyBuilderPage from '@/features/surveys/SurveyBuilderPage';
import AnalyticsHubPage from '@/features/analytics/AnalyticsHubPage';
import OperationsDashboardPage from '@/features/analytics/OperationsDashboardPage';

// Updated for Commerce Module & Mirror Catalog
// Final verification: Commerce & Admin modules active
// NUEVAS IMPORTACIONES PARA EL PORTAL DE USUARIO
// UserPortalLayout no se importa aquí si se usa como Layout Route en App.tsx
import UserDashboardPage from '@/pages/user-portal/UserDashboardPage';
import UserCatalogPage from '@/pages/user-portal/UserCatalogPage';
import UserOrdersPage from '@/pages/user-portal/UserOrdersPage';
import UserClaimsPage from '@/pages/user-portal/UserClaimsPage';
import UserNewsPage from '@/pages/user-portal/UserNewsPage';
import UserEventsPage from '@/pages/user-portal/UserEventsPage';
import UserBenefitsPage from '@/pages/user-portal/UserBenefitsPage';
import UserSurveysPage from '@/pages/user-portal/UserSurveysPage';
import UserAccountPage from '@/pages/user-portal/UserAccountPage';

export interface RouteConfig {
  path: string;
  element: React.ReactElement;
  roles?: string[]; // Roles para admin/empleado de Chatboc
  requiredCapabilities?: string[]; // Capacidades dinámicas provistas por backend
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

const TenantHomeRoute = () => {
  const params = useParams();
  const tenant = typeof params.tenant === 'string' ? params.tenant.trim() : '';
  const publicRedirect = getReservedPublicSlugRedirect(tenant);
  if (publicRedirect) {
    return <Navigate to={publicRedirect} replace />;
  }
  return <TenantHomePage />;
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
  }),
);


const routes: RouteConfig[] = [
  // --- SPECIFIC ROUTES FIRST (Priority) ---

  // Cart & Checkout (Tenant) - Must be before generic tenant home
  ...withTenantPrefixes('/:tenant/cart', { element: <CartPage /> }),
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
  ...withTenantPrefixes('/:tenant/market', { element: <MarketCatalogPage /> }),
  ...withTenantPrefixes('/:tenant/product/:slug', { element: <MarketProductPage /> }),
  ...withTenantPrefixes('/:tenant/checkout', { element: <MarketCheckoutPage /> }),
  ...withTenantPrefixes('/:tenant/market/blueprint', { element: <MarketplaceBlueprintPage /> }),

  // Tenant Portal Sections
  ...withTenantPrefixes('/:tenant/noticias', { element: <TenantNewsPage /> }),
  ...withTenantPrefixes('/:tenant/eventos', { element: <TenantEventsPage /> }),
  ...withTenantPrefixes('/:tenant/reclamos/nuevo', { element: <TenantTicketFormPage /> }),

  // Explicit aliases to match user mental model
  ...withTenantPrefixes('/:tenant/reclamos', { element: <TicketsPanel />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/tickets', { element: <TicketsPanel />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
  ...withTenantPrefixes('/:tenant/inbox', { element: <TicketInboxPage />, roles: ['tenant_admin', 'employee', 'superadmin'] }),
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
  ...withTenantPrefixes('/:tenant/integracion', { element: <IntegracionesPage />, roles: ['tenant_admin'] }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/new', { element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/:mappingId', { element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin', 'catalog_manager'] }),
  ...withTenantPrefixes('/:tenant/admin/catalog', { element: <CatalogManagementPage />, roles: ['tenant_admin', 'superadmin', 'empleado'] }),


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
  { path: '/tracking/claim/:code', element: <TrackingExperiencePage kind="claim" /> },
  { path: '/tracking/order/:code', element: <TrackingExperiencePage kind="order" /> },
  // Missing root integration route
  { path: '/:tenant/integracion', element: <LegacyTenantAliasRedirect suffix="/integracion" />, roles: ['tenant_admin'] },

  // Generic Tenant Home (Dashboard/Landing) - Must be LAST among tenant routes to avoid swallowing others
  ...withTenantPrefixes('/:tenant', { element: <TenantHomeRoute /> }),
  { path: '/:tenant', element: <LegacyTenantAliasRedirect /> }, // Legacy root tenant alias -> canonical

  // Global Routes
  { path: '/admin', element: <Navigate to="/perfil" replace /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
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
  { path: '/integracion', element: <Integracion />, roles: ['tenant_admin'] },
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
  {
    path: '/tickets',
    element: <TicketsPanel />,
    roles: ['tenant_admin', 'employee', 'superadmin'],
    requiredCapabilities: ['tickets.read'],
  },
  { path: '/notificaciones', element: <SmartNotificationsWrapper />, roles: ['tenant_admin', 'employee', 'superadmin'] },
  { path: '/tickets/board', element: <TicketsBoardPage />, roles: ['tenant_admin', 'employee', 'superadmin'] },
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

  { path: '/admin/catalog', element: <CatalogManagementPage />, roles: ['tenant_admin', 'superadmin', 'empleado'] },
  { path: '/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin'] },
  // Rutas para la gestión de mapeo de catálogos por PYME
  { path: '/admin/pyme/:pymeId/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin'] },
  { path: '/admin/pyme/:pymeId/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['tenant_admin', 'superadmin'] },

  {
    path: '/superadmin',
    element: <SuperAdminDashboard />,
    roles: ['superadmin'],
    requiredCapabilities: ['settings.tenant.write'],
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
