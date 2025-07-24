import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { TicketProvider } from '@/context/TicketContext';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado'] as Role[]);
  return (
    <TicketProvider>
      <NewTicketsPanel />
    </TicketProvider>
  );
};

export default TicketsPanelPage;
