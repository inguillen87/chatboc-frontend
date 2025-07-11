import React from 'react';
import { Home, ShoppingBag, ListChecks, UserCircle } from 'lucide-react'; // Ejemplos de iconos
import { NavLink } from 'react-router-dom'; // Asumiendo react-router-dom

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

// TODO: Las rutas exactas y los iconos se definirán según las secciones finales del portal
const navItems: NavItem[] = [
  { path: '/portal/dashboard', label: 'Inicio', icon: <Home className="h-6 w-6" /> },
  { path: '/portal/catalogo', label: 'Catálogo', icon: <ShoppingBag className="h-6 w-6" /> },
  { path: '/portal/pedidos', label: 'Mis Pedidos', icon: <ListChecks className="h-6 w-6" /> },
  { path: '/portal/cuenta', label: 'Mi Cuenta', icon: <UserCircle className="h-6 w-6" /> }, // Ejemplo, podría ser un menú "Más"
];

const BottomNavigationBar = () => {
  return (
    <nav className="md:hidden bg-card border-t border-border shadow-t-lg fixed bottom-0 left-0 right-0 z-50 h-16">
      <div className="container mx-auto h-full">
        <ul className="flex justify-around items-center h-full">
          {navItems.map((item) => (
            <li key={item.path} className="flex-1">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center p-2 rounded-md transition-colors duration-150
                   ${isActive ? 'text-primary scale-105' : 'text-muted-foreground hover:text-primary/80'}`
                }
              >
                {item.icon}
                <span className="text-xs mt-0.5">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default BottomNavigationBar;
