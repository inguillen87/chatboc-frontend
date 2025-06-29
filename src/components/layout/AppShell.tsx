<<<<<<< SEARCH
=======
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useIsMobile } from '@/hooks/use-mobile';

import DesktopNavbar from './Navbar'; // Renombrado para claridad
import MobileNavbar from './MobileNavbar';
import Footer from './Footer';
import ScrollToTopButton from '../ui/ScrollToTopButton';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useUser();
  const isMobile = useIsMobile();

  // Scroll al top cada vez que cambias de ruta
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const isLoggedIn = !!user;

  // Determinar qué Navbar mostrar
  let NavbarComponent = null;
  if (isMobile && isLoggedIn) {
    NavbarComponent = <MobileNavbar />;
  } else {
    // DesktopNavbar se mostrará en desktop (logueado o no)
    // y en móvil si el usuario NO está logueado (ej. landing, login, register).
    NavbarComponent = <DesktopNavbar />;
  }

  // Ajustar padding del contenido principal basado en si MobileNavbar (con TabBar) está activa
  // MobileNavbar tiene header (aprox 4rem/h-16) y TabBar (aprox 4rem/h-16)
  // DesktopNavbar tiene header (aprox 3.5rem/h-14 o h-16 con py-2.5)

  // Padding top: Si es mobile y logueado (MobileNavbar), pt-16. Sino (DesktopNavbar), pt-[calc(3.5rem+1px)] o similar.
  // El DesktopNavbar actualmente tiene h-12 + py-2.5 = 3rem + 0.625rem*2 = 4.25rem (aprox h-16/pt-16)
  // El MobileNavbar (solo header) es h-16.
  // Así que pt-16 (4rem) o pt-[calc(theme(height.16)+1px)] podría funcionar para ambos.
  // O podemos hacer el header de MobileNavbar de la misma altura que DesktopNavbar.
  // Por ahora, mantenemos el pt-20 original del Layout y el MobileNavbar se superpone.
  // El Layout original tenía pt-20 (5rem), que es bastante.
  // El DesktopNavbar tiene h-12 (3rem) + py-2.5 (0.625rem * 2 = 1.25rem) = 4.25rem.
  // El MobileNavbar tiene h-16 (4rem).

  // Para simplificar, el Layout principal (AppShell) definirá el padding general.
  // El pt-16 (4rem) debería ser suficiente para el header de MobileNavbar.
  // El pb-16 (4rem) es para la TabBar de MobileNavbar.

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
      {NavbarComponent}

      <main
        className={`flex-1 w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8
                    pt-20 pb-0
                    ${isMobile && isLoggedIn ? 'pb-16' : ''}`}
      >
        {children}
      </main>

      <ScrollToTopButton />
      <Footer />
    </div>
  );
};

export default AppShell;
>>>>>>> REPLACE
