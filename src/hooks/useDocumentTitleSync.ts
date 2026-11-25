import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useTenant } from '@/context/TenantContext';
import { usePrivateWorkspacePresentation } from '@/hooks/usePrivateWorkspacePresentation';
import {
  extractTenantRouteInfo,
  formatTenantTitle,
  isSelfManagedMetadataPath,
  isTenantShellManagedPath,
  resolvePlatformRouteTitle,
  resolveTenantRouteSection,
} from '@/utils/pageTitles';

export function useDocumentTitleSync(options?: { portalOnly?: boolean }) {
  const location = useLocation();
  const { tenant, currentSlug, isLoadingTenant, tenantError, hostBinding } = useTenant();
  const privateShell = usePrivateWorkspacePresentation();
  const portalOnly = Boolean(options?.portalOnly);

  useLayoutEffect(() => {
    const pathname = location.pathname;
    const search = location.search;

    // En dominios propios de una organización nunca escribimos el nombre de la plataforma.
    if (hostBinding) {
      if (isTenantShellManagedPath(pathname) || isSelfManagedMetadataPath(pathname)) {
        return;
      }
      if (!portalOnly && privateShell.active) {
        document.title = formatTenantTitle(hostBinding.identity.name, 'Panel');
        return;
      }
      const section = resolveTenantRouteSection(pathname) ?? 'Portal';
      document.title = formatTenantTitle(hostBinding.identity.name, section);
      return;
    }

    // Dentro del panel privado con tenant verificado, PrivateWorkspaceBrand fija «<Organización> · Panel».
    if (!portalOnly && privateShell.active) {
      return;
    }

    // Rutas con espacio público o de organización en la URL (/t/:slug/... o /:slug/portal/...).
    const tenantRoute = extractTenantRouteInfo(pathname);
    if (tenantRoute) {
      if (isTenantShellManagedPath(pathname)) {
        return;
      }
      const resolvedSlug = tenant?.slug?.trim().toLowerCase() || null;
      const contextSlug = currentSlug?.trim().toLowerCase() || null;
      const orgName = tenant?.nombre?.trim() || null;
      const isAuthoritative =
        !isLoadingTenant &&
        !tenantError &&
        Boolean(orgName) &&
        resolvedSlug !== null &&
        resolvedSlug !== 'default' &&
        resolvedSlug === tenantRoute.slug &&
        contextSlug === tenantRoute.slug;

      if (isAuthoritative && orgName) {
        const section = resolveTenantRouteSection(pathname) ?? 'Portal';
        document.title = formatTenantTitle(orgName, section);
      }
      return;
    }

    // Páginas que administran sus propios metadatos con usePageMetadata.
    if (isSelfManagedMetadataPath(pathname)) {
      return;
    }

    // En el portal (/portal/...) si hay una organización activa y resuelta (por sesión o contexto),
    // priorizamos marca blanca; si no, usamos el título de plataforma.
    if (pathname.toLowerCase().startsWith('/portal/')) {
      const resolvedSlug = tenant?.slug?.trim().toLowerCase() || null;
      const orgName = tenant?.nombre?.trim() || null;
      if (
        !isLoadingTenant &&
        !tenantError &&
        orgName &&
        resolvedSlug &&
        resolvedSlug !== 'default'
      ) {
        const section = resolveTenantRouteSection(pathname) ?? 'Portal';
        document.title = formatTenantTitle(orgName, section);
        return;
      }
    }

    const nextTitle = resolvePlatformRouteTitle(pathname, search);
    if (nextTitle) {
      document.title = nextTitle;
    }
  }, [
    currentSlug,
    hostBinding,
    isLoadingTenant,
    location.pathname,
    location.search,
    portalOnly,
    privateShell.active,
    tenant?.nombre,
    tenant?.slug,
    tenantError,
  ]);
}

export default useDocumentTitleSync;
