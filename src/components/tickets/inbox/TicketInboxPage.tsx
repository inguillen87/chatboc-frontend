import React, { useState } from 'react';
import { TicketListPane, TicketSummary } from './TicketListPane';
import { TicketConversationPane } from './TicketConversationPane';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export const TicketInboxPage: React.FC = () => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Mock data for initial scaffolding
  const mockTickets: TicketSummary[] = [
    { id: "T-1001", title: "Problema con la calle San Martin", status: "nuevo", category: "Vialidad", lastMessageAt: new Date().toISOString(), unreadCount: 2, slaLimitAt: new Date(Date.now() - 3600000).toISOString() }, // Vencido
    { id: "T-1002", title: "Consulta sobre facturación pyme", status: "en_proceso", category: "Comercio", lastMessageAt: new Date(Date.now() - 3600000).toISOString(), unreadCount: 0, slaLimitAt: new Date(Date.now() + 3600000).toISOString() }, // Por vencer
    { id: "T-1003", title: "Solicitud de turno", status: "esperando_agente", category: "Salud", lastMessageAt: new Date(Date.now() - 7200000).toISOString(), unreadCount: 1, slaLimitAt: new Date(Date.now() + 86400000).toISOString() } // En tiempo
  ];

  if (!isDesktop) {
    // Vista Mobile
    if (selectedTicketId) {
      return (
        <div className="flex flex-col w-full h-[calc(100vh-4rem)] bg-background">
           <div className="p-2 border-b">
              <button
                 onClick={() => setSelectedTicketId(undefined)}
                 className="text-sm text-primary flex items-center gap-1 font-medium px-2 py-1"
              >
                 ← Volver a Bandeja
              </button>
           </div>
           <div className="flex-1 overflow-hidden">
             <TicketConversationPane ticketId={selectedTicketId} />
           </div>
        </div>
      )
    }

    return (
      <div className="flex w-full h-[calc(100vh-4rem)] bg-background">
        <TicketListPane
          tickets={mockTickets}
          selectedTicketId={selectedTicketId}
          onSelect={setSelectedTicketId}
        />
      </div>
    );
  }

  // Vista Desktop (Resizable)
  return (
    <div className="flex w-full h-[calc(100vh-4rem)] bg-background border rounded-lg overflow-hidden shadow-sm">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={30}
          minSize={25}
          maxSize={40}
          className="min-w-[300px]"
        >
          <TicketListPane
            tickets={mockTickets}
            selectedTicketId={selectedTicketId}
            onSelect={setSelectedTicketId}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70} minSize={50}>
          <TicketConversationPane ticketId={selectedTicketId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
