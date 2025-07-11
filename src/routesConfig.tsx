import React from 'react';

// ... (importaciones existentes) ...
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
import ProductCatalog from '@/pages/ProductCatalog';
import MunicipalStats from '@/pages/MunicipalStats';
import IncidentsMap from '@/pages/IncidentsMap';
import MunicipalAnalytics from '@/pages/MunicipalAnalytics';
import MunicipalMessageMetrics from '@/pages/MunicipalMessageMetrics';
import NotificationSettings from '@/pages/NotificationSettings';
import TramitesCatalog from '@/pages/TramitesCatalog';
import InternalUsers from '@/pages/InternalUsers';
import WhatsappIntegration from '@/pages/WhatsappIntegration';
import MunicipalSystems from '@/pages/MunicipalSystems';
import SatisfactionSurveys from '@/pages/SatisfactionSurveys';
import TicketLookup from '@/pages/TicketLookup';
import CustomerHistory from '@/pages/CustomerHistory';
import BudgetRequest from '@/pages/BudgetRequest';
import Reminders from '@/pages/Reminders';
import BusinessMetrics from '@/pages/BusinessMetrics';
import CrmIntegrations from '@/pages/CrmIntegrations';
import PredefinedQueries from '@/pages/PredefinedQueries';
import PermissionDenied from '@/pages/PermissionDenied';
import CartPage from '@/pages/Cart';
import ProductCheckoutPage from '@/pages/ProductCheckoutPage';
import GestionPlantillasPage from '@/pages/GestionPlantillasPage';
import CatalogMappingPage from '@/pages/admin/CatalogMappingPage';

// NUEVAS IMPORTACIONES PARA EL PORTAL DE USUARIO
import UserPortalLayout from '@/components/user-portal/layout/UserPortalLayout';
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

const routes: RouteConfig[] = [
  { path: '/', element: <Index /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/user/login', element: <UserLogin /> },
  { path: '/user/register', element: <UserRegister /> },
  { path: '/cuenta', element: <UserAccount /> },
  { path: '/demo', element: <Demo /> },
  { path: '/perfil', element: <Perfil /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/checkout', element: <Checkout /> },
  { path: '/chatpos', element: <ChatPosPage /> },
  { path: '/chatcrm', element: <ChatCRMPage /> },
  { path: '/integracion', element: <Integracion /> },
  { path: '/documentacion', element: <Documentacion /> },
  { path: '/faqs', element: <Faqs /> },
  { path: '/cart', element: <CartPage /> },
  { path: '/checkout-productos', element: <ProductCheckoutPage /> },
  { path: '/legal/privacy', element: <Privacy /> },
  { path: '/legal/terms', element: <Terms /> },
  { path: '/legal/cookies', element: <Cookies /> },
  { path: '/tickets', element: <TicketsPanel />, roles: ['admin', 'empleado'] },
  { path: '/pedidos', element: <PedidosPage />, roles: ['admin', 'empleado'] },
  { path: '/usuarios', element: <UsuariosPage />, roles: ['admin', 'empleado'] },
  { path: '/notifications', element: <NotificationSettings /> },
  { path: '/ticket', element: <TicketLookup /> },
  { path: '/historial', element: <CustomerHistory /> },
  { path: '/presupuestos', element: <BudgetRequest /> },
  { path: '/recordatorios', element: <Reminders /> },
  { path: '/pyme/metrics', element: <BusinessMetrics /> },
  { path: '/crm/integrations', element: <CrmIntegrations /> },
  { path: '/consultas', element: <PredefinedQueries /> },
  { path: '/403', element: <PermissionDenied /> },
  { path: '/pyme/catalog', element: <ProductCatalog />, roles: ['admin'] },
  { path: '/municipal/tramites', element: <TramitesCatalog />, roles: ['admin'] },
  { path: '/municipal/usuarios', element: <InternalUsers />, roles: ['admin'] },
  { path: '/municipal/whatsapp', element: <WhatsappIntegration />, roles: ['admin'] },
  { path: '/municipal/integrations', element: <MunicipalSystems />, roles: ['admin'] },
  { path: '/municipal/surveys', element: <SatisfactionSurveys /> },
  { path: '/municipal/message-metrics', element: <MunicipalMessageMetrics />, roles: ['admin'] },
  { path: '/municipal/analytics', element: <MunicipalAnalytics />, roles: ['admin'] },
  { path: '/municipal/stats', element: <MunicipalStats />, roles: ['admin'] },
  { path: '/municipal/incidents', element: <IncidentsMap />, roles: ['admin'] },
  { path: '/perfil/plantillas-respuesta', element: <GestionPlantillasPage />, roles: ['admin', 'empleado'] },
  // Rutas para la gestión de mapeo de catálogos por PYME
  { path: '/admin/pyme/:pymeId/catalog-mappings/new', element: <CatalogMappingPage />, roles: ['admin'] },
  { path: '/admin/pyme/:pymeId/catalog-mappings/:mappingId', element: <CatalogMappingPage />, roles: ['admin'] },

  // --- NUEVAS RUTAS PARA EL PORTAL DE USUARIO FINAL ---
  // Estas rutas estarán anidadas dentro de UserPortalLayout en App.tsx o donde se rendericen las rutas.
  // Por ahora, las defino aquí para tener la configuración.
  // El UserPortalLayout se aplicaría a un grupo de rutas con path="/portal".
  // Considerar que estas rutas deben ser protegidas para usuarios logueados (clientes/vecinos).
  {
    path: '/portal/dashboard',
    element: <UserPortalLayout><UserDashboardPage /></UserPortalLayout>,
    userPortal: true // Indica que es una ruta del portal de usuario final
  },
  {
    path: '/portal/catalogo',
    element: <UserPortalLayout><UserCatalogPage /></UserPortalLayout>,
    userPortal: true
  },
  {
    path: '/portal/pedidos', // o /portal/reclamos, /portal/tramites según contexto
    element: <UserPortalLayout><UserOrdersPage /></UserPortalLayout>,
    userPortal: true
  },
  // Placeholder para otras rutas del portal que añadiremos:
  // { path: '/portal/noticias', element: <UserPortalLayout><UserNoticiasPage /></UserPortalLayout>, userPortal: true },
  // { path: '/portal/eventos', element: <UserPortalLayout><UserEventosPage /></UserPortalLayout>, userPortal: true },
  // { path: '/portal/encuestas', element: <UserPortalLayout><UserEncuestasPage /></UserPortalLayout>, userPortal: true },
  // { path: '/portal/beneficios', element: <UserPortalLayout><UserBeneficiosPage /></UserPortalLayout>, userPortal: true },
  // { path: '/portal/cuenta', element: <UserPortalLayout><UserCuentaPage /></UserPortalLayout>, userPortal: true },
];

export default routes;
