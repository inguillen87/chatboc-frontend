import React from 'react';

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
import PedidosPage from '@/pages/PedidosPage';
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

// NUEVAS IMPORTACIONES PARA EL PORTAL DE USUARIO
// UserPortalLayout no se importa aquí si se usa como Layout Route en App.tsx
import UserDashboardPage from '@/pages/user-portal/UserDashboardPage';
import UserCatalogPage from '@/pages/user-portal/UserCatalogPage';
import UserOrdersPage from '@/pages/user-portal/UserOrdersPage';
// Añadir más imports a medida que se creen las páginas (Noticias, Encuestas, etc.)

export interface RouteConfig {
  path: string;
  element: React.ReactElement;
  roles?: string[]; // Roles para admin/empleado de Chatboc
  userPortal?: boolean; // Flag para rutas del portal de usuario final (cliente/vecino)
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

const routes: RouteConfig[] = [
  { path: '/', element: <Index /> },
  ...withTenantPrefixes('/:tenant', { element: <TenantHomePage /> }),
  ...withTenantPrefixes('/:tenant/noticias', { element: <TenantNewsPage /> }),
  ...withTenantPrefixes('/:tenant/eventos', { element: <TenantEventsPage /> }),
  ...withTenantPrefixes('/:tenant/market', { element: <MarketCatalogPage /> }),
  ...withTenantPrefixes('/:tenant/product/:slug', { element: <MarketProductPage /> }),
  ...withTenantPrefixes('/:tenant/checkout', { element: <MarketCheckoutPage /> }),
  ...withTenantPrefixes('/:tenant/market/blueprint', { element: <MarketplaceBlueprintPage /> }),
  ...withTenantPrefixes('/:tenant/reclamos/nuevo', { element: <TenantTicketFormPage /> }),
  ...withTenantPrefixes('/:tenant/pedido/confirmado', { element: <OrderConfirmationPage /> }),
  { path: '/login', element: <Login /> },
  ...withTenantPrefixes('/:tenant/login', { element: <Login /> }),
  ...(FEATURE_ENCUESTAS
    ? [
        { path: '/encuestas', element: <PublicSurveysIndex /> },
        { path: '/encuestas/:slug/qr', element: <SurveyQrPage /> },
        { path: '/e/:slug', element: <PublicSurveyPage /> },
        ...withTenantPrefixes('/:tenant/encuestas', { element: <TenantSurveyListPage /> }),
        ...withTenantPrefixes('/:tenant/encuestas/:slug', { element: <TenantSurveyDetailPage /> }),
      ]
    : []),
  { path: '/register', element: <Register /> },
  ...withTenantPrefixes('/:tenant/register', { element: <Register /> }),
  { path: '/user/login', element: <UserLogin /> },
  { path: '/user/register', element: <UserRegister /> },
  { path: '/cuenta', element: <UserAccount /> },
  { path: '/demo', element: <Demo /> },
  { path: '/perfil', element: <Perfil /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/chat/:ticketId', element: <TicketLookup /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/chatpos', element: <ChatPosPage /> },
  { path: '/chatcrm', element: <ChatCRMPage /> },
  { path: '/opinar', element: <OpinarArPage /> },
  { path: '/integracion', element: <Integracion />, roles: ['admin'] },
  ...withTenantPrefixes('/:tenant/integracion', { element: <Integracion />, roles: ['admin'] }),
  { path: '/documentacion', element: <Documentacion /> },
  { path: '/faqs', element: <Faqs /> },
  { path: '/productos', element: <ProductCatalog /> },
  ...withTenantPrefixes('/:tenant/productos', { element: <ProductCatalog /> }),
  { path: '/cart', element: <CartPage /> },
  ...withTenantPrefixes('/:tenant/cart', { element: <CartPage /> }),
  { path: '/market/:slug/cart', element: <MarketCartPage /> },
  { path: '/market/blueprint', element: <MarketplaceBlueprintPage /> },
  { path: '/checkout-productos', element: <ProductCheckoutPage /> },
  ...withTenantPrefixes('/:tenant/checkout-productos', { element: <ProductCheckoutPage /> }),
  ...withTenantPrefixes('/:tenant/pedido/confirmado', { element: <OrderConfirmationPage /> }),
  { path: '/pedido/confirmado', element: <OrderConfirmationPage /> },
  { path: '/legal/privacy', element: <Privacy /> },
  { path: '/legal/terms', element: <Terms /> },
  { path: '/legal/cookies', element: <Cookies /> },
  { path: '/tickets', element: <TicketsPanel />, roles: ['admin', 'empleado', 'super_admin'] },
  ...withTenantPrefixes('/:tenant/pedidos', {
    element: <PedidosPage />,
    roles: ['admin', 'empleado', 'super_admin'],
  }),
  { path: '/pedidos', element: <PedidosPage />, roles: ['admin', 'empleado', 'super_admin'] },
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
  ...withTenantPrefixes('/:tenant/catalog-mappings/new', { element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] }),
  ...withTenantPrefixes('/:tenant/catalog-mappings/:mappingId', { element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] }),
  { path: '/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },
  { path: '/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },
  // Rutas para la gestión de mapeo de catálogos por PYME
  { path: '/admin/pyme/:pymeId/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },
  { path: '/admin/pyme/:pymeId/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['admin', 'super_admin'] },

  // --- NUEVAS RUTAS PARA EL PORTAL DE USUARIO FINAL (preparadas para Layout Route en App.tsx) ---
  {
    path: '/portal/dashboard',
    element: <UserDashboardPage />,
    userPortal: true
  },
  {
    path: '/portal/catalogo',
    element: <UserCatalogPage />,
    userPortal: true
  },
  {
    path: '/portal/pedidos',
    element: <UserOrdersPage />,
    userPortal: true
  },
  // Placeholder para otras rutas del portal que añadiremos:
  // { path: '/portal/noticias', element: <UserNoticiasPage />, userPortal: true },
  // { path: '/portal/eventos', element: <UserEventosPage />, userPortal: true },
  // { path: '/portal/encuestas', element: <UserEncuestasPage />, userPortal: true },
  // { path: '/portal/beneficios', element: <UserBeneficiosPage />, userPortal: true },
  // { path: '/portal/cuenta', element: <UserCuentaPage />, userPortal: true },
  { path: '/iframe', element: <Iframe /> },
];

export default routes;
