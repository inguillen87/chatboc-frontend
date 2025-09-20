import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  return (
    <div className="flex min-h-screen flex-col bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-6 sm:py-8 px-2 sm:px-4 md:px-6 xl:px-10">
      <div className="relative mx-auto flex w-full flex-1 max-w-[min(2200px,98vw)]">
        <TicketProvider>
          <NewTicketsPanel />
        </TicketProvider>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
