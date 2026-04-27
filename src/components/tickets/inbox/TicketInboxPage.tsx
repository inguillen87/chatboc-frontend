import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TicketListPane } from './TicketListPane';
import { TicketConversationPane } from './TicketConversationPane';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { getTickets } from '@/services/ticketService';
import { useTenant } from '@/context/TenantContext';

interface TicketInboxPageProps {
  presetCategory?: string;
  presetSensitivity?: string;
}

interface TicketSummaryItem {
  id: string;
  title: string;
  status: string;
  category?: string;
  sensitivity?: string;
  lastMessageAt: string;
  unreadCount: number;
}

const MOCK_TICKETS: TicketSummaryItem[] = [
  {
    id: 'T-1001',
    title: 'Problema con la calle San Martin',
    status: 'nuevo',
    category: 'Vialidad',
    sensitivity: 'publico',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 2,
  },
  {
    id: 'T-1002',
    title: 'Consulta sobre facturación pyme',
    status: 'en_proceso',
    category: 'Comercio',
    sensitivity: 'familiar',
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 0,
  },
];

export const TicketInboxPage: React.FC<TicketInboxPageProps> = ({
  presetCategory,
  presetSensitivity,
}) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>();
  const { currentSlug } = useTenant();

  const ticketsQuery = useQuery({
    queryKey: ['ticket-inbox', currentSlug],
    queryFn: async () => {
      const result = await getTickets(currentSlug);
      return result.tickets.map((ticket) => ({
        id: String(ticket.id),
        title: ticket.asunto || ticket.title || ticket.nro_ticket,
        status: ticket.estado,
        category: ticket.categoria || ticket.categoria_principal || undefined,
        sensitivity: typeof ticket.priority === 'string' ? ticket.priority : undefined,
        lastMessageAt: ticket.fecha,
        unreadCount: ticket.hasUnreadMessages ? 1 : 0,
      }));
    },
    retry: 0,
  });

  const sourceTickets = ticketsQuery.data && ticketsQuery.data.length > 0 ? ticketsQuery.data : MOCK_TICKETS;

  const filteredTickets = useMemo(
    () =>
      sourceTickets.filter((ticket) => {
        const matchesCategory = presetCategory ? (ticket.category ?? '').toLowerCase() === presetCategory.toLowerCase() : true;
        const matchesSensitivity = presetSensitivity
          ? (ticket.sensitivity ?? '').toLowerCase() === presetSensitivity.toLowerCase()
          : true;
        return matchesCategory && matchesSensitivity;
      }),
    [sourceTickets, presetCategory, presetSensitivity],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-background">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={30}
          minSize={25}
          maxSize={40}
          className="min-w-[300px]"
        >
          <TicketListPane
            tickets={filteredTickets}
            selectedTicketId={selectedTicketId}
            onSelect={setSelectedTicketId}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70}>
          <TicketConversationPane ticketId={selectedTicketId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
