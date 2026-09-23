import { useMemo } from 'react';

import { resolveTicketPresentationCategory } from '@/components/tickets/ticketPresentationCategory';
import type { Ticket } from '@/types/tickets';
import useTicketRoutingAuthority from './useTicketRoutingAuthority';

export const useTicketPresentationCategory = (ticket: Ticket | null) => {
  const routing = useTicketRoutingAuthority(ticket);
  return useMemo(
    () => ticket
      ? resolveTicketPresentationCategory({
          ticket,
          routingResolution: routing.resolution,
          routingLoading: routing.loading,
        })
      : null,
    [routing.loading, routing.resolution, ticket],
  );
};

export default useTicketPresentationCategory;

