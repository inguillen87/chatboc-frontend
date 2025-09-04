import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';

const TicketsPanelPage = () => {
useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto mb-6 relative px-2">
        <TicketProvider>
          <NewTicketsPanel />
        </TicketProvider>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
