import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ListChecks, UserCircle, Menu as MenuIcon } from 'lucide-react'; // Usar MenuIcon para "Más"

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const bottomNavItems: NavItem[] = [
  { path: '/portal/dashboard', label: 'Inicio', icon: <Home className="h-5 w-5" />, exact: true },
  { path: '/portal/catalogo', label: 'Catálogo', icon: <ShoppingBag className="h-5 w-5" /> },
  { path: '/portal/pedidos', label: 'Gestiones', icon: <ListChecks className="h-5 w-5" /> },
  // El cuarto ítem ahora será "Más" para abrir el Sheet/SideNav
];

interface BottomNavigationBarProps {
  onOpenMobileMenu?: () => void; // Callback para abrir el menú lateral en mobile
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ onOpenMobileMenu }) => {
  const location = useLocation();

  // Función para determinar si una ruta está activa, considerando subrutas para "Más"
  const isMoreSectionActive = () => {
    const morePaths = ['/portal/noticias', '/portal/beneficios', '/portal/encuestas', '/portal/cuenta'];
    return morePaths.some(path => location.pathname.startsWith(path));
  };

  return (
    <nav className="md:hidden bg-card border-t border-border shadow-t-lg fixed bottom-0 left-0 right-0 z-30 h-16">
      <ul className="flex justify-around items-center h-full max-w-full mx-auto">
        {bottomNavItems.map((item) => (
          <li key={item.path} className="flex-1">
            <NavLink
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-1 w-full h-full transition-colors duration-150
                 ${isActive
                    ? 'text-primary scale-105 opacity-100'
                    : 'text-muted-foreground hover:text-primary/90 opacity-80 hover:opacity-100'
                 }`
              }
            >
              {item.icon}
              <span className="text-[0.65rem] mt-0.5 leading-tight">{item.label}</span>
            </NavLink>
          </li>
        ))}
        {/* Botón "Más" para abrir el menú lateral (Sheet) */}
        <li className="flex-1">
          <button
            onClick={onOpenMobileMenu}
            className={`flex flex-col items-center justify-center p-1 w-full h-full transition-colors duration-150
                       ${isMoreSectionActive()
                          ? 'text-primary scale-105 opacity-100'
                          : 'text-muted-foreground hover:text-primary/90 opacity-80 hover:opacity-100'
                       }`}
          >
            <MenuIcon className="h-5 w-5" />
            <span className="text-[0.65rem] mt-0.5 leading-tight">Más</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNavigationBar;
