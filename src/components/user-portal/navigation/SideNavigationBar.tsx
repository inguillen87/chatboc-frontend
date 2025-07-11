import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, ListChecks, Newspaper, Gift, MessageSquareQuote, Settings2, LogOut } from 'lucide-react'; // Ejemplos

interface SideNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

// TODO: Definir rutas y etiquetas finales
const sideNavItems: SideNavItem[] = [
  { path: '/portal/dashboard', label: 'Inicio', icon: <LayoutDashboard className="h-5 w-5" /> },
  { path: '/portal/catalogo', label: 'Catálogo', icon: <ShoppingBag className="h-5 w-5" /> },
  { path: '/portal/pedidos', label: 'Mis Pedidos', icon: <ListChecks className="h-5 w-5" /> },
  { path: '/portal/noticias', label: 'Noticias/Eventos', icon: <Newspaper className="h-5 w-5" /> },
  { path: '/portal/beneficios', label: 'Beneficios', icon: <Gift className="h-5 w-5" /> },
  { path: '/portal/encuestas', label: 'Encuestas', icon: <MessageSquareQuote className="h-5 w-5" /> },
];

const accountNavItems: SideNavItem[] = [
  { path: '/portal/cuenta', label: 'Mi Cuenta', icon: <Settings2 className="h-5 w-5" /> },
  // TODO: Implementar función de logout
  { path: '/logout', label: 'Cerrar Sesión', icon: <LogOut className="h-5 w-5" /> },
];

const SideNavigationBar = () => {
  // TODO: Añadir lógica para colapsar/expandir el menú si se desea
  const isCollapsed = false; // Placeholder

  return (
    <aside className={`hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-4 border-b border-border">
        {/* Placeholder para el Logo de la Org o nombre del Portal */}
        <h2 className={`text-xl font-semibold text-primary ${isCollapsed ? 'hidden' : 'block'}`}>Portal Usuario</h2>
        {isCollapsed && <LayoutDashboard className="h-6 w-6 mx-auto text-primary" /> }
      </div>
      <nav className="flex-grow p-3 space-y-1">
        {sideNavItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150
               ${isCollapsed ? 'justify-center' : ''}
               ${isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
            }
            title={isCollapsed ? item.label : undefined}
          >
            {item.icon}
            {!isCollapsed && <span className="ml-3">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-border mt-auto space-y-1">
        {accountNavItems.map(item => (
           <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150
               ${isCollapsed ? 'justify-center' : ''}
               ${isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
            }
            title={isCollapsed ? item.label : undefined}
          >
            {item.icon}
            {!isCollapsed && <span className="ml-3">{item.label}</span>}
          </NavLink>
        ))}
      </div>
    </aside>
  );
};

export default SideNavigationBar;
