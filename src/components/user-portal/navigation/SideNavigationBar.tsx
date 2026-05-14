import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareQuote,
  Newspaper,
  Settings2,
  ShoppingBag,
  TicketPercent,
} from 'lucide-react';

import { useUser } from '@/hooks/useUser';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { buildTenantPath } from '@/utils/tenantPaths';
import type { PortalContent } from '@/types/unified';
import type { WidgetCommerceSession } from '@/types/widgetCommerce';
import type { WidgetPortalClaim, WidgetPortalOrder } from '@/utils/widgetPortal';

interface SideNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface SideNavigationBarProps {
  onLinkClick?: () => void;
  isCollapsed?: boolean;
  onLogout?: () => void;
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

const SideNavigationBar: React.FC<SideNavigationBarProps> = ({ onLinkClick, isCollapsed = false, onLogout, portalNavigation }) => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { currentSlug, tenant } = useTenant();
  const content = portalNavigation?.content ?? EMPTY_CONTENT;
  const commerceSession = portalNavigation?.commerceSession ?? null;
  const publicClaims = portalNavigation?.publicClaims ?? [];
  const publicOrders = portalNavigation?.publicOrders ?? [];

  const isMunicipio = tenant?.tipo === 'municipio';
  const homePath = useMemo(() => buildTenantPath('/portal/dashboard', currentSlug), [currentSlug]);
  const accountPath = useMemo(() => buildTenantPath('/portal/cuenta', currentSlug), [currentSlug]);
  const tenantName = tenant?.nombre || tenant?.slug || 'Portal';
  const actionLabels = commerceSession?.frontend_contract?.action_labels ?? {};

  const catalogEnabled = commerceSession?.catalog?.enabled === true || content.catalog.length > 0;
  const benefitsEnabled = content.catalog.length > 0 || Boolean(content.loyaltySummary);
  const surveysEnabled = content.surveys.length > 0;
  const newsEnabled = content.news.length > 0 || content.notifications.length > 0;
  const eventsEnabled = content.events.length > 0;
  const historyEnabled =
    publicClaims.length > 0 ||
    publicOrders.length > 0 ||
    content.activities.length > 0 ||
    Boolean(commerceSession?.history || commerceSession?.portal);

  const mainNavItems: SideNavItem[] = useMemo(
    () => [
      {
        path: homePath,
        label: actionLabels.home || 'Inicio',
        icon: <LayoutDashboard className="h-5 w-5" />,
        exact: true,
      },
      ...(catalogEnabled
        ? [
            {
              path: buildTenantPath('/portal/catalogo', currentSlug),
              label: actionLabels.catalog || commerceSession?.catalog?.label || (isMunicipio ? 'Tramites' : 'Catalogo'),
              icon: isMunicipio ? <ClipboardList className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />,
            },
          ]
        : []),
      ...(historyEnabled
        ? [
            {
              path: buildTenantPath(isMunicipio ? '/portal/reclamos' : '/portal/pedidos', currentSlug),
              label: actionLabels.history || commerceSession?.history?.label || (isMunicipio ? 'Mis reclamos' : 'Mis pedidos'),
              icon: isMunicipio ? <AlertCircle className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />,
            },
          ]
        : []),
      ...(newsEnabled
        ? [
            {
              path: buildTenantPath('/portal/noticias', currentSlug),
              label: actionLabels.news || 'Novedades',
              icon: <Newspaper className="h-5 w-5" />,
            },
          ]
        : []),
      ...(eventsEnabled
        ? [
            {
              path: buildTenantPath('/portal/eventos', currentSlug),
              label: actionLabels.events || 'Eventos',
              icon: <CalendarDays className="h-5 w-5" />,
            },
          ]
        : []),
      ...(benefitsEnabled
        ? [
            {
              path: buildTenantPath('/portal/beneficios', currentSlug),
              label: actionLabels.benefits || 'Beneficios',
              icon: <TicketPercent className="h-5 w-5" />,
            },
          ]
        : []),
      ...(surveysEnabled
        ? [
            {
              path: buildTenantPath('/portal/encuestas', currentSlug),
              label: actionLabels.surveys || 'Encuestas',
              icon: <MessageSquareQuote className="h-5 w-5" />,
            },
          ]
        : []),
    ],
    [
      actionLabels,
      benefitsEnabled,
      catalogEnabled,
      commerceSession?.catalog?.label,
      commerceSession?.history?.label,
      currentSlug,
      eventsEnabled,
      historyEnabled,
      homePath,
      isMunicipio,
      newsEnabled,
      surveysEnabled,
    ],
  );

  const handleLogout = () => {
    safeLocalStorage.removeItem('user');
    safeLocalStorage.removeItem('authToken');
    safeLocalStorage.removeItem('chatAuthToken');
    safeLocalStorage.removeItem('entityToken');
    setUser(null);
    onLinkClick?.();

    if (onLogout) {
      onLogout();
      return;
    }

    if (user?.tenantSlug) {
      navigate(buildTenantPath('/user/login', user.tenantSlug));
    } else {
      navigate('/login');
    }
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group
     ${isCollapsed ? 'justify-center' : ''}
     ${isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
     }`;

  return (
    <div className={`flex flex-col h-full bg-card ${isCollapsed ? 'w-20 items-center' : 'w-64'} border-r border-border`}>
      <div className={`p-4 border-b border-border ${isCollapsed ? 'h-16 flex items-center justify-center' : 'h-16 flex items-center'}`}>
        {!isCollapsed ? (
          <NavLink to={homePath} className="flex min-w-0 items-center gap-2" onClick={onLinkClick}>
            <span className="truncate text-lg font-semibold text-primary">{tenantName}</span>
          </NavLink>
        ) : (
          <NavLink to={homePath} onClick={onLinkClick} title="Inicio">
            <LayoutDashboard className="h-7 w-7 text-primary" />
          </NavLink>
        )}
      </div>

      <nav className="flex-grow p-2 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={navLinkClasses}
            onClick={onLinkClick}
            title={isCollapsed ? item.label : undefined}
          >
            <span className={`text-muted-foreground group-hover:text-foreground ${isCollapsed ? '' : 'mr-3'}`}>{item.icon}</span>
            {!isCollapsed && item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-border mt-auto space-y-1">
        <NavLink
          to={accountPath}
          className={navLinkClasses}
          onClick={onLinkClick}
          title={isCollapsed ? 'Cuenta' : undefined}
        >
          <span className={`text-muted-foreground group-hover:text-foreground ${isCollapsed ? '' : 'mr-3'}`}>
            <Settings2 className="h-5 w-5" />
          </span>
          {!isCollapsed && (actionLabels.account || 'Cuenta')}
        </NavLink>
        {user ? (
          <button
            onClick={handleLogout}
            className={`flex items-center w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group
                     text-destructive hover:bg-destructive/10 focus:bg-destructive/10
                     ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Cerrar sesion' : undefined}
          >
            <span className={`text-destructive ${isCollapsed ? '' : 'mr-3'}`}><LogOut className="h-5 w-5" /></span>
            {!isCollapsed && 'Cerrar sesion'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default SideNavigationBar;
