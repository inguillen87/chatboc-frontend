import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, ListChecks, Newspaper, CalendarDays,
  TicketPercent, MessageSquareQuote, Settings2, LogOut, ClipboardList, AlertCircle
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface SideNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const accountNavItems: SideNavItem[] = [
  { path: '/portal/cuenta', label: 'Mi Cuenta', icon: <Settings2 className="h-5 w-5" /> },
];

interface SideNavigationBarProps {
  onLinkClick?: () => void;
  isCollapsed?: boolean;
  onLogout?: () => void;
}

const SideNavigationBar: React.FC<SideNavigationBarProps> = ({ onLinkClick, isCollapsed = false, onLogout }) => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { tenant } = useTenant();

  const isMunicipio = tenant?.tipo === 'municipio';

  const mainNavItems: SideNavItem[] = useMemo(() => [
    {
      path: '/portal/dashboard',
      label: 'Inicio',
      icon: <LayoutDashboard className="h-5 w-5" />,
      exact: true
    },
    {
      path: '/portal/catalogo',
      label: isMunicipio ? 'Trámites' : 'Catálogo',
      icon: isMunicipio ? <ClipboardList className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />
    },
    {
      path: isMunicipio ? '/portal/reclamos' : '/portal/pedidos',
      label: isMunicipio ? 'Mis Reclamos' : 'Mis Pedidos',
      icon: isMunicipio ? <AlertCircle className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />
    },
    {
      path: '/portal/noticias',
      label: 'Novedades',
      icon: <Newspaper className="h-5 w-5" />
    },
    {
      path: '/portal/eventos',
      label: 'Eventos',
      icon: <CalendarDays className="h-5 w-5" />
    },
    {
      path: '/portal/beneficios',
      label: 'Beneficios',
      icon: <TicketPercent className="h-5 w-5" />
    },
    {
      path: '/portal/encuestas',
      label: 'Encuestas',
      icon: <MessageSquareQuote className="h-5 w-5" />
    },
  ], [isMunicipio]);

  const handleLogout = () => {
    // Clear tokens and user data
    safeLocalStorage.removeItem('user');
    safeLocalStorage.removeItem('authToken');
    safeLocalStorage.removeItem('chatAuthToken');
    safeLocalStorage.removeItem('entityToken');

    // Update context
    setUser(null);

    if (onLinkClick) onLinkClick();

    // Redirect based on tenant context
    if (user?.tenantSlug) {
      navigate(`/${user.tenantSlug}/user/login`);
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
        {!isCollapsed && (
          <NavLink to="/portal/dashboard" className="flex items-center gap-2" onClick={onLinkClick}>
            {/* Placeholder para Logo de Org. Se tomará del layout principal o contexto */}
            <span className="text-lg font-semibold text-primary">Mi Portal</span>
          </NavLink>
        )}
        {isCollapsed && (
          <NavLink to="/portal/dashboard" onClick={onLinkClick} title="Inicio">
            <LayoutDashboard className="h-7 w-7 text-primary" />
          </NavLink>
        )}
      </div>

      <nav className="flex-grow p-2 space-y-1 overflow-y-auto"> {/* Ajustado padding */}
        {mainNavItems.map(item => (
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

      <div className="p-2 border-t border-border mt-auto space-y-1"> {/* Ajustado padding */}
        {accountNavItems.map(item => (
           <NavLink
            key={item.path}
            to={item.path}
            className={navLinkClasses}
            onClick={onLinkClick}
            title={isCollapsed ? item.label : undefined}
          >
            <span className={`text-muted-foreground group-hover:text-foreground ${isCollapsed ? '' : 'mr-3'}`}>{item.icon}</span>
            {!isCollapsed && item.label}
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className={`flex items-center w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group
                     text-destructive hover:bg-destructive/10 focus:bg-destructive/10
                     ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <span className={`text-destructive ${isCollapsed ? '' : 'mr-3'}`}><LogOut className="h-5 w-5" /></span>
          {!isCollapsed && "Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
};

export default SideNavigationBar;
