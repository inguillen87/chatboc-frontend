import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { getOmnichannelInboxV2, type OmnichannelInboxItem } from '@/api/v2/saas';
import { ViewState } from '@/components/app-shell/ViewState';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useTenant } from '@/context/TenantContext';
import { getTickets } from '@/services/ticketService';
import { ApiError, getErrorMessage } from '@/utils/api';

import { TicketConversationPane } from './TicketConversationPane';
import { TicketListPane } from './TicketListPane';

interface TicketInboxPageProps {
  presetCategory?: string;
  presetSensitivity?: string;
}

const shouldFallbackToLegacyTickets = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

const mapLegacyTicketsToInboxItems = async (tenantSlug?: string | null): Promise<OmnichannelInboxItem[]> => {
  const result = await getTickets(tenantSlug);
  return result.tickets.map((ticket) => {
    const rawTicket = ticket as any;
    return {
      id: String(rawTicket.id),
      title: rawTicket.asunto || rawTicket.title || rawTicket.nro_ticket || String(rawTicket.id),
      status: rawTicket.estado || 'unknown',
      category: rawTicket.categoria || rawTicket.categoria_principal || undefined,
      sensitivity: typeof rawTicket.priority === 'string' ? rawTicket.priority : undefined,
      channel: rawTicket.canal || rawTicket.channel || undefined,
      lastMessageAt: rawTicket.fecha || new Date().toISOString(),
      unreadCount: rawTicket.hasUnreadMessages ? 1 : 0,
      attachments: [],
      school_case: rawTicket.school_case || rawTicket.education_case || rawTicket.case_alias || null,
      presence: [],
      timeline: [],
      actions: [],
      allowed_actions: [],
      next_steps: [],
      raw: ticket,
    };
  });
};

export const TicketInboxPage: React.FC<TicketInboxPageProps> = ({
  presetCategory,
  presetSensitivity,
}) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>();
  const { currentSlug } = useTenant();

  const inboxQuery = useQuery({
    queryKey: ['inbox-omnichannel-v2', currentSlug],
    queryFn: async () => {
      try {
        return await getOmnichannelInboxV2(currentSlug);
      } catch (error) {
        if (!shouldFallbackToLegacyTickets(error)) throw error;
        return {
          items: await mapLegacyTicketsToInboxItems(currentSlug),
          summary: {},
          raw: null,
        };
      }
    },
    retry: 0,
    staleTime: 30_000,
  });

  const sourceTickets = inboxQuery.data?.items ?? [];

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

  const selectedTicket: OmnichannelInboxItem | undefined = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedTicketId),
    [filteredTickets, selectedTicketId],
  );

  if (inboxQuery.isLoading) {
    return (
      <div className="p-4">
        <ViewState status="loading" description="Cargando inbox omnicanal desde contrato v2." />
      </div>
    );
  }

  if (inboxQuery.isError) {
    return (
      <div className="p-4">
        <ViewState
          status="error"
          description={getErrorMessage(inboxQuery.error, 'No se pudo cargar el inbox omnicanal.')}
          action={
            <Button type="button" variant="outline" onClick={() => void inboxQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (!filteredTickets.length) {
    return (
      <div className="p-4">
        <ViewState status="empty" description="No hay conversaciones omnicanal para los filtros actuales." />
      </div>
    );
  }

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
          <TicketConversationPane
            ticket={selectedTicket}
            ticketId={selectedTicketId}
            tenantSlug={currentSlug}
            onActionComplete={() => void inboxQuery.refetch()}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
