import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado'] as Role[]);
  return <NewTicketsPanel />;
};

export default TicketsPanelPage;
