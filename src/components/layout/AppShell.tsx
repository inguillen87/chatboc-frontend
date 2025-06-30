import React from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useIsMobile } from '@/hooks/use-mobile';

import DesktopNavbar from './DesktopNavbar';
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

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const isLoggedIn = !!user;

  let NavbarComponent = null;
  if (isMobile && isLoggedIn) {
    NavbarComponent = <MobileNavbar />;
  } else {
    // DesktopNavbar se mostrará en desktop (logueado o no)
    // y en móvil si el usuario NO está logueado (ej. landing, login, register).
    NavbarComponent = <DesktopNavbar />;
  }

  const mainPaddingTop = 'pt-20'; // Ajustar según altura real de DesktopNavbar si es necesario.
                                  // MobileNavbar (solo header) es h-16 (4rem). DesktopNavbar es h-12 + py-2.5 (total 4.25rem).
                                  // pt-20 (5rem) es generoso y debería cubrir ambos.
  const mainPaddingBottom = isMobile && isLoggedIn ? 'pb-16' : 'pb-0'; // pb-16 (4rem) para la TabBar

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
      {NavbarComponent}

      <main
        className={`flex-1 w-full max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 ${mainPaddingTop} ${mainPaddingBottom}`}
      >
        {children}
      </main>

      <ScrollToTopButton />
      <Footer />
    </div>
  );
};

export default AppShell;
