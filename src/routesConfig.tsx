
import React from 'react';
import { Navigate } from 'react-router-dom';

// ... (importaciones existentes) ...
import { FEATURE_ENCUESTAS } from '@/config/featureFlags';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import UserLogin from '@/pages/UserLogin';
import UserRegister from '@/pages/UserRegister';
import Demo from '@/pages/Demo';
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
import PedidosPage from '@/pages/pyme/pedidos/PedidosPage';
import IntegracionesPage from '@/pages/pyme/integraciones/IntegracionesPage';
import UsuariosPage from '@/pages/UsuariosPage';
import { TENANT_ROUTE_PREFIXES } from '@/utils/tenantPaths';
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
import OpinarArPage from '@/pages/OpinarArPage';
import EstadisticasPage from '@/pages/EstadisticasPage';
import Iframe from '@/pages/iframe';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
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
  userPortal?: boolean; // Flag para rutas del portal de usuario final (cliente/vecino)
  allowGuest?: boolean; // Permite acceder sin sesión (modo demo)
}

const withTenantPrefixes = (
  pathSuffix: string,
  config: Omit<RouteConfig, 'path'>,
): RouteConfig[] =>
  TENANT_ROUTE_PREFIXES.map((prefix) => ({
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
  // Added required generic routes for navigation fallbacks
  {
    path: '/noticias/eventos',
    element: <UserEventsPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/noticias/encuestas',
    element: <UserSurveysPage />,
    userPortal: true,
    allowGuest: true
  },
  {
    path: '/municipio/reclamos/nuevo',
    element: <TenantTicketFormPage />,
    userPortal: true,
    allowGuest: true
  }
];

// Generar rutas con prefijo de tenant para el portal
// Esto permite /:tenant/portal/dashboard, etc.
const tenantPortalRoutes: RouteConfig[] = userPortalRoutes.map(route => ({
  ...route,
  path: `/:tenant${route.path}`,
}));


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
  ...withTenantPrefixes('/:tenant/reclamos', { element: <TicketsPanel />, roles: ['admin', 'empleado', 'super_admin'] }),
  ...withTenantPrefixes('/:tenant/tickets', { element: <TicketsPanel />, roles: ['admin', 'empleado', 'super_admin'] }),
  ...withTenantPrefixes('/:tenant/pedidos', { element: <SmartPedidosWrapper />, roles: ['admin', 'empleado', 'super_admin'] }),
  ...withTenantPrefixes('/:tenant/notificaciones', { element: <SmartNotificationsWrapper />, roles: ['admin', 'empleado', 'super_admin'] }),
  ...withTenantPrefixes('/:tenant/categorias', { element: <CategoryManagementPage />, roles: ['admin', 'super_admin'] }),

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
  ...withTenantPrefixes('/:tenant/integracion', { element: <IntegracionesPage />, roles: ['admin'] }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/new', { element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/:mappingId', { element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] }),


  // --- USER PORTAL ROUTES ---
  ...userPortalRoutes,
  ...tenantPortalRoutes,

  // --- GENERIC / FALLBACK ROUTES ---

  { path: '/', element: <Index /> },

  // Clean URL Support (Root Level Tenant Routes)
  // Placing these carefully to avoid conflicts, though React Router v6 is smart about specificity.
  { path: '/:tenant/productos', element: <ProductCatalog /> },
  { path: '/:tenant/cart', element: <CartPage /> },
  { path: '/:tenant/checkout-productos', element: <ProductCheckoutPage /> },
  { path: '/:tenant/pedido/confirmado', element: <OrderConfirmationPage /> },
  // Missing root integration route
  { path: '/:tenant/integracion', element: <IntegracionesPage />, roles: ['admin'] },

  // Generic Tenant Home (Dashboard/Landing) - Must be LAST among tenant routes to avoid swallowing others
  ...withTenantPrefixes('/:tenant', { element: <TenantHomePage /> }),
  { path: '/:tenant', element: <TenantHomePage /> }, // Support root level /:slug

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
  { path: '/demo/:slug', element: <DemoLandingPage /> },
  { path: '/soluciones/gobierno', element: <Navigate to="/demo/municipio" replace /> },
  { path: '/soluciones/empresas', element: <Navigate to="/demo/empresa" replace /> },
  { path: '/perfil', element: <Perfil /> },
  { path: '/perfil/pedidos', element: <Navigate to="/portal/pedidos" replace /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/chat/:ticketId', element: <TicketLookup /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/chatpos', element: <ChatPosPage /> },
  { path: '/chatcrm', element: <ChatCRMPage /> },
  { path: '/opinar', element: <OpinarArPage /> },
  { path: '/integracion', element: <Integracion />, roles: ['admin'] },
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
  { path: '/tickets', element: <TicketsPanel />, roles: ['admin', 'empleado', 'super_admin'] },
  { path: '/pedidos', element: <SmartPedidosWrapper />, roles: ['admin', 'empleado', 'super_admin'] },
  { path: '/usuarios', element: <UsuariosPage />, roles: ['admin', 'empleado', 'super_admin'] },
  { path: '/notifications', element: <NotificationSettings /> },
  { path: '/ticket', element: <TicketLookup /> },
  { path: '/ticket/:ticketId', element: <TicketLookup /> },
  { path: '/historial', element: <CustomerHistory /> },
  { path: '/presupuestos', element: <BudgetRequest /> },
  { path: '/recordatorios', element: <Reminders /> },
  { path: '/logs', element: <LogWorkbench />, roles: ['admin', 'empleado', 'super_admin'] },
  { path: '/pyme/metrics', element: <BusinessMetrics /> },
  { path: '/crm/integrations', element: <CrmIntegrations /> },
  { path: '/consultas', element: <PredefinedQueries /> },
  { path: '/403', element: <PermissionDenied /> },
  ...(FEATURE_ENCUESTAS
    ? [
        { path: '/admin/encuestas', element: <AdminSurveysIndex />, roles: ['admin', 'empleado', 'super_admin'] },
        { path: '/admin/encuestas/new', element: <NewSurveyPage />, roles: ['admin', 'empleado', 'super_admin'] },
        { path: '/admin/encuestas/:id', element: <SurveyDetailPage />, roles: ['admin', 'empleado', 'super_admin'] },
        { path: '/admin/encuestas/:id/analytics', element: <SurveyAnalyticsPage />, roles: ['admin', 'empleado', 'super_admin'] },
      ]
    : []),
  { path: '/pyme/catalog', element: <ProductCatalog />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/tramites', element: <TramitesCatalog />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/categorias', element: <CategoryManagementPage />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/usuarios', element: <InternalUsers />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/whatsapp', element: <WhatsappIntegration />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/integrations', element: <MunicipalSystems />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/surveys', element: <SatisfactionSurveys /> },
  { path: '/municipal/playbook', element: <MunicipalPlaybookPage />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/message-metrics', element: <MunicipalMessageMetrics />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/analytics', element: <EstadisticasPage />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/stats', element: <EstadisticasPage />, roles: ['admin', 'super_admin'] },
  { path: '/municipal/incidents', element: <EstadisticasPage />, roles: ['admin', 'super_admin'] },
  { path: '/estadisticas', element: <EstadisticasPage />, roles: ['admin', 'super_admin'] },
  { path: '/analytics', element: <AnalyticsPage />, roles: ['admin', 'empleado', 'super_admin'] },
  { path: '/perfil/plantillas-respuesta', element: <GestionPlantillasPage />, roles: ['admin', 'empleado', 'super_admin'] },

  { path: '/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },
  { path: '/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },
  // Rutas para la gestión de mapeo de catálogos por PYME
  { path: '/admin/pyme/:pymeId/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },
  { path: '/admin/pyme/:pymeId/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },

  { path: '/superadmin', element: <SuperAdminDashboard />, roles: ['super_admin'] },
  { path: '/empleados', element: <InternalUsers />, roles: ['admin', 'super_admin', 'tenant_admin'] },

  { path: '/iframe', element: <Iframe /> },
];

export default routes;
