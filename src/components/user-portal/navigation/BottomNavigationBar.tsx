import React, { useMemo } from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';
import { Home, ListChecks, Menu as MenuIcon, ShoppingBag } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { buildTenantPath, readCanonicalTenantSlugFromPath } from '@/utils/tenantPaths';
import type { PortalContent } from '@/types/unified';
import type { WidgetCommerceSession } from '@/types/widgetCommerce';
import type { WidgetPortalClaim, WidgetPortalOrder } from '@/utils/widgetPortal';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface BottomNavigationBarProps {
  onOpenMobileMenu?: () => void;
  portalNavigation?: {
    content: PortalContent;
    commerceSession: WidgetCommerceSession | null;
    publicClaims: WidgetPortalClaim[];
    publicOrders: WidgetPortalOrder[];
  };
}

const EMPTY_CONTENT: PortalContent = {
  notifications: [],
  events: [],
  news: [],
  catalog: [],
  activities: [],
  surveys: [],
  loyaltySummary: null,
};

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ onOpenMobileMenu, portalNavigation }) => {
  const location = useLocation();
  const routeParams = useParams();
  const { currentSlug, tenant } = useTenant();
  const content = portalNavigation?.content ?? EMPTY_CONTENT;
  const commerceSession = portalNavigation?.commerceSession ?? null;
  const publicClaims = portalNavigation?.publicClaims ?? [];
  const publicOrders = portalNavigation?.publicOrders ?? [];
  const routeTenantSlug =
    (typeof routeParams.tenant === 'string' ? routeParams.tenant : null) ||
    (typeof window !== 'undefined' ? readCanonicalTenantSlugFromPath(window.location.pathname) : null);
  const effectiveSlug = currentSlug || routeTenantSlug;
  const isMunicipio = (commerceSession?.tenant?.tipo || tenant?.tipo) === 'municipio';
  const actionLabels = commerceSession?.frontend_contract?.action_labels ?? {};
  const catalogEnabled = commerceSession?.catalog?.enabled === true || content.catalog.length > 0;
  const historyEnabled =
    publicClaims.length > 0 ||
    publicOrders.length > 0 ||
    content.activities.length > 0 ||
    Boolean(commerceSession?.history || commerceSession?.portal);

  const bottomNavItems = useMemo<NavItem[]>(
    () => [
      {
        path: buildTenantPath('/portal/dashboard', effectiveSlug),
        label: actionLabels.home || 'Inicio',
        icon: <Home className="h-5 w-5" />,
        exact: true,
      },
      ...(catalogEnabled
        ? [
            {
              path: buildTenantPath('/portal/catalogo', effectiveSlug),
              label: actionLabels.catalog || commerceSession?.catalog?.label || (isMunicipio ? 'Tramites' : 'Catalogo'),
              icon: <ShoppingBag className="h-5 w-5" />,
            },
          ]
        : []),
      ...(historyEnabled
        ? [
            {
              path: buildTenantPath(isMunicipio ? '/portal/reclamos' : '/portal/pedidos', effectiveSlug),
              label: actionLabels.history || commerceSession?.history?.label || 'Historial',
              icon: <ListChecks className="h-5 w-5" />,
            },
          ]
        : []),
    ],
    [actionLabels, catalogEnabled, commerceSession?.catalog?.label, commerceSession?.history?.label, effectiveSlug, historyEnabled, isMunicipio],
  );

  const isMoreSectionActive = () => {
    const morePaths = [
      buildTenantPath('/portal/noticias', effectiveSlug),
      buildTenantPath('/portal/eventos', effectiveSlug),
      buildTenantPath('/portal/beneficios', effectiveSlug),
      buildTenantPath('/portal/encuestas', effectiveSlug),
      buildTenantPath('/portal/cuenta', effectiveSlug),
    ];
    return morePaths.some((path) => location.pathname.startsWith(path));
  };

  const bottomButtonBaseClasses = 'flex flex-col items-center justify-center p-1 w-full h-full transition-colors duration-150';
  const moreButtonClasses = `${bottomButtonBaseClasses} ${
    isMoreSectionActive()
      ? 'text-primary scale-105 opacity-100'
      : 'text-muted-foreground hover:text-primary/90 opacity-80 hover:opacity-100'
  }`;

  return (
    <nav className="md:hidden bg-card border-t border-border shadow-t-lg fixed bottom-0 left-0 right-0 z-30 h-16">
      <ul className="flex justify-around items-center h-full max-w-full mx-auto">
        {bottomNavItems.map((item) => (
          <li key={item.path} className="flex-1 min-w-0">
            <NavLink
              to={item.path}
              end={item.exact}
              className={({ isActive }) => {
                const stateClasses = isActive
                  ? 'text-primary scale-105 opacity-100'
                  : 'text-muted-foreground hover:text-primary/90 opacity-80 hover:opacity-100';
                return `${bottomButtonBaseClasses} ${stateClasses}`;
              }}
            >
              {item.icon}
              <span className="mt-0.5 max-w-full truncate px-1 text-[0.65rem] leading-tight">{item.label}</span>
            </NavLink>
          </li>
        ))}
        <li className="flex-1 min-w-0">
          <button onClick={onOpenMobileMenu} className={moreButtonClasses}>
            <MenuIcon className="h-5 w-5" />
            <span className="mt-0.5 text-[0.65rem] leading-tight">{actionLabels.more || 'Mas'}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNavigationBar;
