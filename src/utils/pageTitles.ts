import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';

export const SITE_BRAND = 'Chatboc';
export const LANDING_TITLE = 'Chatboc · Agentes IA con tu marca para gobiernos y empresas';
export const LANDING_DESCRIPTION =
  'Agentes IA marca blanca para gobiernos, municipios y empresas. Atendé por web y WhatsApp, gestioná reclamos, encuestas y pedidos desde un mismo CRM.';

export function formatPlatformTitle(section?: string | null): string {
  const cleanSection = section?.trim();
  if (!cleanSection) return LANDING_TITLE;
  return `${cleanSection} · ${SITE_BRAND}`;
}

export function formatTenantTitle(organizationName: string, section?: string | null): string {
  const cleanName = organizationName.trim();
  const cleanSection = section?.trim();
  if (!cleanName) return cleanSection ? formatPlatformTitle(cleanSection) : LANDING_TITLE;
  return cleanSection ? `${cleanName} · ${cleanSection}` : cleanName;
}

const normalizePathname = (pathname: string): string => {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.replace(/\/+$/, '') || '/';
};

export function extractTenantRouteInfo(pathname: string): { slug: string; restPath: string } | null {
  const normalized = normalizePathname(pathname);
  const canonicalMatch = /^\/t\/([^/]+)(\/.*)?$/i.exec(normalized);
  if (canonicalMatch) {
    try {
      const slug = decodeURIComponent(canonicalMatch[1]).trim().toLowerCase();
      if (!slug || slug === 'chat') return null;
      return { slug, restPath: normalizePathname(canonicalMatch[2] || '/') };
    } catch {
      return null;
    }
  }

  const legacyPortalMatch = /^\/([^/]+)(\/portal(?:\/.*)?)$/i.exec(normalized);
  if (legacyPortalMatch) {
    try {
      const slug = decodeURIComponent(legacyPortalMatch[1]).trim().toLowerCase();
      if (!slug || slug === 't' || slug === 'portal') return null;
      return { slug, restPath: normalizePathname(legacyPortalMatch[2]) };
    } catch {
      return null;
    }
  }

  return null;
}

export function isTenantShellManagedPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized === '/noticias/eventos' || normalized === '/municipio/reclamos/nuevo') {
    return true;
  }
  const info = extractTenantRouteInfo(normalized);
  if (!info) return false;
  const rest = info.restPath.toLowerCase();
  return (
    rest === '/' ||
    rest === '/noticias' ||
    rest === '/eventos' ||
    rest === '/reclamos/nuevo' ||
    rest === '/encuestas' ||
    /^\/encuestas\/[^/]+$/.test(rest)
  );
}

/** A tenant's own store (catalog, product, cart, checkout) on the shared host. */
export function isTenantStorefrontPath(pathname: string): boolean {
  const info = extractTenantRouteInfo(normalizePathname(pathname));
  if (!info) return false;
  const rest = info.restPath.toLowerCase();
  return /^\/(?:market(?:\/(?!blueprint(?:\/|$))[^/]+)*|cart|checkout)\/?$/.test(rest);
}

export function isSelfManagedMetadataPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname).toLowerCase();
  return (
    normalized === '/encuestas' ||
    normalized === '/noticias/encuestas' ||
    /^\/e\/[^/]+$/.test(normalized) ||
    /^\/encuestas\/[^/]+\/qr$/.test(normalized) ||
    isDisabilityAIAgentDemoPath(normalized)
  );
}

const PORTAL_SECTION_TITLES: Record<string, string> = {
  '/portal/dashboard': 'Portal',
  '/portal/catalogo': 'Catálogo',
  '/portal/pedidos': 'Pedidos',
  '/portal/reclamos': 'Reclamos',
  '/portal/noticias': 'Noticias',
  '/portal/eventos': 'Eventos',
  '/portal/beneficios': 'Beneficios',
  '/portal/encuestas': 'Encuestas',
  '/portal/cuenta': 'Mi cuenta',
};

