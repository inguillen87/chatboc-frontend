import React, { useEffect } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTopButton from '../ui/ScrollToTopButton';

const Layout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('mode') === 'embed';

  // Scroll al top cada vez que cambias de ruta
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  if (isEmbed) {
    return (
      <div className="flex flex-col min-h-screen bg-transparent">
        <main className="flex-1 w-full">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
      <Navbar />
      <main className="flex-1 pt-20 px-4 sm:px-6 md:px-8 lg:px-16 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
      <ScrollToTopButton />
      <Footer />
    </div>
  );
};

export default Layout;
