import React, { useLayoutEffect } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTopButton from '../ui/ScrollToTopButton';
import DemoModeBanner from './DemoModeBanner';

const Layout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('mode') === 'embed';
  const profileTab = searchParams.get('tab');
  const isProfileTicketWorkspace =
    location.pathname.replace(/\/+$/, '') === '/perfil' &&
    profileTab === 'tickets';
  const isProfileAnalyticsWorkspace =
    location.pathname.replace(/\/+$/, '') === '/perfil' &&
    profileTab === 'analytics';
  const isProfileBackofficeWorkspace = isProfileTicketWorkspace || isProfileAnalyticsWorkspace;

  // Public navigation should land immediately at the top of the new screen.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  if (isEmbed) {
    return (
      <div className="flex flex-col min-h-screen bg-transparent">
        <main id="main-content" tabIndex={-1} className="flex-1 w-full">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
      <DemoModeBanner />
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className={
          isProfileTicketWorkspace
            ? 'mt-14 flex h-[calc(100dvh-3.5rem)] min-h-0 w-full overflow-hidden'
            : isProfileAnalyticsWorkspace
              ? 'flex-1 w-full pt-14'
            : 'flex-1 pt-20 px-4 sm:px-6 md:px-8 lg:px-16 max-w-7xl mx-auto w-full'
        }
      >
        <Outlet />
      </main>
      {!isProfileBackofficeWorkspace ? (
        <>
          <ScrollToTopButton />
          <Footer />
        </>
      ) : null}
    </div>
  );
};

export default Layout;