export function resolveTenantRouteSection(pathname: string): string | null {
  const normalized = normalizePathname(pathname);
  const info = extractTenantRouteInfo(normalized);
  const rest = (info ? info.restPath : normalized).toLowerCase();

  if (rest in PORTAL_SECTION_TITLES) {
    return PORTAL_SECTION_TITLES[rest];
  }
  if (rest === '/') return 'Portal';
  if (rest === '/noticias') return 'Noticias';
  if (rest === '/eventos') return 'Eventos';
  if (rest === '/encuestas' || /^\/encuestas\/[^/]+$/.test(rest)) return 'Encuestas';
  if (rest === '/reclamos/nuevo') return 'Nuevo reclamo';
  if (rest === '/market' || rest === '/productos' || /^\/product\/[^/]+$/.test(rest)) return 'Catálogo';
  if (rest === '/cart') return 'Carrito';
  if (rest === '/checkout' || rest === '/checkout-productos') return 'Compra';
  if (rest === '/pedido/confirmado') return 'Pedido confirmado';
  if (rest === '/login' || rest === '/user/login') return 'Ingresar';
  if (rest === '/register' || rest === '/user/register') return 'Crear cuenta';
  if (
    rest === '/tickets' ||
    rest === '/tickets/board' ||
    rest === '/reclamos' ||
    rest === '/inbox' ||
    rest === '/integracion' ||
    rest === '/estadisticas' ||
    rest === '/analytics' ||
    rest === '/analytics/operations' ||
    rest === '/pedidos' ||
    rest === '/notificaciones' ||
    rest === '/categorias' ||
    rest.startsWith('/crm/') ||
    rest.startsWith('/admin/') ||
    rest.startsWith('/catalog-mappings/') ||
    rest.startsWith('/perfil/') ||
    rest.startsWith('/educacion/staff/')
  ) {
    return 'Panel';
  }
  return null;
}

const PROFILE_TAB_TITLES: Record<string, string> = {
  tickets: 'Tickets',
  usuarios: 'CRM',
  analytics: 'Analíticas',
  stats: 'Estadísticas',
  catalogo: 'Catálogo',
  pedidos: 'Pedidos',
  encuestas: 'Encuestas',
  conocimiento: 'Base de conocimiento',
  integracion: 'Integraciones',
};

