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
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isProfileTicketWorkspace =
    normalizedPath === '/perfil' &&
    profileTab === 'tickets';
  const isTenantTicketWorkspace =
    /^\/t\/[^/]+\/(?:reclamos|tickets|inbox)$/i.test(normalizedPath);
  const isTicketWorkspace = isProfileTicketWorkspace || isTenantTicketWorkspace;
  const isProfileAnalyticsWorkspace =
    normalizedPath === '/perfil' &&
    profileTab === 'analytics';
  const isProfileWorkspace = normalizedPath === '/perfil';
  const isPublicSurveyExperience = /^\/e\/[^/]+$/i.test(normalizedPath);
  const isDemoExperience = normalizedPath === '/demo';
  const isFocusedPublicExperience = isDemoExperience || isPublicSurveyExperience;
  const isFooterlessWorkspace = isTicketWorkspace || isProfileWorkspace || isFocusedPublicExperience;

  // Public navigation should land immediately at the top of the new screen.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  useLayoutEffect(() => {
    if (!isTicketWorkspace) return;

    const rootStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousStyles = {
      rootOverflow: rootStyle.overflow,
      rootOverscrollBehavior: rootStyle.overscrollBehavior,
      bodyOverflow: bodyStyle.overflow,
      bodyOverscrollBehavior: bodyStyle.overscrollBehavior,
      bodyPaddingBottom: bodyStyle.paddingBottom,
    };

    rootStyle.overflow = 'hidden';
    rootStyle.overscrollBehavior = 'none';
    bodyStyle.overflow = 'hidden';
    bodyStyle.overscrollBehavior = 'none';
    bodyStyle.paddingBottom = '0px';

    return () => {
      rootStyle.overflow = previousStyles.rootOverflow;
      rootStyle.overscrollBehavior = previousStyles.rootOverscrollBehavior;
      bodyStyle.overflow = previousStyles.bodyOverflow;
      bodyStyle.overscrollBehavior = previousStyles.bodyOverscrollBehavior;
      bodyStyle.paddingBottom = previousStyles.bodyPaddingBottom;
    };
  }, [isTicketWorkspace]);

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
    <div
      className={
        isTicketWorkspace
          ? 'flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground transition-colors duration-300'
          : 'flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300'
      }
      data-workspace-shell={isTicketWorkspace ? 'tickets' : undefined}
    >
      {isTicketWorkspace ? (
        <style data-ticket-workspace-chrome>
          {'[data-workspace-shell="tickets"] ~ .chatboc-container[data-mode="standalone"] { display: none !important; }'}
        </style>
      ) : null}
      {!isTicketWorkspace && !isFocusedPublicExperience ? <DemoModeBanner /> : null}
      {!isFocusedPublicExperience ? <Navbar /> : null}
      {isTicketWorkspace ? (
        <div className="mt-14 shrink-0">
          <DemoModeBanner />
        </div>
      ) : null}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          isTicketWorkspace
            ? 'flex min-h-0 w-full flex-1 overflow-hidden'
            : isProfileAnalyticsWorkspace
              ? 'flex-1 w-full pt-14'
              : isDemoExperience
                ? 'mx-auto w-full max-w-[96rem] flex-1 px-4 py-3 sm:py-5 md:px-8 xl:px-12'
              : isPublicSurveyExperience
                ? 'mx-auto w-full max-w-[96rem] flex-1 px-4 py-3 sm:py-5 md:px-8 xl:px-12'
              : 'flex-1 pt-20 px-4 sm:px-6 md:px-8 lg:px-16 max-w-7xl mx-auto w-full'
        }
      >
        <Outlet />
      </main>
      {!isFooterlessWorkspace ? (
        <>
          <ScrollToTopButton />
          <Footer />
        </>
      ) : null}
    </div>
  );
};

export default Layout;
