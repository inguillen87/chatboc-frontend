import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-4 sm:py-6 px-2 sm:px-4 md:px-5 lg:px-6 2xl:px-5">
      <div className="relative mx-auto flex w-full flex-1 max-w-[min(2400px,calc(100vw-2rem))]">
        <TicketProvider>
          <NewTicketsPanel />
        </TicketProvider>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