export function resolvePlatformRouteTitle(pathname: string, search = ''): string | null {
  const normalized = normalizePathname(pathname);
  const lower = normalized.toLowerCase();

  if (lower === '/') return LANDING_TITLE;
  if (lower in PORTAL_SECTION_TITLES) {
    return formatPlatformTitle(PORTAL_SECTION_TITLES[lower]);
  }
  if (lower === '/welcome' || /^\/[^/]+\/welcome$/.test(lower)) {
    return formatPlatformTitle('Portal');
  }
  if (lower === '/demo' || /^\/demo\/[^/]+$/.test(lower)) return formatPlatformTitle('Demo');
  if (lower.startsWith('/demo-catalogs/')) return formatPlatformTitle('Catálogos demo');
  if (lower === '/login' || lower === '/user/login') return formatPlatformTitle('Ingresar');
  if (lower === '/register' || lower === '/user/register') return formatPlatformTitle('Crear cuenta');
  if (lower === '/sso-callback' || lower === '/auth/sso-callback') return formatPlatformTitle('Verificando acceso');
  if (lower === '/cuenta') return formatPlatformTitle('Mi cuenta');
  if (lower === '/documentacion') return formatPlatformTitle('Documentación');
  if (lower === '/faqs') return formatPlatformTitle('Preguntas frecuentes');
  if (lower === '/privacidad' || lower === '/legal/privacy') return formatPlatformTitle('Política de privacidad');
  if (lower === '/terminos' || lower === '/legal/terms') return formatPlatformTitle('Términos y condiciones');
  if (lower === '/legal/cookies') return formatPlatformTitle('Política de cookies');
  if (lower === '/eliminacion-datos' || lower === '/legal/data-deletion') {
    return formatPlatformTitle('Eliminación de datos');
  }
  if (lower === '/encuestas' || lower === '/noticias/encuestas') {
    return formatPlatformTitle('Encuestas ciudadanas');
  }
  if (lower === '/tracking' || lower === '/tracking/claim' || lower.startsWith('/tracking/claim/')) {
    return formatPlatformTitle('Seguimiento de reclamos');
  }
  if (
    lower === '/tracking/order' ||
    lower.startsWith('/tracking/order/') ||
    lower.startsWith('/pyme/pedidos/')
  ) {
    return formatPlatformTitle('Seguimiento de pedidos');
  }
  if (lower === '/ticket' || lower.startsWith('/ticket/') || lower.startsWith('/chat/')) {
    return formatPlatformTitle('Seguimiento de consulta');
  }
  if (lower === '/chat') return formatPlatformTitle('Chat');
  if (lower === '/checkout') return formatPlatformTitle('Contratación');
  if (lower === '/chatpos') return formatPlatformTitle('ChatPOS');
  if (lower === '/chatcrm') return formatPlatformTitle('ChatCRM');
  if (lower === '/opinar') return formatPlatformTitle('Opinar');
  if (lower === '/superadmin' || lower === '/admin/tenants') return formatPlatformTitle('Administración');
  if (lower === '/perfil') {
    const tab = new URLSearchParams(search).get('tab')?.trim().toLowerCase() || '';
    return formatPlatformTitle(PROFILE_TAB_TITLES[tab] ?? 'Panel');
  }
  if (lower === '/perfil/plantillas-respuesta') return formatPlatformTitle('Plantillas de respuesta');
  if (lower === '/tickets' || lower === '/tickets/board') return formatPlatformTitle('Tickets');
  if (lower === '/pedidos') return formatPlatformTitle('Pedidos');
  if (lower === '/notificaciones' || lower === '/notifications') return formatPlatformTitle('Notificaciones');
  if (lower === '/usuarios' || lower === '/empleados' || lower === '/municipal/usuarios') {
    return formatPlatformTitle('Equipo');
  }
  if (
    lower === '/integracion' ||
    lower === '/integracion/whatsapp/connect' ||
    lower === '/municipal/whatsapp' ||
    lower === '/crm/integrations' ||
    lower === '/municipal/integrations'
  ) {
    return formatPlatformTitle('Integraciones');
  }
  if (lower === '/integracion/meta/credenciales') return formatPlatformTitle('Credenciales de Meta');
  if (lower === '/admin/knowledge') return formatPlatformTitle('Base de conocimiento');
  if (lower === '/implementacion') return formatPlatformTitle('Implementación');
  if (lower === '/bot-settings') return formatPlatformTitle('Configuración del agente');
  if (
    lower === '/estadisticas' ||
    lower === '/municipal/analytics' ||
    lower === '/municipal/stats' ||
    lower === '/municipal/incidents' ||
    lower === '/municipal/message-metrics' ||
    lower === '/pyme/metrics'
  ) {
    return formatPlatformTitle('Estadísticas');
  }
  if (lower === '/analytics' || lower === '/analytics/hub' || lower === '/analytics/operations') {
    return formatPlatformTitle('Analíticas');
  }
  if (
    lower === '/admin/encuestas' ||
    lower.startsWith('/admin/encuestas/') ||
    lower === '/surveys' ||
    lower === '/municipal/surveys'
  ) {
    return formatPlatformTitle('Encuestas');
  }
  if (
    lower === '/admin/catalog' ||
    lower === '/pyme/catalog' ||
    lower.startsWith('/catalog-mappings/') ||
    lower.includes('/catalog-mappings/')
  ) {
    return formatPlatformTitle('Catálogo');
  }
  if (lower === '/productos') return formatPlatformTitle('Productos');
  if (lower === '/cart') return formatPlatformTitle('Carrito');
  if (lower === '/checkout-productos') return formatPlatformTitle('Finalizar compra');
  if (lower === '/pedido/confirmado') return formatPlatformTitle('Pedido confirmado');
  if (lower === '/municipal/tramites') return formatPlatformTitle('Trámites');
  if (lower === '/municipal/categorias') return formatPlatformTitle('Categorías');
  if (lower === '/municipal/playbook') return formatPlatformTitle('Manual operativo');
  if (lower === '/logs') return formatPlatformTitle('Registros');
  if (lower === '/enterprise') return formatPlatformTitle('Operaciones');
  if (lower === '/historial') return formatPlatformTitle('Historial');
  if (lower === '/presupuestos') return formatPlatformTitle('Presupuestos');
  if (lower === '/recordatorios') return formatPlatformTitle('Recordatorios');
  if (lower === '/consultas') return formatPlatformTitle('Consultas frecuentes');
  if (lower === '/educacion' || lower.startsWith('/educacion/')) return formatPlatformTitle('Educación');
  if (lower === '/403') return formatPlatformTitle('Acceso restringido');
  if (lower === '/iframe') return formatPlatformTitle('Widget de chat');

  return null;
}
