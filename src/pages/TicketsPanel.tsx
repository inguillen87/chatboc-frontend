import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground pt-16 pb-4 sm:pt-6 sm:pb-6 px-2 sm:px-4 md:px-5 lg:px-6 2xl:px-5">
      <div className="relative mx-auto flex w-full flex-1 min-h-0 max-w-[min(2400px,calc(100vw-2rem))]">
        <SectionErrorBoundary
          title="Ocurrió un problema al cargar Tickets"
          description="Recargá la página o volvé a la sección principal del panel."
          onRetry={() => window.location.reload()}
        >
          <TicketProvider>
            <NewTicketsPanel />
          </TicketProvider>
        </SectionErrorBoundary>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
